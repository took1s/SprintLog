import { describe, expect, test } from 'vitest';
import { recommendPlans, scheduleFor } from '../src/lib/planBuilder';
import { bit, countDays } from '../src/lib/schedule';
import type { ProgramTemplate } from '../src/types';

const tpl = (key: string, goal: string, level: string, sessionsPerWeek: number, category = 'Gym'): ProgramTemplate =>
  ({ key, name: key, goal, level, sessionsPerWeek, category, weeks: 6, days: Array.from({ length: sessionsPerWeek }, (_, i) => ({ name: `D${i}`, exercises: [] })) } as unknown as ProgramTemplate);

const all = [
  tpl('football-strength', 'Strength', 'Intermediate', 2, 'Football'),
  tpl('speed-agility', 'Speed', 'All levels', 2, 'Football'),
  tpl('linear-5x5', 'Strength', 'Beginner', 3),
  tpl('531-bbb', 'Strength', 'Intermediate', 4),
  tpl('phul', 'Hypertrophy', 'Intermediate', 4),
  tpl('hamstring-rehab-1', 'Rehab', 'All levels', 5, 'Football'),
  tpl('hamstring-rehab-2', 'Rehab', 'All levels', 4, 'Football'),
];

describe('plan builder', () => {
  test('football focus prefers football templates', () => {
    const r = recommendPlans(all, { focus: 'football', daysPerWeek: 2, matchDay: 6, level: 'Intermediate' });
    expect(r[0].template.category).toBe('Football');
    expect(r.map((x) => x.template.goal)).not.toContain('Rehab');
    expect(r[0].reasons).toContain('football');
  });

  test('muscle focus with 4 days picks hypertrophy', () => {
    const r = recommendPlans(all, { focus: 'muscle', daysPerWeek: 4, matchDay: null, level: 'Intermediate' });
    expect(r[0].template.key).toBe('phul');
  });

  test('rehab focus only returns rehab, starting with phase 1', () => {
    const r = recommendPlans(all, { focus: 'rehab', daysPerWeek: 4, matchDay: null, level: 'Beginner' });
    expect(r.every((x) => x.template.goal === 'Rehab')).toBe(true);
    expect(r[0].template.key).toBe('hamstring-rehab-1');
  });

  test('beginners do not get advanced-only programs on top', () => {
    const r = recommendPlans(all, { focus: 'strength', daysPerWeek: 3, matchDay: null, level: 'Beginner' });
    expect(r[0].template.key).toBe('linear-5x5');
  });

  test('schedule keeps the match day and avoids the day before', () => {
    const s = scheduleFor({ focus: 'football', daysPerWeek: 3, matchDay: 6, level: 'Intermediate' });
    expect(s.matchDays).toBe(bit(6));
    expect(countDays(s.trainingDays)).toBe(3);
    expect(s.trainingDays & bit(5)).toBe(0);
    expect(s.trainingDays & s.matchDays).toBe(0);
    expect(scheduleFor({ focus: 'muscle', daysPerWeek: 4, matchDay: null, level: 'Beginner' }).matchDays).toBe(0);
  });
});
