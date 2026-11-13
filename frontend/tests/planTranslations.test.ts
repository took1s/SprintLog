import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadAllLocales, setLocale } from '../src/i18n';
import { dayName, dayNotes, noteText, programName, setPlanTranslations, untranslatedTexts } from '../src/i18n/content';
import type { TrainingProgram } from '../src/types';

beforeAll(() => loadAllLocales());
afterEach(() => { setLocale('en'); setPlanTranslations([]); });

const aiPlan = (translations: TrainingProgram['translations'] = null): TrainingProgram => ({
  id: 1, name: 'Сила и скорость', goal: 'Strength', weeks: 6, isActive: true, startedAt: null, createdAt: '', templateKey: null, translations,
  days: [{ id: 10, position: 0, name: 'Ноги', notes: 'Не накануне матча.', exercises: [
    { id: 100, exerciseId: 1, sets: 3, repsMin: 5, repsMax: 5, note: '~80% 1RM, взрывно' },
    { id: 101, exerciseId: 50, sets: 2, repsMin: 5, repsMax: 5, note: '20 m + 20 m - 3 blocks of 6, 4 min between blocks' },
  ] }],
} as unknown as TrainingProgram);

const tr = { 'Сила и скорость': { en: 'Strength & speed', de: 'Kraft & Tempo', ru: 'Сила и скорость' }, 'Ноги': { en: 'Legs', de: 'Beine', ru: 'Ноги' } };

describe('KI-Pläne in allen Sprachen', () => {
  it('Name, Tag und Hinweise kommen aus den gespeicherten Übersetzungen', async () => {
    const p = aiPlan({ ...tr, 'Не накануне матча.': { en: 'Not the day before a match.', de: 'Nicht am Tag vor dem Spiel.', ru: 'Не накануне матча.' } });
    setPlanTranslations([p]);
    await setLocale('de');
    expect(programName(p)).toBe('Kraft & Tempo');
    expect(dayName(p, p.days[0])).toBe('Beine');
    expect(dayNotes(p, p.days[0])).toBe('Nicht am Tag vor dem Spiel.');
    await setLocale('en');
    expect(programName(p)).toBe('Strength & speed');
    // Ohne Übersetzung bleibt der Text, wie er ist
    expect(noteText('~80% 1RM, взрывно')).toBe('~80% 1RM, взрывно');
  });

  it('fehlende Texte: bekannte Vorlagen-Hinweise zählen nicht, übersetzte auch nicht', async () => {
    await setLocale('de');
    expect(untranslatedTexts(aiPlan())).toEqual(['Сила и скорость', 'Ноги', 'Не накануне матча.', '~80% 1RM, взрывно']);
    expect(untranslatedTexts(aiPlan(tr))).toEqual(['Не накануне матча.', '~80% 1RM, взрывно']);
  });

  it('Vorlagen-Pläne brauchen keine KI-Übersetzung', async () => {
    const tpl = { ...aiPlan(), templateKey: 'football-strength', name: 'Footballer Strength 2x',
      days: [{ id: 1, position: 0, name: 'Lower power', notes: 'Not the day before a match.', exercises: [] }] } as unknown as TrainingProgram;
    for (const lang of ['en', 'de', 'ru'] as const) {
      await setLocale(lang);
      expect(untranslatedTexts(tpl)).toEqual([]);
    }
  });
});
