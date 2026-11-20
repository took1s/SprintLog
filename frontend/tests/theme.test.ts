import { strict as assert } from 'node:assert';
import { test } from 'vitest';
import { APPEARANCE_VERSION, DEFAULT_APPEARANCE, migrateAppearance, PREVIOUS_DEFAULT_THEME, sanitizeAppearance, THEMES, THEME_SWATCHES } from '@/lib/theme';

test('Matchday ist der neue Standard, Pitch Night bleibt wählbar', () => {
  assert.equal(DEFAULT_APPEARANCE.theme, 'matchday');
  assert.equal(THEMES[0], 'matchday');
  assert.ok(THEMES.includes(PREVIOUS_DEFAULT_THEME));
  for (const name of THEMES) assert.ok(THEME_SWATCHES[name], `Vorschau für ${name}`);
});

test('wer den alten Standard hatte oder nie etwas gewählt hat, bekommt einmal Matchday', () => {
  assert.deepEqual(migrateAppearance(null), { value: { theme: 'matchday', scheme: 'auto' }, migrated: true });
  assert.deepEqual(migrateAppearance({ theme: 'pitch', scheme: 'dark' }), { value: { theme: 'matchday', scheme: 'dark' }, migrated: true });
});

test('eine bewusste Wahl bleibt - auch die Rückkehr zu Pitch Night nach der Umstellung', () => {
  assert.deepEqual(migrateAppearance({ theme: 'midnight', scheme: 'light' }), { value: { theme: 'midnight', scheme: 'light' }, migrated: false });
  assert.deepEqual(migrateAppearance({ theme: 'pitch', scheme: 'auto', v: APPEARANCE_VERSION }), { value: { theme: 'pitch', scheme: 'auto' }, migrated: false });
});

test('unbekannte Werte fallen auf den Standard zurück', () => {
  assert.deepEqual(sanitizeAppearance({ theme: 'neon' as never, scheme: 'dim' as never }), { theme: 'matchday', scheme: 'auto' });
});
