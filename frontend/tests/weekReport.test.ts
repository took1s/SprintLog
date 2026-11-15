import { describe, expect, it } from 'vitest';
import { reportFacts, reportWeekStart, weekReport } from '@/lib/weekReport';
import { ROUTINE_LIBRARY, LIBRARY_IDS, libraryDays, libraryDraft } from '@/lib/routineLibrary';
import { EVERY_DAY, MAX_ROUTINE_STEPS, type Routine } from '@/lib/routines';
import { bit } from '@/lib/schedule';
import type { PlannedWorkout } from '@/lib/planned';
import type { Workout } from '@/types';
import { en } from '@/i18n/en';

// Woche 2026-11-09 (Mo) bis 2026-11-15 (So)
const w = (date: string, over: Partial<Workout> = {}): Workout => ({ date: `${date}T17:00:00`, workoutType: 'Gym', durationSeconds: 3600, sessionRpe: 7, sets: [], ...over });
const routine = (over: Partial<Routine> = {}): Routine => ({
  clientId: 'rt-w0000001', title: 'Reha', kind: 'rehab', days: 127, startDate: '2026-11-01', endDate: null, reason: null, source: 'user',
  steps: [{ name: 'a' }], timesPerDay: 1, doneDates: [], times: [], pain: [], createdAt: '', updatedAt: '', ...over,
});

describe('Wochenbericht', () => {
  it('Sonntag: laufende Woche, Montag: Vorwoche, sonst keiner', () => {
    expect(reportWeekStart('2026-11-15')).toBe('2026-11-09');
    expect(reportWeekStart('2026-11-16')).toBe('2026-11-09');
    expect(reportWeekStart('2026-11-12')).toBeNull();
  });

  it('zählt Einheiten, Spiele, Plan-Tage, Routinen, Zusatz-Einheiten und vergleicht mit der Vorwoche', () => {
    const workouts = [
      w('2026-11-10'), w('2026-11-12'), w('2026-11-14', { workoutType: 'Match', durationSeconds: 5400 }),
      w('2026-11-03'), // Vorwoche
    ];
    const schedule = { trainingDays: bit(1) | bit(3) | bit(4), matchDays: bit(5) }; // Di, Do, Fr Training, Sa Spiel
    const rehab = routine({
      doneDates: ['2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13', '2026-11-14'],
      pain: [{ day: '2026-11-02', level: 6 }, { day: '2026-11-04', level: 5 }, { day: '2026-11-11', level: 3 }, { day: '2026-11-14', level: 2 }],
    });
    const planned = [
      { clientId: 'pl-1', date: '2026-11-11', status: 'done' }, { clientId: 'pl-2', date: '2026-11-13', status: 'planned' }, { clientId: 'pl-3', date: '2026-11-20', status: 'planned' },
    ] as PlannedWorkout[];
    const r = weekReport({ today: '2026-11-15', workouts, schedule, routines: [rehab], planned }, '2026-11-09');
    expect(r.sessions).toBe(3);
    expect(r.prevSessions).toBe(1);
    expect(r.matches).toBe(1);
    expect(r.planDays).toEqual({ done: 2, total: 3 }); // Di + Do ja, Fr nein
    expect(r.routines).toEqual({ done: 5, due: 7, pct: 71 });
    expect(r.extras).toEqual({ done: 1, skipped: 0, missed: 1, open: 0 });
    expect(r.rehab).toEqual([{ title: 'Reha', latest: 2, trend: 'falling' }]);
    expect(r.days.map((d) => d.sessions)).toEqual([0, 1, 0, 1, 0, 1, 0]);
    expect(r.rpe).toBe(7);
    const facts = reportFacts(r);
    expect(facts).toContain('Sessions: 3 (previous week 1), matches: 1');
    expect(facts).toContain('Plan training days done: 2/3.');
    expect(facts).toContain('Rehab "Reha": latest pain 2/10, trend falling.');
  });

  it('ohne Wochenplan und Routinen: keine Plan-Tage, keine Quote', () => {
    const r = weekReport({ today: '2026-11-16', workouts: [], schedule: null, routines: [], planned: [] }, '2026-11-09');
    expect(r.planDays).toBeNull();
    expect(r.routines.pct).toBeNull();
    expect(r.days.every((d) => !d.future)).toBe(true);
    expect(reportFacts(r)).toContain('No weekly plan schedule set.');
  });
});

describe('Routinen-Bibliothek', () => {
  it('jede Vorlage hat Texte für alle Schritte und passt in die Grenzen des Servers', () => {
    const items = en.routineLibrary.items as Record<string, { title: string; summary: string; note: string; steps: Record<string, { name: string; dose: string }> }>;
    for (const tpl of ROUTINE_LIBRARY) {
      const text = items[tpl.id];
      expect(text, tpl.id).toBeTruthy();
      expect(Object.keys(text.steps)).toHaveLength(tpl.steps.length);
      expect(tpl.steps.length).toBeLessThanOrEqual(MAX_ROUTINE_STEPS);
      expect(text.title.length).toBeLessThanOrEqual(60);
      for (const s of Object.values(text.steps)) {
        expect(s.name.length, s.name).toBeLessThanOrEqual(80);
        expect(s.dose.length, s.dose).toBeLessThanOrEqual(60);
      }
    }
    expect(new Set(ROUTINE_LIBRARY.map((x) => x.id)).size).toBe(LIBRARY_IDS.length);
  });

  it('Tage aus dem Wochenplan: Trainingstage bzw. Tag nach dem Spiel; sonst Ersatz', () => {
    const fifa = ROUTINE_LIBRARY.find((x) => x.id === 'fifa11')!;
    const rec = ROUTINE_LIBRARY.find((x) => x.id === 'recovery')!;
    const schedule = { trainingDays: bit(1) | bit(3), matchDays: bit(6) }; // Spiel am Sonntag -> Montag
    expect(libraryDays(fifa, schedule)).toBe(bit(1) | bit(3));
    expect(libraryDays(rec, schedule)).toBe(bit(0));
    expect(libraryDays(rec, null)).toBe(rec.fallbackDays);
    expect(libraryDays(ROUTINE_LIBRARY.find((x) => x.id === 'hips')!, schedule)).toBe(EVERY_DAY);
  });

  it('Entwurf: Zeitraum ab heute über die Dauer, Katalog-Übungen verknüpft', () => {
    const nordic = ROUTINE_LIBRARY.find((x) => x.id === 'nordic')!;
    const d = libraryDraft(nordic, '2026-11-15', null);
    expect(d.startDate).toBe('2026-11-15');
    expect(d.endDate).toBe('2026-01-23'.replace('2026', '2027'));
    expect(d.steps[1].exerciseId).toBe(50);
    expect(d.kind).toBe('prevention');
  });
});
