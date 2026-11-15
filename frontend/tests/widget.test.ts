import { describe, expect, it } from 'vitest';
import { widgetSnapshot, type WidgetInput } from '@/lib/widget';
import type { Routine } from '@/lib/routines';
import type { PlannedWorkout } from '@/lib/planned';
import { bit } from '@/lib/schedule';

// 2026-11-12 ist ein Donnerstag
const routine = (over: Partial<Routine> = {}): Routine => ({
  clientId: 'rt-wid00001', title: 'Dehnen', kind: 'mobility', days: 127, startDate: '2026-11-01', endDate: null, reason: null, source: 'user',
  steps: [{ name: 'a' }], timesPerDay: 3, doneDates: ['2026-11-12'], times: ['08:00', '14:00', '20:00'], pain: [], createdAt: '', updatedAt: '', ...over,
});
const labels = { routines: 'R', allDone: 'all', none: 'none', next: 'next', training: 'T', match: 'M', rest: 'Rest', extra: 'X' };
const colors = { bg: '1 2 3', fg: '4 5 6', muted: '7 8 9', accent: '10 11 12', success: '13 14 15' };
const input = (over: Partial<WidgetInput> = {}): WidgetInput => ({
  today: '2026-11-12', now: '12:00', routines: [routine()], planned: [], schedule: null, planDayName: 'Lower body', labels, colors, ...over,
});

describe('Widget-Schnappschuss', () => {
  it('7 Tage: heute mit Durchgängen und nächster Uhrzeit, später ohne Haken', () => {
    const s = widgetSnapshot(input());
    expect(s.days.map((d) => d.day)).toEqual(['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18']);
    expect(s.days[0].routines).toEqual([{ title: 'Dehnen', done: 1, total: 3, next: '14:00' }]);
    expect(s.days[1].routines[0]).toEqual({ title: 'Dehnen', done: 0, total: 3, next: '08:00' });
    expect(s.colors).toEqual(colors);
    expect(JSON.parse(JSON.stringify(s)).labels).toEqual({ routines: 'R', allDone: 'all', none: 'none', next: 'next' });
  });

  it('Einheit des Tages: Zusatz-Einheit vor Spiel vor Trainingstag (Plan-Tag nur heute benannt)', () => {
    const schedule = { trainingDays: bit(3) | bit(4), matchDays: bit(5) }; // Do, Fr Training, Sa Spiel
    const planned = [{ clientId: 'pl-1', date: '2026-11-14', title: 'Speed', status: 'planned' } as PlannedWorkout];
    const s = widgetSnapshot(input({ schedule, planned }));
    expect(s.days[0].session).toEqual({ kind: 'training', label: 'T', title: 'Lower body' });
    expect(s.days[1].session).toEqual({ kind: 'training', label: 'T', title: null });
    expect(s.days[2].session).toEqual({ kind: 'extra', label: 'X', title: 'Speed' });
    expect(s.days[3].session.kind).toBe('rest');
  });

  it('gelöschte und nicht fällige Routinen fehlen', () => {
    const s = widgetSnapshot(input({ routines: [routine({ pending: 'delete' }), routine({ clientId: 'rt-x', days: bit(0) })] }));
    expect(s.days[0].routines).toEqual([]);
    expect(s.days[4].routines).toHaveLength(1); // Montag
  });
});
