import { describe, expect, it } from 'vitest';
import { indexByDay, levelOf, maxScoreOf, monthGrid, monthStats, plannedKind, sessionsPerMonth, yearStats, yearsWithData } from '@/lib/calendar';
import type { Workout } from '@/types';

const gym = (date: string, sets = 4, min = 60): Workout => ({
  date, workoutType: 'Gym', durationSeconds: min * 60, sessionRpe: 7,
  sets: Array.from({ length: sets }, () => ({ exerciseId: 1, weight: 100, reps: 5 })),
} as Workout);
const match = (date: string): Workout => ({ date, workoutType: 'Match', durationSeconds: 90 * 60, sessionRpe: 8, sets: [] } as Workout);

describe('Kalender', () => {
  const workouts = [gym('2026-03-02T18:00:00'), gym('2026-03-03T18:00:00', 8), match('2026-03-03T11:00:00'), gym('2026-03-05T23:30:00'), gym('2025-12-30T10:00:00', 2, 30)];
  const index = indexByDay(workouts);

  it('gruppiert nach lokalem Tag mit Arten, Minuten und Volumen', () => {
    const d = index.get('2026-03-03')!;
    expect(d.sessions).toBe(2);
    expect(d.kinds).toEqual(['Match', 'Gym']); // Spiel zuerst
    expect(d.minutes).toBe(150);
    expect(d.sets).toBe(8);
    expect(d.volume).toBe(4000);
    expect(d.workouts[0]!.workoutType).toBe('Match'); // chronologisch (11:00 vor 18:00)
    expect(index.has('2026-03-05')).toBe(true); // 23:30 bleibt am selben Tag
  });

  it('Stufen relativ zum stärksten Tag, jeder Trainingstag mindestens 1', () => {
    const max = maxScoreOf(index);
    expect(levelOf(index.get('2026-03-03'), max)).toBe(4);
    expect(levelOf(index.get('2025-12-30'), max)).toBe(1);
    expect(levelOf(undefined, max)).toBe(0);
  });

  it('Monatsraster: immer 42 Tage ab Montag, Monatstage markiert', () => {
    const grid = monthGrid(2026, 2); // März 2026 beginnt an einem Sonntag
    expect(grid).toHaveLength(42);
    expect(grid[0]!.key).toBe('2026-02-23');
    expect(grid[0]!.weekday).toBe(0);
    expect(grid[6]!.key).toBe('2026-03-01');
    expect(grid.filter((c) => c.inMonth)).toHaveLength(31);
  });

  it('Monats- und Jahreszahlen inklusive längster Serie', () => {
    const m = monthStats(index, 2026, 2);
    expect(m).toMatchObject({ sessions: 4, activeDays: 3, matches: 1, bestStreak: 2, minutes: 270 });
    expect(yearStats(index, 2025)).toMatchObject({ sessions: 1, activeDays: 1 });
    expect(sessionsPerMonth(index, 2026)[2]).toBe(4);
    expect(yearsWithData(index, new Date(2026, 10, 6))).toEqual([2025, 2026]);
  });

  it('Vorschau aus dem Wochenplan (Mo = Bit 1, So = Bit 64)', () => {
    const s = { trainingDays: 1 | 4, matchDays: 64 };
    expect(plannedKind(s, new Date(2026, 10, 9))).toBe('training'); // Montag
    expect(plannedKind(s, new Date(2026, 10, 15))).toBe('match'); // Sonntag
    expect(plannedKind(s, new Date(2026, 10, 10))).toBe('rest');
    expect(plannedKind(null, new Date())).toBe('rest');
  });
});
