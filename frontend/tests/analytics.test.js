import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  epley1RM, trackingOf, computeRecords, detectPRs, weeklyTotals, weekStreak, startOfWeek, dateKey,
  exerciseSeries, ChartMetric, muscleDistribution, inferWorkoutType, activityHeatmap, summarizeWorkout,
  groupSetsByExercise, percentChange, roundTo, lastSetFor,
} from '../../SprintLog.Api/wwwroot/js/analytics.js';

const bench = (weight, reps) => ({ exerciseId: 1, exerciseName: 'Bench Press', trackingType: 'WeightReps', muscleGroup: 'Chest', weight, reps });
const sprint = (distance, time) => ({ exerciseId: 12, exerciseName: 'Sprints', trackingType: 'DistanceTime', muscleGroup: 'Cardio', distance, time });
const workout = (id, date, sets) => ({ id, date, workoutType: 'Gym', sets });

test('epley1RM: 1 rep = weight, formula for 2-12 reps, none above 12', () => {
  assert.equal(epley1RM(100, 1), 100);
  assert.equal(epley1RM(100, 5), 116.7);
  assert.equal(epley1RM(100, 13), 0);
  assert.equal(epley1RM(0, 5), 0);
  assert.equal(epley1RM(100, 0), 0);
});

test('trackingOf infers type for legacy sets without trackingType', () => {
  assert.equal(trackingOf({ weight: 50, reps: 5 }), 'WeightReps');
  assert.equal(trackingOf({ distance: 30, time: 4 }), 'DistanceTime');
  assert.equal(trackingOf({ time: 60 }), 'Duration');
  assert.equal(trackingOf({ trackingType: 'Duration', weight: 10 }), 'Duration');
});

test('computeRecords keeps best values and the date they were set', () => {
  const records = computeRecords([
    workout(2, '2026-10-10T10:00:00Z', [bench(90, 5), sprint(30, 4.0)]),
    workout(1, '2026-10-01T10:00:00Z', [bench(80, 10), sprint(30, 4.5)]),
  ]);
  const b = records.get('id:1');
  assert.equal(b.maxWeight.value, 90);
  assert.equal(b.maxWeight.date, '2026-10-10T10:00:00Z');
  assert.equal(b.maxVolume.value, 800);
  assert.equal(b.sessions, 2);
  assert.equal(records.get('id:12').topSpeed.value, 7.5);
});

test('detectPRs flags only improvements over the previous best, never the first set', () => {
  const history = [
    workout(1, '2026-10-01T10:00:00Z', [bench(80, 5)]),
    workout(2, '2026-10-05T10:00:00Z', [bench(80, 5), bench(85, 3)]),
    workout(3, '2026-10-09T10:00:00Z', [bench(70, 10)]),
  ];
  const { badges, events } = detectPRs(history);
  assert.equal(badges.get('w:1#0'), undefined, 'first ever set is no PR');
  assert.equal(badges.get('w:2#0'), undefined, 'equal is no PR');
  assert.deepEqual(badges.get('w:2#1').map((b) => b.field), ['maxWeight']);
  assert.deepEqual(badges.get('w:3#0').map((b) => b.field), ['maxVolume']);
  assert.equal(events[0].field, 'maxVolume', 'newest event first');
  assert.equal(events[0].key, 'id:1');
});

test('startOfWeek returns Monday (ISO week)', () => {
  assert.equal(dateKey(startOfWeek(new Date(2026, 9, 28))), '2026-10-26'); // Wed -> Mon
  assert.equal(dateKey(startOfWeek(new Date(2026, 10, 1))), '2026-10-26'); // Sun -> Mon
  assert.equal(dateKey(startOfWeek(new Date(2026, 9, 26))), '2026-10-26'); // Mon -> Mon
});

test('weeklyTotals buckets workouts into weeks and weekStreak counts consecutive weeks', () => {
  const now = new Date(2026, 9, 28, 12);
  const history = [
    workout(1, new Date(2026, 9, 27, 18).toISOString(), [bench(100, 5)]),
    workout(2, new Date(2026, 9, 20, 18).toISOString(), [bench(100, 4)]),
    workout(3, new Date(2026, 9, 6, 18).toISOString(), [bench(100, 3)]),
  ];
  const weeks = weeklyTotals(history, 4, now);
  assert.deepEqual(weeks.map((w) => w.volume), [300, 0, 400, 500]);
  assert.equal(weekStreak(history, now), 2);
  // Läuft die aktuelle Woche noch ohne Training, zählt die Serie trotzdem ab letzter Woche
  assert.equal(weekStreak(history.slice(1), now), 1);
});

test('exerciseSeries returns one chronological value per workout', () => {
  const history = [
    workout(2, '2026-10-10T10:00:00Z', [sprint(30, 4.2), sprint(30, 4.0)]),
    workout(1, '2026-10-01T10:00:00Z', [sprint(30, 4.5)]),
  ];
  assert.deepEqual(exerciseSeries(history, 'id:12', ChartMetric.BestTime).map((p) => p.value), [4.5, 4]);
  assert.deepEqual(exerciseSeries(history, 'id:12', ChartMetric.TopSpeed).map((p) => p.value), [24, 27]);
});

test('muscleDistribution counts sets in the time window', () => {
  const now = new Date('2026-10-28T12:00:00Z');
  const dist = muscleDistribution([
    workout(1, '2026-10-20T10:00:00Z', [bench(80, 5), bench(80, 5), sprint(30, 4)]),
    workout(2, '2026-08-01T10:00:00Z', [bench(80, 5)]),
  ], 30, now);
  assert.deepEqual(dist.map((d) => [d.group, d.sets]), [['Chest', 2], ['Cardio', 1]]);
});

test('inferWorkoutType uses categories, falls back to metrics', () => {
  assert.equal(inferWorkoutType([{ category: 'Gym' }, { category: 'Football' }]), 'Hybrid');
  assert.equal(inferWorkoutType([{ category: 'Football' }]), 'Football');
  assert.equal(inferWorkoutType([{ category: 'Gym' }]), 'Gym');
  assert.equal(inferWorkoutType([{ distance: 30, time: 4 }]), 'Football');
});

test('activityHeatmap builds full weeks and marks future days', () => {
  const now = new Date(2026, 9, 28, 12); // Mittwoch
  const { columns } = activityHeatmap([workout(1, new Date(2026, 9, 27, 18).toISOString(), [bench(1, 1)])], 4, now);
  assert.equal(columns.length, 4);
  assert.ok(columns.every((c) => c.length === 7));
  const last = columns[3];
  assert.equal(last[1].level, 4);           // Dienstag trainiert
  assert.equal(last[3].future, true);       // Donnerstag liegt in der Zukunft
});

test('helpers', () => {
  assert.equal(summarizeWorkout({ sets: [bench(50, 10), sprint(30, 4)] }).volume, 500);
  assert.equal(groupSetsByExercise([bench(1, 1), sprint(1, 1), bench(2, 2)])[0].sets.length, 2);
  assert.equal(percentChange(110, 100), 10);
  assert.equal(percentChange(5, 0), null);
  assert.equal(roundTo(71.2, 2.5), 70);
  assert.equal(lastSetFor([workout(1, '2026-10-01', [bench(60, 8), bench(65, 6)])], 'id:1').weight, 65);
});

test('warm-up sets are ignored for records, PRs, volume and series', async () => {
  const { sessionLoad } = await import('../../SprintLog.Api/wwwroot/js/analytics.js');
  const warm = { ...bench(100, 10), isWarmup: true };
  const history = [
    workout(1, '2026-10-01T10:00:00Z', [bench(60, 5)]),
    workout(2, '2026-10-05T10:00:00Z', [warm, bench(65, 5)]),
  ];
  const r = computeRecords(history).get('id:1');
  assert.equal(r.maxWeight.value, 65, 'warm-up with 100 kg is not a record');
  const { badges } = detectPRs(history);
  assert.equal(badges.get('w:2#0'), undefined);
  assert.ok(badges.get('w:2#1'));
  const summary = summarizeWorkout(history[1]);
  assert.equal(summary.volume, 325);
  assert.equal(summary.warmups, 1);
  assert.deepEqual(exerciseSeries(history, 'id:1', ChartMetric.MaxWeight).map((p) => p.value), [60, 65]);
  assert.equal(sessionLoad({ sessionRpe: 7, durationSeconds: 3600 }), 420);
  assert.equal(sessionLoad({ sessionRpe: null, durationSeconds: 3600 }), 0);
});
