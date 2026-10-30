// Export einer Einheit als Dataview-Zeilen für die Daily Note in Obsidian.
//
// Format (Erfassungsmodell "Session-Zeilen" im Vault):
//   - [ses:: gym] [min:: 75] [rpe:: 8] [qual:: 7] [part:: push] Kommentar
//   - [lift:: Жим лёжа] [kg:: 80] [reps:: 5] [sets:: 3] [rir:: 2]
// Regeln, damit die Dashboards rechnen können:
//   - jede Angabe ist ein Listenpunkt ("- "), Werte stehen IN den Klammern,
//   - Zahlen mit Punkt als Dezimaltrenner (Dataview), Aufwärmsätze zählen zur Session-Zeit, nicht als Lift,
//   - gleiche Arbeitssätze (kg, Wdh., RIR) werden zu einer Zeile mit sets:: N zusammengefasst.

import { TrackingType, isWorkingSet, trackingOf } from './analytics';
import type { Workout, WorkoutSet } from '../types';

/** Session-Codes aus dem Vault: qualitativ (zählen zur Last) und Regeneration. */
export const SESSION_CODES = ['gym', 'speed', 'tech', 'team', 'game', 'match', 'cardio', 'recov', 'rehab'] as const;
export type SessionCode = (typeof SESSION_CODES)[number];

export type BodyPart = 'legs' | 'push' | 'pull' | 'upper' | 'full' | 'core';

export interface ObsidianOptions {
  /** Session-Code (überschreibt die Erkennung). */
  ses?: SessionCode;
  /** Aufwärmsätze als eigene Lift-Zeilen aufnehmen (Standard: nein - sie gehören zur Session-Zeit). */
  includeWarmups?: boolean;
  /** Feld-Sätze (Strecke/Zeit) als lesbare Textzeilen ohne Felder anhängen. */
  fieldAsText?: boolean;
  /** Name einer Übung in der gewünschten Sprache. */
  nameOf: (set: WorkoutSet) => string;
  /** Muskelgruppe/Kategorie einer Übung (Server-Sätze tragen keine Kategorie). */
  muscleOf?: (set: WorkoutSet) => string | null | undefined;
  categoryOf?: (set: WorkoutSet) => string | null | undefined;
  /** Lesbare Beschreibung eines Feld-Satzes (lokalisiert), z. B. "30 м / 4,03 с". */
  describe?: (set: WorkoutSet) => string;
  /** Hinweis bei mitexportierten Aufwärmsätzen (lokalisiert). */
  warmupLabel?: string;
}

const LEGS = new Set(['Legs', 'Legs/Back', 'Back/Legs']);
const PUSH = new Set(['Chest', 'Shoulders']);
const PULL = new Set(['Back']);

/** Zahl für Dataview: Punkt statt Komma, ohne überflüssige Nachkommastellen. */
export function dvNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return String(Math.round(value * 100) / 100);
}

/** Text darf keine eckigen Klammern oder "::" enthalten (würde als Feld gelesen). */
export function dvText(text: string | null | undefined): string {
  return String(text ?? '').replace(/\[/g, '(').replace(/\]/g, ')').replace(/::/g, ':').replace(/\s+/g, ' ').trim();
}

/** RIR aus RPE (RIR = 10 - RPE), sonst leer. */
export const rirOf = (rpe: number | null | undefined): number | null => (rpe == null ? null : Math.max(0, Math.round((10 - rpe) * 2) / 2));

/** Welcher Körperteil wurde trainiert? (nur Gym, Arbeitssätze mit Gewicht) */
export function inferPart(sets: readonly WorkoutSet[], muscleOf: (s: WorkoutSet) => string | null | undefined): BodyPart | null {
  const counts = { legs: 0, push: 0, pull: 0, upper: 0, core: 0 };
  for (const s of sets) {
    if (!isWorkingSet(s) || trackingOf(s) !== TrackingType.WeightReps) continue;
    const m = muscleOf(s) ?? '';
    if (LEGS.has(m)) counts.legs++;
    else if (PUSH.has(m)) counts.push++;
    else if (PULL.has(m)) counts.pull++;
    else if (m === 'Arms') counts.upper++;
    else if (m === 'Core') counts.core++;
  }
  const upper = counts.push + counts.pull + counts.upper;
  const total = counts.legs + upper + counts.core;
  if (!total) return null;
  if (counts.core === total) return 'core';
  if (counts.legs / total >= 0.7) return 'legs';
  if (counts.legs / total >= 0.25 && upper / total >= 0.25) return 'full';
  if (upper && counts.push / upper >= 0.7) return 'push';
  if (upper && counts.pull / upper >= 0.7) return 'pull';
  return upper ? 'upper' : 'full';
}

/** Session-Code aus Typ und Übungen ableiten (der Nutzer kann ihn im Dialog ändern). */
export function inferSessionCode(workout: Workout, opts: Pick<ObsidianOptions, 'muscleOf' | 'categoryOf'> = {}): SessionCode {
  if (workout.workoutType === 'Match') return 'match';
  const sets = workout.sets ?? [];
  const cat = (s: WorkoutSet) => opts.categoryOf?.(s) ?? s.category ?? 'Gym';
  const gym = sets.filter((s) => cat(s) === 'Gym').length;
  const field = sets.length - gym;
  if (gym >= field) {
    const muscles = sets.map((s) => opts.muscleOf?.(s) ?? s.muscleGroup);
    return muscles.length && muscles.every((m) => m === 'Cardio') ? 'cardio' : 'gym';
  }
  // Feld: kurze Sprints (<= 150 m) und Explosives = speed, Ballübungen/Agilität = tech, Ausdauer = cardio
  const fieldSets = sets.filter((s) => cat(s) !== 'Gym');
  const muscle = (s: WorkoutSet) => opts.muscleOf?.(s) ?? s.muscleGroup ?? '';
  if (fieldSets.every((s) => muscle(s) === 'Mobility')) return 'recov';
  const score = { speed: 0, tech: 0, cardio: 0 };
  for (const s of fieldSets) {
    const m = muscle(s);
    if (m === 'Explosive' || (trackingOf(s) === TrackingType.DistanceTime && (s.distance ?? 0) > 0 && (s.distance ?? 0) <= 150)) score.speed++;
    else if (m === 'Agility') score.tech++;
    else if (m === 'Cardio') score.cardio++;
  }
  if (score.cardio > score.speed && score.cardio >= score.tech) return 'cardio';
  if (score.tech > score.speed) return 'tech';
  return 'speed';
}

interface LiftGroup { name: string; weight: number; reps: number; rir: number | null; sets: number; notes: string[]; warmup: boolean }

/** Zeilen einer Einheit (ohne Zeilenumbrüche). */
export function obsidianLines(workout: Workout, opts: ObsidianOptions): string[] {
  const sets = workout.sets ?? [];
  const ses = opts.ses ?? inferSessionCode(workout, opts);
  const minutes = workout.durationSeconds ? Math.round(workout.durationSeconds / 60) : null;
  const part = ses === 'gym' && opts.muscleOf ? inferPart(sets, opts.muscleOf) : null;

  let head = `- [ses:: ${ses}] [min:: ${minutes ?? ''}] [rpe:: ${workout.sessionRpe ?? ''}] [qual:: ${workout.quality ?? ''}]`;
  if (ses === 'gym') head += ` [part:: ${part ?? ''}]`;
  const comment = [workout.workoutType === 'Match' && workout.match?.opponent ? `vs ${workout.match.opponent}` : '', workout.notes ?? '']
    .map(dvText).filter(Boolean).join(' · ');
  if (comment) head += ` ${comment}`;
  const lines = [head];

  // Lifts: aufeinanderfolgende gleiche Sätze derselben Übung zusammenfassen
  const groups: LiftGroup[] = [];
  for (const s of sets) {
    if (trackingOf(s) !== TrackingType.WeightReps) continue;
    if (s.isWarmup && !opts.includeWarmups) continue;
    const name = dvText(opts.nameOf(s));
    const weight = s.weight ?? 0;
    const reps = s.reps ?? 0;
    const rir = rirOf(s.rpe);
    const last = groups[groups.length - 1];
    if (last && last.name === name && last.weight === weight && last.reps === reps && last.rir === rir && last.warmup === !!s.isWarmup) {
      last.sets++;
      if (s.note) last.notes.push(dvText(s.note));
    } else {
      groups.push({ name, weight, reps, rir, sets: 1, notes: s.note ? [dvText(s.note)] : [], warmup: !!s.isWarmup });
    }
  }
  for (const g of groups) {
    let line = `- [lift:: ${g.name}] [kg:: ${dvNumber(g.weight)}] [reps:: ${g.reps}] [sets:: ${g.sets}] [rir:: ${g.rir ?? ''}]`;
    const notes = [...new Set(g.notes.filter(Boolean))];
    if (g.warmup) notes.unshift(dvText(opts.warmupLabel ?? 'warm-up'));
    if (notes.length) line += ` ${notes.join('; ')}`;
    lines.push(line);
  }

  // Feld: lesbar, ohne Felder (zählt nicht doppelt in den Dashboards)
  if (opts.fieldAsText !== false && opts.describe) {
    const field = sets.filter((s) => trackingOf(s) !== TrackingType.WeightReps && (!s.isWarmup || opts.includeWarmups));
    const rows: { name: string; values: string[] }[] = [];
    for (const s of field) {
      const name = dvText(opts.nameOf(s));
      const last = rows[rows.length - 1];
      const value = dvText(opts.describe(s));
      if (last && last.name === name) last.values.push(value);
      else rows.push({ name, values: [value] });
    }
    for (const r of rows) lines.push(`- ${r.name}: ${r.values.join(', ')}`);
  }
  return lines;
}

/** Mehrere Einheiten (z. B. ein ganzer Tag) als ein Block. */
export function obsidianText(workouts: readonly Workout[], opts: ObsidianOptions & { sesFor?: (w: Workout) => SessionCode | undefined }): string {
  return [...workouts]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((w) => obsidianLines(w, { ...opts, ses: opts.sesFor?.(w) ?? undefined }).join('\n'))
    .join('\n');
}
