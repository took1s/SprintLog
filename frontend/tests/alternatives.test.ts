import { describe, expect, test } from 'vitest';
import { alternativesFor, needsBall } from '../src/lib/alternatives';
import type { Exercise } from '../src/types';

const ex = (id: number, name: string, category: string, muscleGroup: string, trackingType: Exercise['trackingType'] = 'WeightReps'): Exercise =>
  ({ id, name, category, muscleGroup, trackingType, isCustom: false } as Exercise);

const catalog = [
  ex(1, 'Passing Drill', 'Football', 'Technique', 'Duration'),
  ex(2, 'Dribbling Drill', 'Football', 'Technique', 'Duration'),
  ex(3, 'Agility Ladder', 'Football', 'Technique', 'Duration'),
  ex(4, 'Bench Press', 'Gym', 'Chest'),
  ex(5, 'Medicine Ball Slam', 'Football', 'Power'),
  ex(6, 'Shadow Footwork', 'Football', 'Technique', 'Duration'),
];

describe('exercise alternatives', () => {
  test('ball detection ignores medicine balls', () => {
    expect(needsBall(catalog[0])).toBe(true);
    expect(needsBall(catalog[4])).toBe(false);
    expect(needsBall(catalog[3])).toBe(false);
  });

  test('without a ball: same muscle group and tracking first, ball drills last or out', () => {
    const alts = alternativesFor(catalog[0], catalog).map((a) => a.exercise.id);
    expect(alts.slice(0, 2).sort()).toEqual([3, 6]);
    expect(alts).not.toContain(4);
    expect(alts.indexOf(2)).toBe(-1);
  });

  test('excluded exercises (already in the workout) are not suggested; familiar ones rank up', () => {
    const alts = alternativesFor(catalog[0], catalog, { exclude: new Set([3]), used: (id) => (id === 6 ? 10 : 0) });
    expect(alts[0].exercise.id).toBe(6);
    expect(alts[0].reasons).toContain('familiar');
    expect(alts.map((a) => a.exercise.id)).not.toContain(3);
  });

  test('same movement pattern ranks first (press before fly)', () => {
    const ex = (id: number, name: string) => ({ id, name, category: 'Gym', muscleGroup: 'Chest', trackingType: 'WeightReps', isCustom: false }) as Exercise;
    const list = [ex(1, 'Bench Press'), ex(2, 'Cable Crossover'), ex(3, 'Dumbbell Bench Press'), ex(4, 'Push-ups')];
    const r = alternativesFor(list[0], list);
    expect(r.map((x) => x.exercise.id)).toEqual([3, 4, 2]);
    expect(r[0].reasons).toContain('pattern');
  });
});
