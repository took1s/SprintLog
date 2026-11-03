import { describe, expect, test } from 'vitest';
import { dateRealism, effectiveE1RM, goalProgress, goalSessions, nextPrescription, trainingReps, workingWeight, type GoalSession, type LiftGoal } from '../src/lib/goals';
import type { Workout } from '../src/types';

const goal = (over: Partial<LiftGoal> = {}): LiftGoal => ({
  exerciseId: 1, targetWeight: 120, targetReps: 1, increment: 2.5, startE1RM: null, targetDate: null,
  createdAt: '2026-09-01T00:00:00Z', achievedAt: null, ...over,
});
const session = (date: string, weight: number, reps: number[], rpe?: number): GoalSession => ({
  date, sets: reps.map((r) => ({ exerciseId: 1, weight, reps: r, rpe: rpe ?? null })),
});

describe('training parameters', () => {
  test('strength goals train in sets of 5, rep goals at their rep count', () => {
    expect(trainingReps({ targetReps: 1 })).toBe(5);
    expect(trainingReps({ targetReps: 3 })).toBe(5);
    expect(trainingReps({ targetReps: 8 })).toBe(8);
  });

  test('RPE adds the reps in reserve to the 1RM estimate', () => {
    expect(effectiveE1RM({ weight: 100, reps: 5, rpe: 8 })).toBeGreaterThan(effectiveE1RM({ weight: 100, reps: 5, rpe: 10 }));
    expect(effectiveE1RM({ weight: 100, reps: 5, rpe: null })).toBe(effectiveE1RM({ weight: 100, reps: 5, rpe: 10 }));
  });

  test('working weight sits around RPE 8 and is rounded to the increment', () => {
    const w = workingWeight(100, 5, 2.5);
    expect(w % 2.5).toBe(0);
    expect(w).toBeGreaterThan(75);
    expect(w).toBeLessThan(85);
  });
});

describe('next session', () => {
  test('without history the start weight comes from the entered 1RM', () => {
    expect(nextPrescription(goal({ startE1RM: 90 }), [])).toMatchObject({ kind: 'start', reps: 5, sets: 3, weight: workingWeight(90, 5, 2.5) });
    expect(nextPrescription(goal(), [])).toMatchObject({ kind: 'start', weight: null });
  });

  test('all reps made -> add the increment', () => {
    expect(nextPrescription(goal(), [session('2026-09-10', 80, [5, 5, 5], 8)])).toMatchObject({ kind: 'progress', weight: 82.5 });
  });

  test('very easy sets jump up to three steps, never more', () => {
    const p = nextPrescription(goal(), [session('2026-09-10', 70, [9, 9, 9], 7)]);
    expect(p.kind).toBe('jump');
    expect(p.weight).toBeLessThanOrEqual(77.5);
    expect(p.weight).toBeGreaterThan(72.5);
  });

  test('missed reps -> repeat, missed twice -> deload 10 %', () => {
    expect(nextPrescription(goal(), [session('2026-09-10', 85, [5, 4, 3])])).toMatchObject({ kind: 'repeat', weight: 85 });
    expect(nextPrescription(goal(), [session('2026-09-07', 85, [5, 4, 4]), session('2026-09-10', 85, [5, 4, 3])]))
      .toMatchObject({ kind: 'deload', weight: 77.5 });
  });

  test('a grinder at RPE 9.5 counts as missed', () => {
    expect(nextPrescription(goal(), [session('2026-09-10', 85, [5, 5, 5], 9.5)])).toMatchObject({ kind: 'repeat' });
  });

  test('strong enough -> test day with the goal itself; reached -> achieved', () => {
    expect(nextPrescription(goal(), [session('2026-09-10', 95, [5, 5, 5], 8)])).toMatchObject({ kind: 'progress', weight: 97.5 });
    expect(nextPrescription(goal(), [session('2026-09-10', 100, [5, 5, 5], 8)])).toMatchObject({ kind: 'test', weight: 120, reps: 1, sets: 1 });
    expect(nextPrescription(goal(), [session('2026-09-12', 120, [1])])).toMatchObject({ kind: 'achieved' });
  });
});

describe('progress and forecast', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const climb = [
    session('2026-09-01', 75, [5, 5, 5], 8), session('2026-09-08', 77.5, [5, 5, 5], 8),
    session('2026-09-15', 80, [5, 5, 5], 8), session('2026-09-22', 82.5, [5, 5, 5], 8),
  ];

  test('percent moves from start to target and a trend gives an ETA', () => {
    const p = goalProgress(goal({ startE1RM: 90 }), climb, now);
    expect(p.start).toBe(90);
    expect(p.target).toBe(120);
    expect(p.current).toBeGreaterThan(90);
    expect(p.percent).toBeGreaterThan(0);
    expect(p.percent).toBeLessThan(100);
    expect(p.trendPerWeek).toBeGreaterThan(0);
    expect(p.etaSource).toBe('trend');
    expect(new Date(p.eta!).getTime()).toBeGreaterThan(now.getTime());
  });

  test('without enough sessions the ETA comes from the planned progression', () => {
    const p = goalProgress(goal(), [session('2026-10-18', 80, [5, 5, 5], 8)], now);
    expect(p.trendPerWeek).toBeNull();
    expect(p.etaSource).toBe('plan');
  });

  test('target date: needed weekly gain and whether the trend is enough', () => {
    const p = goalProgress(goal({ startE1RM: 90, targetDate: '2026-11-01' }), climb, now);
    expect(p.neededPerWeek).toBeGreaterThan(0);
    expect(p.onTrack).toBe(false);
  });

  test('realism of a target date', () => {
    expect(dateRealism(100, 102, '2026-12-31', now)).toBe('ok');
    expect(dateRealism(100, 140, '2026-11-20', now)).toBe('unrealistic');
  });

  test('sessions are read from workouts (working sets only, oldest first)', () => {
    const workouts: Workout[] = [
      { id: 2, date: '2026-10-10T10:00:00Z', workoutType: 'Gym', sets: [{ exerciseId: 1, weight: 80, reps: 5 }, { exerciseId: 1, weight: 40, reps: 10, isWarmup: true }] },
      { id: 1, date: '2026-10-01T10:00:00Z', workoutType: 'Gym', sets: [{ exerciseId: 1, weight: 77.5, reps: 5 }, { exerciseId: 2, weight: 10, reps: 10 }] },
    ];
    const s = goalSessions(workouts, 1);
    expect(s.map((x) => x.sets.length)).toEqual([1, 1]);
    expect(s[0].date < s[1].date).toBe(true);
  });
});
