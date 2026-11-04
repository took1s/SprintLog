import { describe, expect, test } from 'vitest';
import { dailyLine, isMilestone, startTrigger } from '../src/lib/motivation';
import { motivationEn } from '../src/i18n/motivation.en';
import { motivationDe } from '../src/i18n/motivation.de';
import { motivationRu } from '../src/i18n/motivation.ru';
import { ensureLocale } from '../src/i18n';

const MOTIVATION = { en: motivationEn, de: motivationDe, ru: motivationRu };

const base = { now: new Date('2026-11-04T08:00:00'), name: 'luffy', trainedToday: false, daysSinceLast: 1, streak: 0, weekCount: 1 };

describe('motivation', () => {
  test('every language has every trigger with 6 lines, no long dashes, no emoji', () => {
    const keys = Object.keys(MOTIVATION.en).sort();
    for (const lang of ['en', 'de', 'ru'] as const) {
      expect(Object.keys(MOTIVATION[lang]).sort()).toEqual(keys);
      for (const list of Object.values(MOTIVATION[lang])) {
        expect(list).toHaveLength(6);
        for (const line of list) {
          expect(line).not.toMatch(/[—–]/);
          expect(line).not.toMatch(/\p{Extended_Pictographic}/u);
        }
      }
    }
  });

  test('priority: match day > rehab > comeback > rest > streak > week > time of day', () => {
    expect(startTrigger({ ...base, todayKind: 'match', rehabActive: true })?.key).toBe('matchDay');
    expect(startTrigger({ ...base, rehabActive: true, daysSinceLast: 9 })?.key).toBe('rehab');
    expect(startTrigger({ ...base, daysSinceLast: 6 })?.key).toBe('comeback');
    expect(startTrigger({ ...base, todayKind: 'rest', streak: 4 })?.key).toBe('restDay');
    expect(startTrigger({ ...base, streak: 4 })?.key).toBe('streak');
    expect(startTrigger(base)?.key).toBe('startMorning');
    expect(startTrigger({ ...base, now: new Date('2026-11-04T19:00:00') })?.key).toBe('startEvening');
    // Heute schon trainiert: kein "los geht's" mehr
    expect(startTrigger({ ...base, trainedToday: true })).toBeNull();
  });

  test('line is stable for a day, changes the next day; unusable names are skipped', async () => {
    await ensureLocale('de'); // DE-Zeilen kommen mit dem deutschen Sprach-Chunk
    const d1 = new Date('2026-11-04T08:00:00');
    expect(dailyLine('startMorning', { name: 'luffy' }, d1, 'en')).toBe(dailyLine('startMorning', { name: 'luffy' }, new Date('2026-11-04T10:00:00'), 'en'));
    expect(dailyLine('startMorning', { name: 'luffy' }, d1, 'en')).not.toBe(dailyLine('startMorning', { name: 'luffy' }, new Date('2026-11-05T08:00:00'), 'en'));
    for (let i = 0; i < 7; i++) {
      expect(dailyLine('startMorning', { name: 'someone@mail.com' }, new Date(2026, 10, 4 + i, 8), 'en')).not.toMatch(/@|\{/);
    }
    expect(dailyLine('comeback', { days: 7 }, d1, 'de')).toMatch(/7|Pausen/);
  });

  test('milestones', () => {
    expect([10, 25, 50, 100, 150].every(isMilestone)).toBe(true);
    expect(isMilestone(11)).toBe(false);
  });
});
