import { describe, expect, it } from 'vitest';
import { avgAt, proteinLeft, rateTone, weeklyRate } from '../src/lib/nutrition';
import { groupByWeek, matchesSearch, mondayOf } from '../src/lib/historyGroups';
import { roundGate, type Routine } from '../src/lib/routines';
import type { Workout } from '../src/types';

const day = (n: number) => { const d = new Date(2026, 10, 16 + n, 12); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

describe('Gewicht und Eiweiß', () => {
  const logs = Array.from({ length: 14 }, (_, i) => ({ day: day(-13 + i), weightKg: 78 - i * 0.1 }));
  it('7-Tage-Mittel und Wochenrate', () => {
    expect(avgAt(logs, day(0))).toBe(77);
    expect(weeklyRate(logs, day(0))).toBe(-0.7);
    expect(weeklyRate(logs.slice(-5), day(0))).toBeNull(); // zu wenig Messungen in der Vorwoche
  });
  it('Einordnung: stabil, Zunahme, zu schnell (> 1 % pro Woche)', () => {
    expect(rateTone(0.1, 76)).toBe('stable');
    expect(rateTone(0.4, 76)).toBe('gain');
    expect(rateTone(-0.9, 76)).toBe('fast');
    expect(rateTone(null, 76)).toBeNull();
  });
  it('Eiweiß: Rest und Mahlzeiten', () => {
    expect(proteinLeft(40, 135)).toEqual({ grams: 95, meals: 3 });
    expect(proteinLeft(150, 135)).toEqual({ grams: 0, meals: 0 });
    expect(proteinLeft(10, null)).toBeNull();
  });
});

describe('Verlauf nach Wochen', () => {
  const w = (date: Date, p: Partial<Workout> = {}): Workout => ({ id: Math.random(), date: date.toISOString(), workoutType: 'Gym', durationSeconds: 3600, sessionRpe: 6, sets: [{ exerciseId: 1, exerciseName: 'Bench Press', isWarmup: false }], ...p } as Workout);
  it('Montag als Wochenanfang, Kennzahlen je Woche', () => {
    expect(mondayOf(new Date(2026, 10, 22, 20)).getDate()).toBe(16); // Sonntag -> Montag davor
    const g = groupByWeek([w(new Date(2026, 10, 18, 18)), w(new Date(2026, 10, 16, 9), { sessionRpe: 8, durationSeconds: 1800 }), w(new Date(2026, 10, 14, 10))]);
    expect(g.map((x) => x.workouts.length)).toEqual([2, 1]);
    expect(g[0]).toMatchObject({ minutes: 90, load: 6 * 60 + 8 * 30, sets: 2 });
  });
  it('Suche: alle Wörter, ohne Groß/Klein, auch Gegner und Notizen', () => {
    const match = w(new Date(), { workoutType: 'Match', sets: [], match: { goals: 1, assists: 0, opponent: 'TSV Pfuhl' }, notes: 'Regen' });
    const name = (_id: number | null, fallback?: string) => fallback ?? '';
    expect(matchesSearch(match, 'pfuhl', name)).toBe(true);
    expect(matchesSearch(match, 'pfuhl regen', name)).toBe(true);
    expect(matchesSearch(match, 'pfuhl sonne', name)).toBe(false);
    expect(matchesSearch(w(new Date()), 'BENCH', name)).toBe(true);
  });
});

describe('Durchgänge nach Tageszeit', () => {
  const r = { timesPerDay: 3, times: ['08:00', '13:00', '20:00'], doneDates: [] as string[], days: 127, startDate: day(-5), endDate: null } as unknown as Routine;
  it('Morgen offen ab 07:15, Mittag erst ab 12:15', () => {
    expect(roundGate(r, day(0), '07:00')).toMatchObject({ k: 1, open: false, opensAt: '07:15' });
    expect(roundGate(r, day(0), '09:00')).toMatchObject({ k: 1, open: true });
    const one = { ...r, doneDates: [day(0)] };
    expect(roundGate(one, day(0), '09:00')).toMatchObject({ k: 2, time: '13:00', open: false, opensAt: '12:15' });
    expect(roundGate(one, day(0), '12:20')).toMatchObject({ k: 2, open: true });
    expect(roundGate({ ...r, doneDates: [day(0), day(0), day(0)] }, day(0), '21:00')).toBeNull();
  });
  it('Ohne Uhrzeit oder einmal täglich: immer offen', () => {
    expect(roundGate({ ...r, times: [] }, day(0), '06:00')).toMatchObject({ open: true });
    expect(roundGate({ ...r, timesPerDay: 1, times: ['20:00'] }, day(0), '06:00')).toMatchObject({ open: true });
  });
});
