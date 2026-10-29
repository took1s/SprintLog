import { test } from 'vitest';
import assert from 'node:assert/strict';
import type { TrainingProgram } from '../src/types';
import { currentWeek, programStatus, suggestTarget, prescriptionText, setsDone, loadStatus, draftToPayload, toDraft, cycleWeek, isDeloadWeek, effectivePrescription, bestRecentE1RM, newDraftStep } from '../src/lib/program';

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

// ---------- Periodisierung ----------

const nordic = {
  exerciseId: 50, trackingType: 'WeightReps' as const, sets: 2, repsMin: 5, repsMax: 5, progressionStep: 0, note: 'Partner holds the heels',
  weekSteps: [
    { fromWeek: 2, sets: 2, repsMin: 6, repsMax: 6 },
    { fromWeek: 3, sets: 3, repsMin: 6, repsMax: 8 },
    { fromWeek: 5, sets: 3, repsMin: 8, repsMax: 12, note: 'Sets of 12, 10 and 8 reps' },
  ],
};

test('week steps: the latest step up to this week applies, unset fields keep the base values', () => {
  const w1 = effectivePrescription(nordic, null, 1);
  assert.deepEqual([w1.sets, w1.repsMin, w1.repsMax, w1.note, w1.stepWeek], [2, 5, 5, 'Partner holds the heels', null]);
  const w4 = effectivePrescription(nordic, null, 4);
  assert.deepEqual([w4.sets, w4.repsMin, w4.repsMax, w4.note, w4.stepWeek], [3, 6, 8, 'Partner holds the heels', 3]);
  const w9 = effectivePrescription(nordic, null, 9);
  assert.deepEqual([w9.sets, w9.repsMax, w9.note], [3, 12, 'Sets of 12, 10 and 8 reps']);
});

test('cycles repeat the week steps (5/3/1 waves) and deload weeks reduce volume', () => {
  assert.deepEqual([1, 4, 5, 8, 9].map((wk) => cycleWeek({ cycleWeeks: 4 }, wk)), [1, 4, 1, 4, 1]);
  assert.equal(cycleWeek({ cycleWeeks: null }, 7), 7);
  const main = { exerciseId: 68, trackingType: 'WeightReps' as const, sets: 3, repsMin: 5, repsMax: 5, percentOf1Rm: 77,
    weekSteps: [{ fromWeek: 2, repsMin: 3, repsMax: 3, percentOf1Rm: 81 }, { fromWeek: 4, percentOf1Rm: 54 }] };
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((wk) => effectivePrescription(main, { cycleWeeks: 4 }, wk).percentOf1Rm), [77, 81, 81, 54, 77, 81]);

  assert.deepEqual([3, 4, 8].map((wk) => isDeloadWeek({ deloadEvery: 4 }, wk)), [false, true, true]);
  const bench = { exerciseId: 1, trackingType: 'WeightReps' as const, sets: 4, repsMin: 6, repsMax: 8, targetRpe: 8, progressionStep: 2.5 };
  const deload = effectivePrescription(bench, { deloadEvery: 4 }, 4);
  assert.deepEqual([deload.deload, deload.sets, deload.targetRpe], [true, 3, 6]);
  assert.equal(effectivePrescription(bench, { deloadEvery: 4 }, 5).sets, 4);
});

test('percent-based targets use the best recent estimated 1RM, deload takes 10 % off', () => {
  const now = new Date('2026-10-29T10:00:00Z');
  const history = [w('2026-10-20T10:00:00Z', null, [set(68, 60, 5), set(68, 40, 12, { isWarmup: true })]), w('2026-01-01T10:00:00Z', null, [set(68, 100, 1)])];
  assert.equal(bestRecentE1RM(68, history, now), 70, 'Epley 60 × 5 = 70; old and warm-up sets ignored');
  const px = { exerciseId: 68, trackingType: 'WeightReps' as const, sets: 3, repsMin: 5, repsMax: 5, percentOf1Rm: 77 };
  const target = suggestTarget(px, history, now);
  assert.deepEqual([target.kind, target.weight, target.reps, target.noteKey], ['percent', 55, 5, 'percent']);
  assert.equal(suggestTarget(px, [], now).noteKey, 'percentNoMax');

  const dp = { exerciseId: 1, trackingType: 'WeightReps' as const, sets: 3, repsMin: 5, repsMax: 8, progressionStep: 2.5, deload: true };
  const last = [w('2026-10-25T10:00:00Z', null, [set(1, 80, 6), set(1, 80, 6), set(1, 80, 6)])];
  const easy = suggestTarget(dp, last, now);
  assert.deepEqual([easy.kind, easy.weight], ['deload', 72.5]);
  assert.ok(prescriptionText({ ...px, restSeconds: 180 }).includes('77 %'));
});

test('editor keeps week steps, percent and notes through a round-trip and drops empty steps', () => {
  const program = {
    id: 3, name: 'Waves', goal: 'Strength', weeks: 12, cycleWeeks: 4, deloadEvery: null, isActive: true, startedAt: null, createdAt: '', templateKey: null,
    days: [{ id: 30, position: 0, name: 'Press', notes: null, exercises: [{ id: 1, position: 0, exerciseId: 68, sets: 3, repsMin: 5, repsMax: 5, percentOf1Rm: 77, note: 'AMRAP', weekSteps: [{ fromWeek: 2, percentOf1Rm: 81 }] }] }],
  } as unknown as TrainingProgram;
  const draft = toDraft(program);
  const row = draft.days[0].exercises[0];
  row.weekSteps!.push(newDraftStep(row, 4), { fromWeek: '' });
  const payload = draftToPayload(draft, new Map([[68, { trackingType: 'WeightReps' }]]));
  assert.equal(payload.cycleWeeks, 4);
  const x = payload.days[0].exercises[0];
  assert.deepEqual([x.percentOf1Rm, x.note, x.weekSteps!.map((st) => st.fromWeek)], [77, 'AMRAP', [2, 3]]);
  assert.equal(x.weekSteps![0].percentOf1Rm, 81);
});
