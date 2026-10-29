import { test } from 'vitest';
import assert from 'node:assert/strict';
import { toCsv } from '../src/lib/export';

test('CSV has BOM, header and one row per set with escaped values', () => {
  const csv = toCsv([{ id: 7, date: '2026-10-28T10:00:00Z', workoutType: 'Gym', durationSeconds: 3600, sets: [
    { exerciseName: 'Curl; "EZ"', muscleGroup: 'Arms', trackingType: 'WeightReps' as const, setNumber: 1, weight: 30, reps: 10 },
  ] }]);
  assert.ok(csv.startsWith('﻿date;workout_id'));
  const row = csv.split('\r\n')[1];
  assert.ok(row.includes('"Curl; ""EZ"""'));
  assert.ok(row.endsWith(';300;40;;;;yes'), row);
});
