// Übersetzung von Inhalten, die als Daten kommen: Standard-Übungen, Muskelgruppen, Vorlagen, Technik-Hinweise.
// Eigene Übungen und selbst benannte Pläne bleiben, wie der Nutzer sie geschrieben hat.

import { locale, t, tDynamic, textIn } from '.';
import { techniqueTranslations } from './technique';
import type { Technique } from '../lib/figure';
import type { ProgramDay, TrainingProgram } from '../types';

type ExerciseLike = { id?: number | null; name?: string | null; isCustom?: boolean | null };

/** Eigene Übungen haben IDs ab 1000 (siehe AppDbContext) - nur der Standard-Katalog wird übersetzt. */
const isCatalogId = (id: number | null | undefined): id is number => typeof id === 'number' && id > 0 && id < 1000;

export function exerciseName(ex: ExerciseLike | number | null | undefined, fallback?: string | null): string {
  if (ex == null) return fallback ?? '';
  if (typeof ex === 'number') return isCatalogId(ex) ? tDynamic(`exercises.${ex}`, fallback ?? '') : fallback ?? '';
  if (ex.isCustom || !isCatalogId(ex.id)) return ex.name ?? fallback ?? '';
  return tDynamic(`exercises.${ex.id}`, ex.name ?? fallback ?? '');
}

/** Für Schlüssel wie "id:35" (Rekorde, PR-Ereignisse). */
export function exerciseNameByKey(key: string, fallback?: string | null): string {
  return key.startsWith('id:') ? exerciseName(Number(key.slice(3)), fallback) : fallback ?? '';
}

export const muscleName = (group: string | null | undefined): string =>
  group ? tDynamic(`muscles.${group}`, group) : t('muscles.Other');

export const categoryName = (type: string | null | undefined): string => (type ? tDynamic(`categories.${type}`, type) : '');
export const goalName = (goal: string): string => tDynamic(`plan.goals.${goal}`, goal);
export const levelName = (level: string): string => tDynamic(`plan.levels.${level}`, level);

const UNIT_KEYS: Record<string, Parameters<typeof t>[0]> = { kg: 'units.kg', m: 'units.m', s: 'units.s', 'km/h': 'units.kmh', 'm/s': 'units.ms', AU: 'units.au' };
export const unitLabel = (unit: string): string => (UNIT_KEYS[unit] ? t(UNIT_KEYS[unit]) : unit);

// ---------- Vorlagen ----------

export const templateText = (key: string, field: 'name' | 'description', fallback: string): string =>
  tDynamic(`templates.${key}.${field}`, fallback);

export const templateDay = (key: string, index: number, field: 'name' | 'notes', fallback: string | null | undefined): string =>
  tDynamic(`templates.${key}.days.${index}.${field}`, fallback ?? '');

/** Aus einer Vorlage gestartete Pläne übersetzen - solange der Nutzer den Namen nicht geändert hat. */
export function programName(program: Pick<TrainingProgram, 'name' | 'templateKey'>): string {
  const key = program.templateKey;
  return key && textIn('en', `templates.${key}.name`) === program.name ? templateText(key, 'name', program.name) : program.name;
}

export function dayName(program: Pick<TrainingProgram, 'templateKey'> | null | undefined, day: Pick<ProgramDay, 'name' | 'position'>): string {
  const key = program?.templateKey;
  return key && textIn('en', `templates.${key}.days.${day.position}.name`) === day.name ? templateDay(key, day.position, 'name', day.name) : day.name;
}

export function dayNotes(program: Pick<TrainingProgram, 'templateKey'> | null | undefined, day: Pick<ProgramDay, 'notes' | 'position'>): string {
  const key = program?.templateKey;
  if (!day.notes) return '';
  return key && textIn('en', `templates.${key}.days.${day.position}.notes`) === day.notes ? templateDay(key, day.position, 'notes', day.notes) : day.notes;
}

// ---------- Technik ----------

/** Technik-Hinweise in der aktuellen Sprache (Englisch = Original aus lib/figure.ts). */
export function localizedTechnique(key: string | null | undefined, original: Technique | null): Technique | null {
  if (!key || !original) return original;
  const translated = locale.value === 'en' ? null : techniqueTranslations[locale.value]?.[key];
  return translated ?? original;
}

export function motionLabel(key: string | null | undefined, original: string): string {
  if (!key || locale.value === 'en') return original;
  return techniqueTranslations[locale.value]?.[key]?.label ?? original;
}
