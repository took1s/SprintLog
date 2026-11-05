import { describe, expect, test } from 'vitest';
import { AI_CONTEXT_MAX, buildAiContext, type AiContextInput } from '../src/lib/aiContext';
import type { Workout } from '../src/types';

const now = new Date('2026-11-06T18:30:00');
const names: Record<number, string> = { 1: 'Bench Press', 12: 'Running / Sprints', 47: 'Plank' };
const workout = (date: string, sets: Workout['sets'], extra: Partial<Workout> = {}): Workout => ({ date, workoutType: 'Gym', sets, ...extra });

const base: AiContextInput = {
  now,
  program: { name: 'Hamstring Rehab 1', goal: 'Rehab', week: 2, weeks: 4, nextDay: 'Day B', days: [{ name: 'Day A', exercises: ['Nordic 3x5'] }] },
  schedule: { training: [0, 2, 4], match: [6] },
  coach: { kind: 'rest', reasons: ['restDay', 'rehabRest'] },
  recovery: [{ region: 'legs', percent: 62, readyAt: new Date('2026-11-07T08:00:00') }],
  load: { zone: 'optimal', ratio: 1.12, acute: 2300, chronic: 2050 },
  readiness: 72,
  wellness: [{ date: '2026-11-06', sleep: 4, energy: 3, soreness: 2, mood: 4, sleepHours: 7.5 }],
  workouts: [
    workout('2026-11-04T17:00:00', [
      { exerciseId: 1, weight: 60, reps: 10, isWarmup: true },
      { exerciseId: 1, weight: 80, reps: 8, rpe: 8 },
      { exerciseId: 1, weight: 85, reps: 6 },
      { exerciseId: 12, distance: 30, time: 4.4 },
      { exerciseId: 12, distance: 30, time: 4.2 },
      { exerciseId: 47, time: 45 },
    ], { durationSeconds: 3720, sessionRpe: 7 }),
    workout('2026-09-01T17:00:00', [{ exerciseId: 1, weight: 70, reps: 8 }]),
  ],
  exerciseName: (s) => names[s.exerciseId ?? 0] ?? 'Exercise',
  goals: [{ exercise: 'Bench Press', target: '100 kg x1', percent: 64, achieved: false }],
};

describe('AI context', () => {
  test('contains plan, coach, recovery, load, wellness, goals and compact workouts', () => {
    const c = buildAiContext(base);
    expect(c).toContain('Today: 2026-11-06 (Fri)');
    expect(c).toContain('Week plan: Mon training, Tue rest, Wed training, Thu rest, Fri training, Sat rest, Sun match. Today is a training day.');
    expect(c).toContain('"Hamstring Rehab 1" (goal Rehab), week 2 of 4, next day: "Day B"');
    expect(c).toContain('App coach today (rule-based): rest - restDay; rehabRest.');
    expect(c).toContain('legs 62% (ready Sat 08:00)');
    expect(c).toContain('acute:chronic ratio 1.12 (optimal)');
    expect(c).toContain('sleep 4 (7.5 h), energy 3, muscles 2, mood 4');
    expect(c).toContain('Bench Press 100 kg x1 - 64%');
    // Aufwärmsätze weg, Sprints kompakt, Planke als Zeit
    expect(c).toContain('- 2026-11-04 Wed, Gym, 62 min, session RPE 7: Bench Press 80x8 @8, 85x6; Running / Sprints 2x 30 m, best 4.2 s; Plank 1x 45 s');
    // Ältere Einheiten werden nur gezählt
    expect(c).toContain('Workouts in the last 28 days: 1 (plus 1 older ones not listed)');
    expect(c).not.toContain('70x8');
  });

  test('without program and schedule, and capped in size', () => {
    const many = Array.from({ length: 400 }, (_, i) => workout(new Date(now.getTime() - (i % 27) * 86_400_000).toISOString(),
      Array.from({ length: 12 }, () => ({ exerciseId: 1, weight: 80, reps: 8 }))));
    const c = buildAiContext({ ...base, program: null, schedule: null, workouts: many, goals: [] });
    expect(c).toContain('Week plan: not set.');
    expect(c).toContain('Active program: none.');
    expect(c.length).toBeLessThanOrEqual(AI_CONTEXT_MAX);
    expect(c).toContain('(older workouts omitted)');
  });
});
