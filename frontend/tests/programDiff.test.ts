import { describe, expect, test } from 'vitest';
import { programDiff } from '../src/lib/programDiff';
import type { ProgramDay } from '../src/types';

const current: ProgramDay[] = [
  { id: 1, position: 0, name: 'A', notes: null, exercises: [{ exerciseId: 10, sets: 3, repsMin: 5, repsMax: 5 }, { exerciseId: 11, sets: 3, repsMin: 8, repsMax: 10 }] },
  { id: 2, position: 1, name: 'B', notes: null, exercises: [{ exerciseId: 20, sets: 3, time: 30 }] },
  { id: 3, position: 2, name: 'C', notes: null, exercises: [{ exerciseId: 30, sets: 6, distance: 30 }] },
];

describe('program diff', () => {
  test('added, removed, changed, renamed, new and removed days', () => {
    const d = programDiff(current, [
      { id: 1, name: 'A', exercises: [{ exerciseId: 10, sets: 4, repsMin: 5, repsMax: 5 }, { exerciseId: 12, sets: 3, repsMin: 6 }] },
      { id: 2, name: 'B Core', exercises: [{ exerciseId: 20, sets: 3, time: 30 }] },
      { id: null, name: 'Sprint', exercises: [{ exerciseId: 30, sets: 6, distance: 30 }] },
    ]);
    expect(d.map((x) => [x.name, x.status])).toEqual([['A', 'changed'], ['B Core', 'changed'], ['Sprint', 'new'], ['C', 'removed']]);
    expect(d[0].changed).toEqual([{ from: current[0].exercises[0], to: { exerciseId: 10, sets: 4, repsMin: 5, repsMax: 5 } }]);
    expect(d[0].added.map((x) => x.exerciseId)).toEqual([12]);
    expect(d[0].removed.map((x) => x.exerciseId)).toEqual([11]);
    expect(d[1].renamedFrom).toBe('B');
    expect(d[1].added).toEqual([]);
  });

  test('unchanged day is "same"; repsMax defaults to repsMin', () => {
    const d = programDiff(current.slice(0, 1), [{ id: 1, name: 'A', exercises: [{ exerciseId: 10, sets: 3, repsMin: 5 }, { exerciseId: 11, sets: 3, repsMin: 8, repsMax: 10 }] }]);
    expect(d[0].status).toBe('same');
  });
});
