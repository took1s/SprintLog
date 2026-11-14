import { describe, expect, it } from 'vitest';
import { byDay, displayStatus, freeDays, newPlannedId, past, planConflict, plannedToday, prescriptionText, upcoming, type PlannedWorkout } from '@/lib/planned';
import { cleanPlanned } from '@/stores/planned';

// 2026-11-16 ist ein Montag. Plan: Di + Do Training, Sa Spiel.
const schedule = { trainingDays: 0b0001010, matchDays: 0b0100000 };
const p = (over: Partial<PlannedWorkout> = {}): PlannedWorkout => ({
  clientId: 'pl-1', date: '2026-11-18', title: 'Speed', category: 'Football', notes: null, source: 'coach', status: 'planned', workoutClientId: null,
  exercises: [{ exerciseId: 12, sets: 6, distance: 30 }], createdAt: '', updatedAt: '', ...over,
});

describe('Zusatz-Einheiten: Regeln', () => {
  it('Plan-Tage und Spieltage sind belegt, ohne Plan ist alles frei', () => {
    expect(planConflict(schedule, '2026-11-17')).toBe('training');
    expect(planConflict(schedule, '2026-11-21')).toBe('match');
    expect(planConflict(schedule, '2026-11-18')).toBeNull();
    expect(planConflict(null, '2026-11-17')).toBeNull();
  });

  it('freie Tage: ohne Plan-Tage und andere offene Termine, Tag vor dem Spiel markiert', () => {
    const list = [p({ clientId: 'a', date: '2026-11-18' }), p({ clientId: 'b', date: '2026-11-19', status: 'skipped' })];
    expect(freeDays(schedule, list, '2026-11-16', 4)).toEqual([
      { day: '2026-11-16', beforeMatch: false },
      { day: '2026-11-20', beforeMatch: true },
      { day: '2026-11-22', beforeMatch: false },
      { day: '2026-11-23', beforeMatch: false },
    ]);
    // Bearbeiteter Termin blockiert seinen eigenen Tag nicht
    expect(freeDays(schedule, list, '2026-11-18', 1, 'a')[0].day).toBe('2026-11-18');
  });

  it('heute, anstehend, vergangen und verpasst', () => {
    const list = [
      p({ clientId: 'today', date: '2026-11-16' }),
      p({ clientId: 'later', date: '2026-11-20' }),
      p({ clientId: 'missed', date: '2026-11-14' }),
      p({ clientId: 'done', date: '2026-11-13', status: 'done' }),
      p({ clientId: 'gone', date: '2026-11-19', pending: 'delete' }),
    ];
    const today = '2026-11-16';
    expect(plannedToday(list, today).map((x) => x.clientId)).toEqual(['today']);
    expect(upcoming(list, today).map((x) => x.clientId)).toEqual(['today', 'later']);
    expect(past(list, today).map((x) => x.clientId)).toEqual(['missed', 'done']);
    expect(displayStatus(list[2], today)).toBe('missed');
    expect(displayStatus(list[3], today)).toBe('done');
    expect([...byDay(list).keys()].sort()).toEqual(['2026-11-13', '2026-11-14', '2026-11-16', '2026-11-20']);
  });

  it('Vorgaben als Kurztext je Erfassungsart', () => {
    expect(prescriptionText({ exerciseId: 1, sets: 3, repsMin: 6, repsMax: 8, weight: 60 }, 'WeightReps')).toBe('3×6-8 @ 60 kg');
    expect(prescriptionText({ exerciseId: 12, sets: 6, distance: 30 }, 'DistanceTime')).toBe('6×30 m');
    expect(prescriptionText({ exerciseId: 47, sets: 3, time: 45 }, 'Duration')).toBe('3×45 s');
    expect(prescriptionText({ exerciseId: 99, sets: 1, time: 1200 }, 'Cardio')).toBe('1×20:00 min');
  });

  it('Eingaben werden wie auf dem Server begrenzt', () => {
    const c = cleanPlanned({ date: '2026-11-18', title: '  Speed  ', category: 'Football', notes: '  ', exercises: [
      { exerciseId: 1, sets: 99, repsMin: 10, repsMax: 5, weight: -3, targetRpe: 12 },
      { exerciseId: 0, sets: 3 },
    ] });
    expect(c.title).toBe('Speed');
    expect(c.notes).toBeNull();
    expect(c.exercises).toEqual([{ exerciseId: 1, sets: 20, repsMin: 10, repsMax: 10, weight: null, distance: null, time: null, targetRpe: null, note: null }]);
    expect(newPlannedId()).toMatch(/^pl-[A-Za-z0-9]{8,}$/);
  });
});
