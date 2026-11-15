// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildReport, healthOf, isFieldWorkout, matchWorkout, type WatchWorkout } from '../src/stores/health';
import type { Workout } from '../src/types';

const watch = (p: Partial<WatchWorkout>): WatchWorkout => ({ start: '2026-11-14T15:00:00Z', end: '2026-11-14T16:30:00Z', durationSeconds: 5400, activity: 'soccer', ...p });
const workout = (p: Partial<Workout>): Workout => ({ id: 1, date: '2026-11-14T15:10:00Z', workoutType: 'Football', sets: [], ...p } as Workout);

describe('Apple Health: Zuordnung und Angebote', () => {
  it('Uhr-Workout passt zur Einheit in ±90 min; Kraft nur zu Gym', () => {
    expect(matchWorkout(watch({}), [workout({})])?.id).toBe(1);
    expect(matchWorkout(watch({ start: '2026-11-14T18:00:00Z' }), [workout({})])).toBeNull();
    expect(matchWorkout(watch({ activity: 'strength' }), [workout({})])).toBeNull();
    expect(matchWorkout(watch({ activity: 'strength' }), [workout({ workoutType: 'Gym' })])?.id).toBe(1);
  });

  it('Angebot als Feld-Einheit: Fußball, Lauf und "Sonstiges" (z. B. Xiaomi), ab 20 min', () => {
    expect(isFieldWorkout(watch({}))).toBe(true);
    expect(isFieldWorkout(watch({ activity: 'other' }))).toBe(true);
    expect(isFieldWorkout(watch({ activity: 'running', durationSeconds: 15 * 60 }))).toBe(false);
    expect(isFieldWorkout(watch({ activity: 'walking' }))).toBe(false);
    expect(isFieldWorkout(watch({ activity: 'strength' }))).toBe(false);
  });

  it('Uhr-Werte ohne Lücken (fehlend = null)', () => {
    expect(healthOf(watch({ distanceM: 7800, avgHr: 152 }))).toEqual({ distanceM: 7800, avgHr: 152, maxHr: null, maxSpeedKmh: null, sprints: null });
  });

  it('Bericht zeigt, was die Uhr liefert (geschätzter Ruhepuls, Schlaf aus "im Bett", Tempo)', () => {
    const r = buildReport(
      [
        { day: '2026-11-13', sleepMinutes: 450, sleepInBed: true, restingHr: 52, restingHrEstimated: true, steps: 9000 },
        { day: '2026-11-14', sleepMinutes: 420, restingHr: 50, hrv: 70 },
      ],
      [watch({ source: 'Mi Fitness', avgHr: 150 }), watch({ activity: 'running', source: 'Mi Fitness', maxSpeedKmh: 27.1 })],
      ['Mi Fitness', 'iPhone'],
    );
    expect(r).toMatchObject({ nights: 2, sleepInBed: 1, rhrDays: 2, rhrEstimated: 1, hrvDays: 1, stepsDays: 1, workouts: 2, withHr: 1, withSpeed: 1 });
    expect(r.sources).toEqual(['Mi Fitness', 'iPhone']);
  });
});
