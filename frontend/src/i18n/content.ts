// Übersetzung von Inhalten, die als Daten kommen: Standard-Übungen, Muskelgruppen, Vorlagen, Technik-Hinweise.
// Eigene Übungen und selbst benannte Pläne bleiben, wie der Nutzer sie geschrieben hat.

import { shallowRef } from 'vue';
import { locale, t, tDynamic, textIn } from '.';
import { en } from './en';
import type { ProgramDay, TrainingProgram } from '../types';

// ---------- Übersetzte Plan-Texte ----------

/** Übersetzungen aller Pläne des Nutzers (Originaltext -> Sprache -> Text); der App-Store setzt sie nach dem Laden. */
const planTexts = shallowRef<ReadonlyMap<string, Partial<Record<string, string>>>>(new Map());

export function setPlanTranslations(programs: readonly Pick<TrainingProgram, 'translations'>[]): void {
  const map = new Map<string, Partial<Record<string, string>>>();
  for (const p of programs) for (const [text, tr] of Object.entries(p.translations ?? {})) map.set(text, { ...map.get(text), ...tr });
  planTexts.value = map;
}

/** Frei geschriebener Plan-Text in der aktuellen Sprache (sonst unverändert). */
export const planText = (text: string): string => planTexts.value.get(text.trim())?.[locale.value] ?? text;

/** Texte eines Plans, denen die aktuelle Sprache fehlt (Vorlagen-Texte übersetzt die App selbst). */
export function untranslatedTexts(program: TrainingProgram): string[] {
  const texts = [program.name, ...program.days.flatMap((d) => [d.name, d.notes, ...d.exercises.flatMap((x) => [x.note, ...(x.weekSteps ?? []).map((w) => w.note)])])]
    .filter((x): x is string => !!x?.trim()).map((x) => x.trim());
  // Texte aus Vorlagen bzw. bekannte Hinweise übersetzt die App selbst (Quelle ist Englisch)
  const key = program.templateKey;
  const isTemplate = (text: string) => noteKeys().has(text) || (!!key && (textIn('en', `templates.${key}.name`) === text
    || program.days.some((d) => textIn('en', `templates.${key}.days.${d.position}.name`) === text || textIn('en', `templates.${key}.days.${d.position}.notes`) === text)));
  return [...new Set(texts)].filter((x) => !program.translations?.[x]?.[locale.value] && !isTemplate(x));
}

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
  return key.startsWith('id:') ? exerciseName(Number(key.slice(3).split('@')[0]), fallback) : fallback ?? '';
}

export const muscleName = (group: string | null | undefined): string =>
  group ? tDynamic(`muscles.${group}`, group) : t('muscles.Other');

export const categoryName = (type: string | null | undefined): string => (type ? tDynamic(`categories.${type}`, type) : '');
export const goalName = (goal: string): string => tDynamic(`plan.goals.${goal}`, goal);
export const levelName = (level: string): string => tDynamic(`plan.levels.${level}`, level);

const UNIT_KEYS: Record<string, Parameters<typeof t>[0]> = { kg: 'units.kg', m: 'units.m', s: 'units.s', 'km/h': 'units.kmh', 'm/s': 'units.ms', AU: 'units.au', reps: 'units.reps', km: 'units.km', W: 'units.w', min: 'units.min', bpm: 'units.bpm', rpm: 'units.rpm', kcal: 'units.kcal' };
export const unitLabel = (unit: string): string => (UNIT_KEYS[unit] ? t(UNIT_KEYS[unit]) : unit);

// ---------- Vorlagen ----------

export const templateText = (key: string, field: 'name' | 'description', fallback: string): string =>
  tDynamic(`templates.${key}.${field}`, fallback);

export const templateDay = (key: string, index: number, field: 'name' | 'notes', fallback: string | null | undefined): string =>
  tDynamic(`templates.${key}.days.${index}.${field}`, fallback ?? '');

/** Aus einer Vorlage gestartete Pläne übersetzen - solange der Nutzer den Namen nicht geändert hat. */
export function programName(program: Pick<TrainingProgram, 'name' | 'templateKey'>): string {
  const key = program.templateKey;
  return key && textIn('en', `templates.${key}.name`) === program.name ? templateText(key, 'name', program.name) : planText(program.name);
}

export function dayName(program: Pick<TrainingProgram, 'templateKey'> | null | undefined, day: Pick<ProgramDay, 'name' | 'position'>): string {
  const key = program?.templateKey;
  return key && textIn('en', `templates.${key}.days.${day.position}.name`) === day.name ? templateDay(key, day.position, 'name', day.name) : planText(day.name);
}

export function dayNotes(program: Pick<TrainingProgram, 'templateKey'> | null | undefined, day: Pick<ProgramDay, 'notes' | 'position'>): string {
  const key = program?.templateKey;
  if (!day.notes) return '';
  return key && textIn('en', `templates.${key}.days.${day.position}.notes`) === day.notes ? templateDay(key, day.position, 'notes', day.notes) : planText(day.notes);
}

// ---------- Hinweise aus Vorlagen ----------

let noteKeyMap: Map<string, string> | null = null;
function noteKeys(): Map<string, string> {
  if (!noteKeyMap) {
    noteKeyMap = new Map();
    for (const [key, text] of Object.entries(en.notes)) noteKeyMap.set(text, key);
  }
  return noteKeyMap;
}

/**
 * Hinweise der Vorlagen kommen als englischer Text (program-templates.json). Bekannte Texte werden übersetzt,
 * selbst geschriebene Hinweise bleiben, wie sie sind.
 */
export function noteText(note: string | null | undefined): string {
  if (!note) return '';
  const key = noteKeys().get(note);
  return key ? tDynamic(`notes.${key}`, note) : planText(note);
}
