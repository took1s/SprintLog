import { test } from 'vitest';
import assert from 'node:assert/strict';
import type { TrainingProgram } from '../src/types';
import { currentWeek, programStatus, suggestTarget, prescriptionText, setsDone, loadStatus, draftToPayload, toDraft } from '../src/lib/program';

const program = {
  id: 1, weeks: 8, startedAt: '2026-10-01T08:00:00Z',
  days: [{ id: 10, position: 0, name: 'A' }, { id: 11, position: 1, name: 'B' }, { id: 12, position: 2, name: 'C' }],
} as unknown as TrainingProgram;
const set = (exerciseId, weight, reps, extra = {}) => ({ exerciseId, weight, reps, ...extra });
const w = (date, programDayId, sets = [], extra = {}) => ({ id: Math.random(), date, workoutType: 'Gym', programDayId, sets, ...extra });

test('currentWeek counts from the start date', () => {
  assert.equal(currentWeek(program, new Date('2026-10-01T09:00:00Z')), 1);
  assert.equal(currentWeek(program, new Date('2026-10-08T09:00:00Z')), 2);
  assert.equal(currentWeek(program, new Date('2026-10-29T09:00:00Z')), 5);
  assert.equal(currentWeek({ startedAt: null }), 1);
});

test('programStatus rotates to the day after the last completed one', () => {
  assert.equal(programStatus(program, []).next.id, 10, 'no history -> first day');
  const history = [w('2026-10-02T10:00:00Z', 10), w('2026-10-04T10:00:00Z', 11), w('2026-10-03T10:00:00Z', 99)];
  const status = programStatus(program, history, new Date('2026-10-05T10:00:00Z'));
  assert.equal(status.next.id, 12);
  assert.equal(status.sessions, 2, 'only workouts of this program count');
  assert.equal(status.lastByDay.get(10), '2026-10-02T10:00:00Z');
  assert.equal(programStatus(program, [w('2026-10-06T10:00:00Z', 12)]).next.id, 10, 'wraps around');
});

test('double progression: increase weight only when all sets hit the top of the range', () => {
  const px = { exerciseId: 1, trackingType: 'WeightReps' as const, sets: 3, repsMin: 5, repsMax: 8, progressionStep: 2.5 };
  assert.equal(suggestTarget(px, []).kind, 'new');

  const allTop = [w('2026-10-10T10:00:00Z', 10, [set(1, 40, 10, { isWarmup: true }), set(1, 80, 8), set(1, 80, 8), set(1, 80, 8)])];
  const up = suggestTarget(px, allTop);
  assert.deepEqual([up.kind, up.weight, up.reps], ['progress', 82.5, 5]);

  const notYet = [w('2026-10-10T10:00:00Z', 10, [set(1, 80, 8), set(1, 80, 7), set(1, 80, 6)])];
  const same = suggestTarget(px, notYet);
  assert.deepEqual([same.kind, same.weight, same.reps], ['repeat', 80, 7]);

  const tooFewSets = [w('2026-10-10T10:00:00Z', 10, [set(1, 80, 8), set(1, 80, 8)])];
  assert.equal(suggestTarget(px, tooFewSets).kind, 'repeat');

  const latestWins = [...notYet, w('2026-09-01T10:00:00Z', 10, [set(1, 100, 8), set(1, 100, 8), set(1, 100, 8)])];
  assert.equal(suggestTarget(px, latestWins).weight, 80, 'uses the most recent session');
});

test('bodyweight (step 0) progresses reps, sprints reference the best time', () => {
  const pull = { exerciseId: 17, trackingType: 'WeightReps' as const, sets: 2, repsMin: 5, repsMax: 8, progressionStep: 0 };
  assert.equal(suggestTarget(pull, [w('2026-10-10', 10, [set(17, 0, 8), set(17, 0, 8)])]).note.includes('harder variation'), true);
  const sprint = { exerciseId: 12, trackingType: 'DistanceTime' as const, sets: 6, distance: 30 };
  const s = suggestTarget(sprint, [w('2026-10-10', 10, [{ exerciseId: 12, distance: 30, time: 4.4 }, { exerciseId: 12, distance: 30, time: 4.2 }])]);
  assert.deepEqual([s.kind, s.time, s.distance], ['reference', 4.2, 30]);
  const hold = { exerciseId: 47, trackingType: 'Duration' as const, sets: 2, time: 45 };
  assert.equal(suggestTarget(hold, [w('2026-10-10', 10, [{ exerciseId: 47, time: 45 }, { exerciseId: 47, time: 50 }])]).time, 50);
});

test('prescription text and session progress', () => {
  assert.equal(prescriptionText({ exerciseId: 1, trackingType: 'WeightReps' as const, sets: 4, repsMin: 5, repsMax: 8, targetRpe: 8, restSeconds: 150 }), '4 × 5-8 · RPE 8 · 2:30 rest');
  assert.equal(prescriptionText({ exerciseId: 1, trackingType: 'DistanceTime' as const, sets: 6, distance: 20 }), '6 × 20 m');
  assert.equal(prescriptionText({ exerciseId: 1, trackingType: 'Duration' as const, sets: 3, time: 45, restSeconds: 60 }), '3 × 45 s · 1:00 rest');
  assert.equal(setsDone(1, [set(1, 40, 10, { isWarmup: true }), set(1, 80, 8), set(2, 10, 10)]), 1);
});

test('ACWR: sweet spot, spike and not enough data', () => {
  const now = new Date('2026-10-29T12:00:00Z');
  const daysAgo = (d, rpe = 6, min = 60) => ({ date: new Date(now.getTime() - d * 86_400_000).toISOString(), workoutType: 'Football', sets: [], sessionRpe: rpe, durationSeconds: min * 60 });
  const steady = [1, 4, 8, 11, 15, 18, 22, 25].map((d) => daysAgo(d));
  const s1 = loadStatus(steady, now);
  assert.equal(s1.zone, 'optimal');
  assert.equal(s1.ratio, 1);

  const spike = [...steady, daysAgo(2, 9, 120), daysAgo(3, 9, 120)];
  assert.equal(loadStatus(spike, now).zone, 'danger');

  const short = [daysAgo(1), daysAgo(3)];
  assert.equal(loadStatus(short, now).zone, 'unknown');
  assert.equal(loadStatus([{ ...daysAgo(1), sessionRpe: null }], now).coverage.withRpe, 0);
});

test('editor draft round-trip only sends fields that match the tracking type', () => {
  const ex = new Map([[1, { trackingType: 'WeightReps' as const }], [12, { trackingType: 'DistanceTime' as const }]]);
  const payload = draftToPayload({
    id: 5, name: ' Plan ', goal: 'Speed', weeks: '6',
    days: [{ id: 3, name: 'A', notes: '', exercises: [
      { exerciseId: '1', sets: '4', repsMin: '5', repsMax: '8', distance: 99, restSeconds: '120' },
      { exerciseId: '12', sets: 6, repsMin: 5, distance: '30' },
      { exerciseId: '', sets: 3 },
    ] }],
  }, ex);
  assert.equal(payload.name, 'Plan');
  assert.equal(payload.weeks, 6);
  const [a, b] = payload.days[0].exercises;
  assert.equal(payload.days[0].exercises.length, 2, 'rows without exercise are dropped');
  assert.deepEqual([a.repsMin, a.repsMax, a.distance, a.restSeconds], [5, 8, null, 120]);
  assert.deepEqual([b.distance, b.repsMin, b.progressionStep], [30, null, null]);
  assert.equal(toDraft({ id: 1, name: 'X', goal: 'General', weeks: 4, days: [{ id: 2, position: 0, name: 'D', notes: null, exercises: [] }] } as unknown as TrainingProgram).days[0].notes, '');
});
