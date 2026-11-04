import { describe, expect, test } from 'vitest';
import { isLocalExerciseId, localExerciseId, mergeExercises, queueHasLocalExercises, remapIds, remapKeys, remapQueue } from '../src/lib/offlineExercises';
import type { Exercise, QueueEntry } from '../src/types';

const entry = (sets: { exerciseId: number }[]): QueueEntry => ({ clientId: 'c', date: '2026-11-04', workoutType: 'Gym', sets: sets as QueueEntry['sets'], status: 'Pending' as QueueEntry['status'], attempts: 0, error: null });

describe('offline custom exercises', () => {
  test('local ids are negative and unique', () => {
    const a = localExerciseId([], 123456);
    expect(isLocalExerciseId(a)).toBe(true);
    expect(localExerciseId([{ id: a }], 123456)).not.toBe(a);
    expect(isLocalExerciseId(5)).toBe(false);
  });

  test('queued workouts with local exercises wait, after mapping they can be sent', () => {
    const q = [entry([{ exerciseId: 1 }, { exerciseId: -42 }])];
    expect(queueHasLocalExercises(q)).toBe(true);
    const mapped = remapQueue(q, new Map([[-42, 900]]));
    expect(mapped[0].sets.map((s) => s.exerciseId)).toEqual([1, 900]);
    expect(queueHasLocalExercises(mapped)).toBe(false);
  });

  test('order, favorites and per-exercise maps follow the new id', () => {
    const m = new Map([[-7, 77]]);
    expect(remapIds([3, -7], m)).toEqual([3, 77]);
    expect(remapKeys({ [-7]: 'x', 3: 'y' }, m)).toEqual({ 77: 'x', 3: 'y' });
  });

  test('server reload keeps local exercises that are not synced yet', () => {
    const server = [{ id: 1, name: 'Bench' }] as Exercise[];
    const local = [{ id: 5, name: 'Old' }, { id: -9, name: 'Sled' }] as Exercise[];
    expect(mergeExercises(server, local).map((e) => e.id)).toEqual([1, -9]);
  });
});
