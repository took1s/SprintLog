import { test } from 'vitest';
import assert from 'node:assert/strict';
import { localDay, readiness, readinessAdvice, readinessLevel, readinessTrend, weeklyAverage } from '../src/lib/wellness';
import { programProgress } from '../src/lib/program';
import type { TrainingProgram } from '../src/types';

const e = (date: string, v: number, extra = {}) => ({ date, sleep: v, energy: v, soreness: v, mood: v, ...extra });

test('readiness maps the 1-5 scale to 0-100 % and rejects incomplete entries', () => {
  assert.equal(readiness(e('2026-10-29', 1)), 0);
  assert.equal(readiness(e('2026-10-29', 5)), 100);
  assert.equal(readiness({ sleep: 4, energy: 3, soreness: 2, mood: 5 }), 63);
  assert.equal(readiness({ sleep: 0, energy: 3, soreness: 3, mood: 3 }), null);
  assert.equal(readiness(null), null);
  assert.deepEqual([80, 50, 20].map(readinessLevel), ['good', 'ok', 'low']);
});

test('advice combines readiness and training load', () => {
  assert.equal(readinessAdvice(20, 'optimal'), 'easy', 'low readiness -> easy day');
  assert.equal(readinessAdvice(55, 'danger'), 'easy', 'load spike -> easy day');
  assert.equal(readinessAdvice(55, 'high'), 'easy');
  assert.equal(readinessAdvice(55, 'optimal'), 'normal');
  assert.equal(readinessAdvice(90, 'optimal'), 'push');
  assert.equal(readinessAdvice(90, 'high'), 'normal', 'feeling good but load rising -> as planned');
  assert.equal(readinessAdvice(null, 'optimal'), 'unknown');
});

test('trend has one slot per local day, oldest first; weekly average ignores missing days', () => {
  const today = new Date(2026, 9, 29, 9, 0);
  assert.equal(localDay(today), '2026-10-29');
  const entries = [e('2026-10-29', 5), e('2026-10-27', 1), e('2026-10-10', 3)];
  const trend = readinessTrend(entries, 3, today);
  assert.deepEqual(trend, [{ date: '2026-10-27', value: 0 }, { date: '2026-10-28', value: null }, { date: '2026-10-29', value: 100 }]);
  assert.equal(weeklyAverage(entries, today), 50);
  assert.equal(weeklyAverage([], today), null);
});

test('program progress compares the e1RM at the start with the last 3 weeks', () => {
  const program = {
    startedAt: '2026-09-01T08:00:00Z',
    days: [{ id: 1, position: 0, name: 'A', notes: null, exercises: [
      { exerciseId: 35, exerciseName: 'Barbell Squat', sets: 3, trackingType: 'WeightReps' },
      { exerciseId: 12, exerciseName: 'Sprints', sets: 6, trackingType: 'DistanceTime' },
      { exerciseId: 1, exerciseName: 'Bench Press', sets: 3, trackingType: 'WeightReps' },
    ] }],
  } as unknown as TrainingProgram;
  const w = (date: string, sets: object[]) => ({ date, workoutType: 'Gym', sets });
  const history = [
    w('2026-09-03T10:00:00Z', [{ exerciseId: 35, weight: 100, reps: 5 }, { exerciseId: 1, weight: 80, reps: 5 }]),
    w('2026-10-20T10:00:00Z', [{ exerciseId: 35, weight: 110, reps: 5 }, { exerciseId: 35, weight: 140, reps: 3, isWarmup: true }]),
  ];
  const now = new Date('2026-10-29T10:00:00Z');
  const result = programProgress(program, history, now);
  assert.equal(result.length, 1, 'bench has no recent sets, sprints are not strength');
  assert.deepEqual([result[0].exerciseId, result[0].start, result[0].current, result[0].change], [35, 116.7, 128.3, 9.9]);
  assert.deepEqual(programProgress(program, history, new Date('2026-09-10T10:00:00Z')), [], 'too early');
});
