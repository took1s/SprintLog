import { describe, expect, it } from 'vitest';
import { computeRecords, exerciseSeries, metricsFor } from '@/lib/analytics';
import { exerciseTrends, inRange, matchesQuery, sortTrends, sparkPoints, summarize, usefulRanges } from '@/lib/progress';
import type { Workout } from '@/types';

const now = new Date(2026, 10, 6, 12);
const iso = (y: number, m: number, d: number) => new Date(y, m, d, 18).toISOString();
const bench = (date: string, weight: number, reps = 5): Workout =>
  ({ date, workoutType: 'Gym', sets: [{ exerciseId: 1, exerciseName: 'Bench', trackingType: 'WeightReps', weight, reps }] } as Workout);
const pullups = (date: string, reps: number[]): Workout =>
  ({ date, workoutType: 'Gym', sets: reps.map((r) => ({ exerciseId: 17, exerciseName: 'Pull-up', trackingType: 'WeightReps', weight: 0, reps: r })) } as Workout);
const sprint = (date: string, time: number): Workout =>
  ({ date, workoutType: 'Football', sets: [{ exerciseId: 12, exerciseName: 'Sprint', trackingType: 'DistanceTime', distance: 30, time }] } as Workout);

describe('Fortschritt', () => {
  const workouts = [
    bench(iso(2026, 2, 1), 80), bench(iso(2026, 8, 20), 90), bench(iso(2026, 9, 20), 95), bench(iso(2026, 10, 4), 92.5),
    pullups(iso(2026, 9, 1), [8, 6]), pullups(iso(2026, 10, 3), [10, 9, 7]),
    sprint(iso(2026, 9, 10), 4.4), sprint(iso(2026, 10, 2), 4.2),
  ];

  it('Zeiträume filtern ab dem gleichen Kalendertag', () => {
    const series = exerciseSeries(workouts, 'id:1', 'maxWeight');
    expect(inRange(series, 'all', now)).toHaveLength(4);
    expect(inRange(series, '1m', now).map((p) => p.value)).toEqual([95, 92.5]);
    expect(inRange(series, '3m', now).map((p) => p.value)).toEqual([90, 95, 92.5]);
    expect(usefulRanges(series, now)).toEqual(['1m', '3m', '6m', 'all']); // 1 Jahr zeigt dasselbe wie "alles"
    expect(usefulRanges([], now)).toEqual(['all']);
  });

  it('Zusammenfassung: Bestwert, Veränderung, letzter Schritt - bei Zeiten ist weniger besser', () => {
    const s = summarize(exerciseSeries(workouts, 'id:1', 'maxWeight'))!;
    expect(s.best.value).toBe(95);
    expect(s.change).toBe(16); // 80 -> 92,5
    expect(s.lastStep).toBe(-2.5);
    expect(s.latestIsBest).toBe(false);

    const t = summarize(exerciseSeries(workouts, 'id:12', 'bestTime'), true)!;
    expect(t.best.value).toBe(4.2);
    expect(t.change).toBe(5); // 4,4 -> 4,2 s = schneller = positiv
    expect(t.lastStep).toBe(0.2);
    expect(t.latestIsBest).toBe(true);
    expect(summarize([])).toBeNull();
  });

  it('Körpergewicht: Wiederholungen statt 0 kg', () => {
    expect(metricsFor('WeightReps', false).map((m) => m.key)).toEqual(['maxReps', 'totalReps']);
    expect(metricsFor('WeightReps').map((m) => m.key)).toContain('maxReps');
    expect(exerciseSeries(workouts, 'id:17', 'maxReps').map((p) => p.value)).toEqual([8, 10]);
    expect(exerciseSeries(workouts, 'id:17', 'totalReps').map((p) => p.value)).toEqual([14, 26]);
    expect(exerciseSeries(workouts, 'id:17', 'maxWeight')).toEqual([]);
  });

  it('Trendliste: passende Kennzahl je Übung, Mini-Linie, Sortierung', () => {
    const trends = exerciseTrends(computeRecords(workouts).values(), workouts, now);
    const by = Object.fromEntries(trends.map((t) => [t.key, t]));
    expect(by['id:1']!.metric.key).toBe('maxWeight');
    expect(by['id:1']!.recent).toEqual([80, 90, 95, 92.5]);
    expect(by['id:1']!.change).toBe(3); // letzte 90 Tage: 90 -> 92,5
    expect(by['id:17']!.metric.key).toBe('maxReps');
    expect(by['id:17']!.change).toBe(25);
    expect(by['id:12']!.metric.key).toBe('topSpeed');

    const name = (t: { record: { name?: string } }) => t.record.name ?? '';
    expect(sortTrends(trends, 'recent', name).map((t) => t.key)).toEqual(['id:1', 'id:17', 'id:12']);
    expect(sortTrends(trends, 'growth', name)[0]!.key).toBe('id:17');
    expect(sortTrends(trends, 'sessions', name)[0]!.key).toBe('id:1');
  });

  it('Kennzahl ohne Werte wird übersprungen (Weitsprung: Distanz statt Tempo)', () => {
    const jumps = [1, 2].map((d) => ({ date: iso(2026, 10, d), workoutType: 'Football', sets: [{ exerciseId: 70, exerciseName: 'Long jump', trackingType: 'DistanceTime', distance: 5 + d / 10 }] } as Workout));
    const [trend] = exerciseTrends(computeRecords(jumps).values(), jumps, now);
    expect(trend!.metric.key).toBe('distance');
    expect(trend!.recent).toEqual([5.1, 5.2]);
  });

  it('Mini-Linie bleibt im Feld, ein Wert liegt mittig', () => {
    expect(sparkPoints([1, 2, 3], 100, 20)).toBe('2,18 50,10 98,2');
    expect(sparkPoints([5], 100, 20)).toBe('50,10');
    expect(sparkPoints([4, 4], 100, 20)).toBe('2,10 98,10');
    expect(sparkPoints([], 100, 20)).toBe('');
  });

  it('Suche ohne Akzente und Groß/klein', () => {
    expect(matchesQuery('Bankdrücken', 'bankdruck')).toBe(true);
    expect(matchesQuery('Жим лёжа', 'ЖИМ')).toBe(true);
    expect(matchesQuery('Squat', '')).toBe(true);
    expect(matchesQuery('Squat', 'bench')).toBe(false);
  });
});
