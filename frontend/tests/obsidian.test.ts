import { describe, expect, test } from 'vitest';
import { dvText, inferPart, inferSessionCode, obsidianLines, obsidianText, rirOf } from '../src/lib/obsidian';
import type { Workout, WorkoutSet } from '../src/types';

const MUSCLE: Record<number, string> = { 1: 'Chest', 35: 'Legs', 44: 'Back', 68: 'Shoulders', 12: 'Cardio', 57: 'Agility', 200: 'Mobility' };
const NAME: Record<number, string> = { 1: 'Жим штанги лёжа', 35: 'Присед со штангой', 44: 'Тяга верхнего блока', 12: 'Бег / спринты' };
const opts = {
  nameOf: (s: WorkoutSet) => NAME[s.exerciseId!] ?? s.exerciseName ?? '?',
  muscleOf: (s: WorkoutSet) => MUSCLE[s.exerciseId!],
  categoryOf: (s: WorkoutSet) => (s.exerciseId === 12 || s.exerciseId === 57 || s.exerciseId === 200 ? 'Football' : 'Gym'),
  describe: (s: WorkoutSet) => `${s.distance} м / ${s.time} с`,
};

const gym: Workout = {
  id: 1, date: '2026-10-29T18:00:00Z', workoutType: 'Gym', durationSeconds: 75 * 60, sessionRpe: 8, quality: 7, notes: 'Сильный день [PR]',
  sets: [
    { exerciseId: 1, weight: 50, reps: 8, isWarmup: true },
    { exerciseId: 1, weight: 80, reps: 5, rpe: 8 },
    { exerciseId: 1, weight: 80, reps: 5, rpe: 8 },
    { exerciseId: 1, weight: 82.5, reps: 3, rpe: 9.5, note: 'спот' },
    { exerciseId: 44, weight: 60, reps: 10 },
    { exerciseId: 68, weight: 40, reps: 8 },
  ],
};

describe('obsidian export', () => {
  test('session line with ses/min/rpe/qual/part and sanitized comment', () => {
    const [head] = obsidianLines(gym, opts);
    expect(head).toBe('- [ses:: gym] [min:: 75] [rpe:: 8] [qual:: 7] [part:: push] Сильный день (PR)');
  });

  test('lift lines: warm-ups skipped, equal sets merged, decimal point, RIR from RPE, set note kept', () => {
    const lines = obsidianLines(gym, opts).slice(1);
    expect(lines).toEqual([
      '- [lift:: Жим штанги лёжа] [kg:: 80] [reps:: 5] [sets:: 2] [rir:: 2]',
      '- [lift:: Жим штанги лёжа] [kg:: 82.5] [reps:: 3] [sets:: 1] [rir:: 0.5] спот',
      '- [lift:: Тяга верхнего блока] [kg:: 60] [reps:: 10] [sets:: 1] [rir:: ]',
      '- [lift:: ?] [kg:: 40] [reps:: 8] [sets:: 1] [rir:: ]',
    ]);
  });

  test('warm-ups can be included on request and are marked', () => {
    const lines = obsidianLines(gym, { ...opts, includeWarmups: true, warmupLabel: 'разминка' });
    expect(lines[1]).toBe('- [lift:: Жим штанги лёжа] [kg:: 50] [reps:: 8] [sets:: 1] [rir:: ] разминка');
  });

  test('every value stays inside its brackets (vault parser rule)', () => {
    for (const line of obsidianLines(gym, opts)) {
      expect(line.startsWith('- ')).toBe(true);
      expect(line).not.toMatch(/\]\s*\d/); // kein Wert außerhalb der Klammer
    }
  });

  test('match: ses match, opponent in the comment, no lift lines', () => {
    const match: Workout = { id: 2, date: '2026-10-25T13:00:00Z', workoutType: 'Match', durationSeconds: 90 * 60, sessionRpe: 9, quality: 6, sets: [], match: { opponent: 'FC Neu-Ulm' } };
    expect(obsidianLines(match, opts)).toEqual(['- [ses:: match] [min:: 90] [rpe:: 9] [qual:: 6] vs FC Neu-Ulm']);
  });

  test('field session: speed by default, sprints as plain text without fields', () => {
    const field: Workout = { id: 3, date: '2026-10-27T17:00:00Z', workoutType: 'Football', durationSeconds: null, sessionRpe: null,
      sets: [{ exerciseId: 12, distance: 30, time: 4.1 }, { exerciseId: 12, distance: 30, time: 4.03 }] };
    expect(inferSessionCode(field, opts)).toBe('speed');
    expect(obsidianLines(field, opts)).toEqual([
      '- [ses:: speed] [min:: ] [rpe:: ] [qual:: ]',
      '- Бег / спринты: 30 м / 4.1 с, 30 м / 4.03 с',
    ]);
  });

  test('body part detection', () => {
    const m = (s: WorkoutSet) => MUSCLE[s.exerciseId!];
    expect(inferPart([{ exerciseId: 35, weight: 100, reps: 5 }, { exerciseId: 35, weight: 100, reps: 5 }], m)).toBe('legs');
    expect(inferPart([{ exerciseId: 35, weight: 100, reps: 5 }, { exerciseId: 1, weight: 80, reps: 5 }], m)).toBe('full');
    expect(inferPart([{ exerciseId: 1, weight: 80, reps: 5 }, { exerciseId: 68, weight: 40, reps: 8 }], m)).toBe('push');
    expect(inferPart([{ exerciseId: 44, weight: 60, reps: 10 }], m)).toBe('pull');
  });

  test('whole day is sorted by time; per-workout session codes', () => {
    const morning: Workout = { ...gym, id: 9, date: '2026-10-29T08:00:00Z', sets: [{ exerciseId: 200, time: 600 }] };
    const text = obsidianText([gym, morning], { ...opts, fieldAsText: false, sesFor: (w) => (w.id === 9 ? 'recov' : undefined) });
    expect(text.split('\n')[0]).toContain('[ses:: recov]');
    expect(text).toContain('[ses:: gym]');
  });

  test('helpers', () => {
    expect(rirOf(8.5)).toBe(1.5);
    expect(rirOf(null)).toBeNull();
    expect(dvText('a::b [x]')).toBe('a:b (x)');
  });
});
