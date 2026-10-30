import { describe, expect, test } from 'vitest';
import { blockOrder, ghostFor, matchScore, normalize, previousSets } from '../src/lib/workout';
import type { Workout } from '../src/types';

const base = { trackingType: 'WeightReps' as const, bodyweight: false, index: 0, sessionSets: [] };

describe('ghost set (prefilled next set)', () => {
  test('template wins: "repeat" prefills every set incl. warm-ups', () => {
    const template = [{ weight: 40, reps: 10, isWarmup: true }, { weight: 80, reps: 5 }];
    expect(ghostFor({ ...base, template })).toMatchObject({ weight: 40, reps: 10, isWarmup: true, source: 'template' });
    expect(ghostFor({ ...base, index: 1, template })).toMatchObject({ weight: 80, reps: 5, isWarmup: false });
  });

  test('then the last set of this session (same weight again = one tap)', () => {
    expect(ghostFor({ ...base, index: 1, sessionSets: [{ weight: 82.5, reps: 6 }] })).toMatchObject({ weight: 82.5, reps: 6, source: 'session' });
  });

  test('after a warm-up the plan suggestion or last time is used, not the light warm-up weight', () => {
    const sessionSets = [{ weight: 40, reps: 10, isWarmup: true }];
    expect(ghostFor({ ...base, index: 1, sessionSets, plan: { weight: 85, reps: 5 } })).toMatchObject({ weight: 85, source: 'plan' });
    const previous = [{ weight: 50, reps: 8, isWarmup: true }, { weight: 77.5, reps: 5 }, { weight: 77.5, reps: 4 }];
    expect(ghostFor({ ...base, index: 1, sessionSets, previous })).toMatchObject({ weight: 77.5, reps: 5, source: 'previous' });
  });

  test('without session sets: the matching set number of last time', () => {
    const previous = [{ weight: 100, reps: 5 }, { weight: 95, reps: 6 }];
    expect(ghostFor({ ...base, previous })).toMatchObject({ weight: 100, reps: 5 });
  });

  test('defaults per tracking type; bodyweight exercises start at 0 kg', () => {
    expect(ghostFor(base)).toMatchObject({ weight: 20, reps: 10, source: 'default' });
    expect(ghostFor({ ...base, bodyweight: true })).toMatchObject({ weight: 0, reps: 10 });
    expect(ghostFor({ ...base, trackingType: 'DistanceTime' })).toMatchObject({ distance: 30, time: 4.5 });
    expect(ghostFor({ ...base, trackingType: 'Duration' })).toMatchObject({ time: 60 });
  });
});

describe('blocks', () => {
  test('order: added exercises, then plan targets, then exercises with sets - no duplicates', () => {
    expect(blockOrder([5, 1], [1, 9], [9, 7, 5])).toEqual([5, 1, 9, 7]);
    expect(blockOrder(undefined, [], [3, 3])).toEqual([3]);
  });

  test('previous sets come from the most recent workout with the exercise (edited one excluded)', () => {
    const workouts: Workout[] = [
      { id: 1, date: '2026-10-01T10:00:00Z', workoutType: 'Gym', sets: [{ exerciseId: 1, weight: 70, reps: 5 }] },
      { id: 2, date: '2026-10-20T10:00:00Z', workoutType: 'Gym', sets: [{ exerciseId: 1, weight: 80, reps: 5 }, { exerciseId: 2, weight: 10, reps: 10 }] },
      { id: 3, date: '2026-10-25T10:00:00Z', workoutType: 'Gym', sets: [{ exerciseId: 2, weight: 12, reps: 10 }] },
    ];
    expect(previousSets(workouts, 1).map((s) => s.weight)).toEqual([80]);
    expect(previousSets(workouts, 1, { id: 2 }).map((s) => s.weight)).toEqual([70]);
    expect(previousSets(workouts, 99)).toEqual([]);
  });
});

describe('search', () => {
  const bench = ['bench press', 'bankdrucken', 'жим штанги лежа', 'жим', 'chest'].map(normalize);

  test('normalizes umlauts, ё and case', () => {
    expect(normalize('Bankdrücken')).toBe('bankdrucken');
    expect(normalize('Жим штанги лёжа')).toBe('жим штанги лежа');
    expect(normalize('Straße')).toBe('strasse');
  });

  test('every word must match; prefix beats substring', () => {
    expect(matchScore('жим', bench)).toBeGreaterThan(0);
    expect(matchScore('bank', bench)).toBeGreaterThan(matchScore('ank', bench));
    expect(matchScore('bench squat', bench)).toBe(0);
  });

  test('tolerates one typo for words with 4+ letters', () => {
    expect(matchScore('bankdruken', bench)).toBeGreaterThan(0);
    expect(matchScore('benhc', bench)).toBeGreaterThan(0);
    expect(matchScore('xyz', bench)).toBe(0);
  });
});
