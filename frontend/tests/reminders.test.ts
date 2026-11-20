import { describe, expect, it } from 'vitest';
import { DEFAULT_REMINDER_PREFS, MAX_REMINDERS, planReminders, reminderId, type ReminderTexts } from '@/lib/reminders';
import type { Routine } from '@/lib/routines';
import type { PlannedWorkout } from '@/lib/planned';
import { bit } from '@/lib/schedule';

// 2026-11-12 ist ein Donnerstag
const NOW = new Date(2026, 10, 12, 12, 0);
const texts: ReminderTexts = {
  routine: (r, k, slot) => ({ title: r.title, body: `${slot ?? '-'} ${k}/${r.timesPerDay}` }),
  planned: (p) => ({ title: `planned ${p.title}`, body: '' }),
  training: () => ({ title: 'training', body: '' }),
  match: () => ({ title: 'match', body: '' }),
  report: () => ({ title: 'report', body: '' }),
  checkIn: () => ({ title: 'checkin', body: '' }),
};
const routine = (over: Partial<Routine> = {}): Routine => ({
  clientId: 'rt-a0000001', title: 'Dehnen', kind: 'mobility', days: 127, startDate: '2026-11-01', endDate: null, reason: null, source: 'user',
  steps: [{ name: 'a' }], timesPerDay: 3, doneDates: [], times: ['08:00', '14:00', '20:00'], pain: [], createdAt: '', updatedAt: '', ...over,
});
const planned = (over: Partial<PlannedWorkout> = {}): PlannedWorkout => ({
  clientId: 'pl-a0000001', date: '2026-11-14', title: 'Speed', category: 'Football', notes: null, source: 'coach', status: 'planned',
  workoutClientId: null, exercises: [], createdAt: '', updatedAt: '', ...over,
} as PlannedWorkout);
// Check-in eigens getestet (unten) - hier aus, damit die Zählungen der anderen Arten klar bleiben
const prefs = { ...DEFAULT_REMINDER_PREFS, enabled: true, checkIn: false };
const plan = (over: Partial<Parameters<typeof planReminders>[0]> = {}) =>
  planReminders({ now: NOW, prefs, routines: [], planned: [], schedule: null, texts, ...over });

describe('Erinnerungen planen', () => {
  it('Check-in täglich zur gewählten Zeit, heute nicht mehr, wenn schon eingetragen', () => {
    const on = { ...prefs, checkIn: true, checkInTime: '13:30' };
    const open = plan({ prefs: on }).filter((r) => r.kind === 'checkIn');
    expect(open).toHaveLength(7);
    expect(open[0].at.getDate()).toBe(12);
    expect(open[0].at.getHours()).toBe(13);
    const done = plan({ prefs: on, checkedInToday: true }).filter((r) => r.kind === 'checkIn');
    expect(done).toHaveLength(6);
    expect(done[0].at.getDate()).toBe(13);
  });

  it('aus: keine Erinnerungen', () => {
    expect(planReminders({ now: NOW, prefs: DEFAULT_REMINDER_PREFS, routines: [routine()], planned: [], schedule: null, texts })).toEqual([]);
  });

  it('Routine mit Uhrzeiten: heute nur offene Durchgänge in der Zukunft, danach jeder Durchgang', () => {
    const list = plan({ routines: [routine({ doneDates: ['2026-11-12'] })] });
    const today = list.filter((r) => r.at.getDate() === 12);
    // 08:00 erledigt (1 Haken), 14:00 und 20:00 offen; 12:00 jetzt -> beide in der Zukunft
    expect(today.map((r) => r.at.getHours())).toEqual([14, 20]);
    expect(today[0]).toMatchObject({ kind: 'routine', target: 'rt-a0000001', body: 'midday 2/3' });
    expect(list.filter((r) => r.at.getDate() === 13)).toHaveLength(3);
    expect(list.filter((r) => r.kind === 'routine')).toHaveLength(2 + 6 * 3);
  });

  it('ohne Uhrzeit: einmal zur Standardzeit, nicht an erledigten Tagen, nur an fälligen Wochentagen', () => {
    const r = routine({ times: [], timesPerDay: 1, days: bit(3) | bit(4), doneDates: ['2026-11-12'] }); // Do + Fr, heute erledigt
    const list = plan({ routines: [r] }).filter((x) => x.kind === 'routine');
    expect(list.map((x) => `${x.at.getDate()} ${x.at.getHours()}:${x.at.getMinutes()}`)).toEqual(['13 18:30']);
    expect(list[0].body).toBe('- 1/1');
  });

  it('morgens: Zusatz-Einheit vor Spiel vor Trainingstag; Wochenbericht sonntags', () => {
    const schedule = { trainingDays: bit(4), matchDays: bit(5) }; // Fr Training, Sa Spiel
    const list = plan({ schedule, planned: [planned({ date: '2026-11-15' })] });
    expect(list.map((r) => `${r.at.getDate()} ${r.title}`)).toEqual(['13 training', '14 match', '15 planned Speed', '15 report']);
    expect(list.find((r) => r.kind === 'report')!.at.getHours()).toBe(19);
  });

  it('heute schon vergangene Zeiten werden nicht geplant; höchstens 60, sortiert; Ids stabil', () => {
    const late = new Date(2026, 10, 12, 21, 0);
    expect(planReminders({ now: late, prefs, routines: [routine()], planned: [], schedule: null, texts }).some((r) => r.at.getDate() === 12)).toBe(false);
    const many = Array.from({ length: 5 }, (_, i) => routine({ clientId: `rt-many000${i}` }));
    const list = plan({ routines: many });
    expect(list).toHaveLength(MAX_REMINDERS);
    expect(list.every((r, i) => i === 0 || r.at >= list[i - 1].at)).toBe(true);
    expect(reminderId('r:x:2026-11-12:1')).toBe(reminderId('r:x:2026-11-12:1'));
    expect(reminderId('a')).not.toBe(reminderId('b'));
    expect(reminderId('a')).toBeGreaterThanOrEqual(100_000);
  });

  it('gelöschte Routinen und erledigte/ausgelassene Zusatz-Einheiten erinnern nicht', () => {
    const list = plan({ routines: [routine({ pending: 'delete' })], planned: [planned({ status: 'skipped' }), planned({ clientId: 'pl-b', status: 'done', date: '2026-11-13' })] });
    expect(list.filter((r) => r.kind !== 'report')).toEqual([]);
  });
});
