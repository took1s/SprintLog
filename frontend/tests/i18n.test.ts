import { afterEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { en } from '../src/i18n/en';
import { de } from '../src/i18n/de';
import { ru } from '../src/i18n/ru';
import { detectLocale, locale, setLocale, t, tn } from '../src/i18n';
import { exerciseName, programName } from '../src/i18n/content';
import { missingTechnique } from '../src/i18n/technique';
import { formatNumber } from '../src/lib/format';

afterEach(() => setLocale('en'));

type Node = string | { [key: string]: Node };

/** Alle Blätter als [pfad, text] - Pluralformen werden zu "pfad.one", "pfad.other" usw. */
function leaves(node: Node, prefix = ''): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]];
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

const params = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const isPluralForm = (path: string) => /\.(one|few|many|other)$/.test(path);
const base = (path: string) => path.replace(/\.(one|few|many|other)$/, '');

for (const [name, catalog] of [['de', de], ['ru', ru]] as const) {
  test(`${name}: same placeholders as English and no empty texts`, () => {
    const english = new Map(leaves(en as unknown as Node));
    for (const [path, text] of leaves(catalog as unknown as Node)) {
      const reference = english.get(path) ?? (isPluralForm(path) ? english.get(`${base(path)}.other`) : undefined);
      assert.ok(reference !== undefined, `${name}: unknown key ${path}`);
      if (reference !== '') assert.notEqual(text.trim(), '', `${name}: empty text for ${path}`);
      // Plural: {n} darf in einzelnen Formen fehlen ("один подход" wäre auch ok) - sonst exakt gleiche Platzhalter.
      const expected = params(reference!).split(',').filter((p) => !(isPluralForm(path) && p === 'n')).join(',');
      const actual = params(text).split(',').filter((p) => !(isPluralForm(path) && p === 'n')).join(',');
      assert.equal(actual, expected, `${name}: placeholders differ for ${path}`);
    }
  });

  test(`${name}: technique cues for every motion`, () => {
    assert.deepEqual(missingTechnique(name), []);
  });
}

test('Russian plural forms (1 / 2 / 5 / 21 / 11)', () => {
  setLocale('ru');
  assert.equal(tn('units.workouts', 1), '1 тренировка');
  assert.equal(tn('units.workouts', 3), '3 тренировки');
  assert.equal(tn('units.workouts', 5), '5 тренировок');
  assert.equal(tn('units.workouts', 21), '21 тренировка');
  assert.equal(tn('units.workouts', 11), '11 тренировок');
});

test('German plural and interpolation', () => {
  setLocale('de');
  assert.equal(tn('units.sets', 1), '1 Satz');
  assert.equal(tn('units.sets', 4), '4 Sätze');
  assert.equal(t('auth.toast.login', { name: 'illia' }), 'Angemeldet als illia');
});

test('falls back to English for unknown locale and detects browser language', () => {
  assert.equal(detectLocale(['ru-RU', 'en']), 'ru');
  assert.equal(detectLocale(['de-AT']), 'de');
  assert.equal(detectLocale(['fr-FR', 'it']), 'en');
  assert.equal(detectLocale([]), 'en');
});

test('switching the language changes texts and number format', () => {
  assert.equal(t('nav.plan'), 'PLAN');
  assert.equal(formatNumber(1.5), '1.5');
  setLocale('de');
  assert.equal(locale.value, 'de');
  assert.equal(formatNumber(1.5), '1,5');
  setLocale('ru');
  assert.equal(t('nav.plan'), 'ПЛАН');
  assert.equal(formatNumber(1.5), '1,5');
});

test('catalog exercises are translated, custom ones keep their name', () => {
  setLocale('de');
  assert.equal(exerciseName({ id: 1, name: 'Bench Press', isCustom: false }), 'Bankdrücken');
  assert.equal(exerciseName({ id: 1001, name: 'Sled Push', isCustom: true }), 'Sled Push');
  setLocale('ru');
  assert.equal(exerciseName(35, 'Barbell Squat'), 'Присед со штангой');
});

test('template programs are translated until the user renames them', () => {
  setLocale('ru');
  assert.equal(programName({ name: 'Footballer Strength 2x', templateKey: 'football-strength' }), 'Сила для футболиста 2x');
  assert.equal(programName({ name: 'Мой план', templateKey: 'football-strength' }), 'Мой план');
});

// ---------- Abgleich mit dem Server-Katalog ----------

const dbContext = readFileSync(new URL('../../SprintLog.Api/Data/AppDbContext.cs', import.meta.url), 'utf8');
const templatesCs = readFileSync(new URL('../../SprintLog.Api/Services/ProgramTemplates.cs', import.meta.url), 'utf8');

test('every seeded exercise has a name in all languages and English matches the server', () => {
  const seeded = [...dbContext.matchAll(/Ex\((\d+), "([^"]+)"/g)].map((m) => [Number(m[1]), m[2]] as const);
  assert.ok(seeded.length >= 84);
  for (const [id, name] of seeded) {
    assert.equal((en.exercises as Record<number, string>)[id], name, `en.exercises.${id}`);
    assert.ok((de.exercises as Record<number, string>)[id], `de.exercises.${id} missing`);
    assert.ok((ru.exercises as Record<number, string>)[id], `ru.exercises.${id} missing`);
  }
});

test('every server template has texts in all languages and English matches the server', () => {
  const keys = [...templatesCs.matchAll(/new\("([a-z0-9-]+)", "([^"]+)"/g)].map((m) => [m[1], m[2]] as const);
  assert.ok(keys.length >= 5);
  for (const [key, name] of keys) {
    for (const [lang, catalog] of [['en', en], ['de', de], ['ru', ru]] as const) {
      const tpl = (catalog.templates as Record<string, { name: string }>)[key];
      assert.ok(tpl?.name, `${lang}.templates.${key} missing`);
    }
    assert.equal((en.templates as Record<string, { name: string }>)[key].name, name, `en.templates.${key}.name`);
  }
});
