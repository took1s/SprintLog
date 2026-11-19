import { describe, expect, test } from 'vitest';
import { bit, cycleDay, hasSchedule, isTeamDay, kindOf, nextDayOf, scheduleWarnings, suggestTrainingDays, toggleTeamDay, type Schedule } from '../src/lib/schedule';
import { estimateRecovery, recoveryStatus } from '../src/lib/recovery';
import type { Workout } from '../src/types';

const SUN = bit(6);

describe('weekly schedule', () => {
  test('tap cycles rest -> training -> match -> rest', () => {
    let s = { trainingDays: 0, matchDays: 0 };
    s = cycleDay(s, 0); expect(kindOf(s, 0)).toBe('training');
    s = cycleDay(s, 0); expect(kindOf(s, 0)).toBe('match');
    s = cycleDay(s, 0); expect(kindOf(s, 0)).toBe('rest');
  });

  test('suggestion spreads sessions and keeps the match and the days around it free', () => {
    const three = suggestTrainingDays(3, SUN);
    expect(three & SUN).toBe(0);
    expect(three & bit(5)).toBe(0); // Samstag vor dem Spiel frei
    expect(three & bit(0)).toBe(0); // Montag nach dem Spiel frei
    expect([0, 1, 2, 3, 4, 5, 6].filter((d) => three & bit(d))).toEqual([1, 3, 4]);
    expect([0, 1, 2, 3, 4, 5, 6].filter((d) => suggestTrainingDays(3) & bit(d))).toEqual([0, 2, 4]);
    expect([0, 1, 2, 3, 4, 5, 6].filter((d) => suggestTrainingDays(2) & bit(d)).length).toBe(2);
  });

  test('warnings: training the day before or after a match, no rest day', () => {
    expect(scheduleWarnings({ trainingDays: bit(5) | bit(0), matchDays: SUN })).toEqual(expect.arrayContaining(['beforeMatch', 'afterMatch']));
    expect(scheduleWarnings({ trainingDays: 127 & ~SUN, matchDays: SUN })).toContain('noRest');
    expect(scheduleWarnings({ trainingDays: bit(1) | bit(3), matchDays: SUN })).toEqual([]);
  });

  test('team days: own layer, may double a training day, never on a match day', () => {
    let s: Schedule = { trainingDays: bit(1), matchDays: SUN, teamDays: 0 };
    s = toggleTeamDay(s, 1); expect(isTeamDay(s, 1)).toBe(true); expect(kindOf(s, 1)).toBe('training'); // Doppeltag
    s = toggleTeamDay(s, 6); expect(isTeamDay(s, 6)).toBe(false);                                       // Spieltag: nicht möglich
    s = toggleTeamDay(s, 3); expect(isTeamDay(s, 3)).toBe(true);
    // Tag wird zum Spieltag -> Team-Tag fällt weg
    s = cycleDay(cycleDay(s, 3), 3);
    expect(kindOf(s, 3)).toBe('match'); expect(isTeamDay(s, 3)).toBe(false); expect(isTeamDay(s, 1)).toBe(true);
    expect(hasSchedule({ trainingDays: 0, matchDays: 0, teamDays: bit(2) })).toBe(true);
    // Team-Tage zählen als belegt (keine Ruhe)
    expect(scheduleWarnings({ trainingDays: bit(0) | bit(2) | bit(4), matchDays: SUN, teamDays: bit(1) | bit(3) | bit(5) })).toContain('noRest');
  });

  test('next training day from a date', () => {
    const wed = new Date(2026, 10, 4); // Mi 4.11.2026
    const next = nextDayOf({ trainingDays: bit(4), matchDays: 0 }, 'training', wed)!;
    expect(next.getDate()).toBe(6); // Fr
  });
});

describe('recovery estimate', () => {
  const legs = (n: number, rpe: number) => Array.from({ length: n }, () => ({ muscleGroup: 'Legs', trackingType: 'WeightReps', reps: 5, rpe }));

  test('team training without sets: legs and system by duration and sRPE', () => {
    const hard = estimateRecovery([], { kind: 'Team', sessionRpe: 8, durationMin: 100 });
    const easy = estimateRecovery([], { kind: 'Team', sessionRpe: 3, durationMin: 60 });
    expect(hard.hours.legs).toBeGreaterThan(easy.hours.legs);
    expect(hard.hours.legs).toBeLessThanOrEqual(48);
    expect(easy.hours.legs).toBeGreaterThanOrEqual(12);
    expect(hard.main).not.toBeNull();
  });

  test('more hard sets and higher RPE need more time; easy work very little', () => {
    const heavy = estimateRecovery(legs(8, 9.5)).hours.legs;
    const light = estimateRecovery(legs(3, 6)).hours.legs;
    expect(heavy).toBeGreaterThan(light);
    expect(heavy).toBeLessThanOrEqual(84);
    expect(light).toBeGreaterThanOrEqual(18);
  });

  test('a full match counts 48-72 h for the legs and the whole body', () => {
    const r = estimateRecovery([], { kind: 'Match', durationMin: 90, sessionRpe: 8 });
    expect(r.hours.legs).toBeGreaterThanOrEqual(48);
    expect(r.hours.legs).toBeLessThanOrEqual(72);
    expect(r.main).toBe('legs');
  });

  test('sprint sessions load the nervous system', () => {
    const sprints = Array.from({ length: 8 }, () => ({ muscleGroup: 'Speed', trackingType: 'DistanceTime', distance: 30, time: 4.2 }));
    expect(estimateRecovery(sprints).hours.system).toBe(36);
  });

  test('status: percent recovered and ready time from recent workouts', () => {
    const now = new Date('2026-11-04T18:00:00Z');
    const w: Workout[] = [{ id: 1, date: '2026-11-03T18:00:00Z', durationSeconds: 3600, workoutType: 'Gym', sets: Array.from({ length: 6 }, () => ({ exerciseId: 35, reps: 5, rpe: 8 })) }];
    const [s] = recoveryStatus(w, () => ({ muscleGroup: 'Legs', trackingType: 'WeightReps' }), now);
    expect(s.region).toBe('legs');
    expect(s.percent).toBeGreaterThan(0);
    expect(s.percent).toBeLessThan(100);
    expect(s.readyAt.getTime()).toBeGreaterThan(now.getTime());
  });
});
