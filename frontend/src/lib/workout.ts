// Logik der laufenden Einheit als Blöcke (eine Übung = ein Block mit Sätzen), wie in modernen Gym-Apps.
//
// Kern-Idee: Der nächste Satz steht schon vorausgefüllt da ("Geister-Satz"). Meist ist er genau richtig -
// dann reicht EIN Tipp auf ✓. Vorbelegung in dieser Reihenfolge:
//   1. geplanter Satz (Vorlage aus "Wiederholen" bzw. Plan-Vorschlag),
//   2. letzter Satz dieser Übung in der laufenden Einheit,
//   3. derselbe Satz (Nr. n) aus der letzten Einheit mit dieser Übung,
//   4. Standardwerte.

import type { TrackingType as TrackingTypeValue, Workout, WorkoutSet } from '../types';
import { TrackingType, exerciseKey, isWorkingSet } from './analytics';

export interface GhostValues {
  weight: number;
  reps: number;
  distance: number;
  time: number;
  isWarmup: boolean;
  /** Woher die Werte stammen - für den Hinweis in der Zeile. */
  source: 'template' | 'session' | 'previous' | 'plan' | 'default';
}

export interface Suggestion { weight?: number | null; reps?: number | null; distance?: number | null; time?: number | null }

export const GHOST_DEFAULTS = Object.freeze({ weight: 20, reps: 10, distance: 30, time: 4.5, duration: 60 });

/** Reihenfolge der Blöcke: explizit hinzugefügte Übungen, dann Plan-Ziele, dann Übungen, die nur Sätze haben. */
export function blockOrder(order: readonly number[] | undefined, planIds: readonly number[], setIds: readonly number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const id of [...(order ?? []), ...planIds, ...setIds]) {
    if (typeof id !== 'number' || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

/** Alle Sätze dieser Übung aus der letzten Einheit, die sie enthielt (in Original-Reihenfolge). */
export function previousSets(workouts: readonly Workout[] | null | undefined, exerciseId: number, exclude?: { id?: number | null; clientId?: string | null } | null): WorkoutSet[] {
  const key = `id:${exerciseId}`;
  let best: { date: string; sets: WorkoutSet[] } | null = null;
  for (const w of workouts ?? []) {
    if (exclude && ((exclude.id != null && w.id === exclude.id) || (exclude.clientId && w.clientId === exclude.clientId))) continue;
    const sets = (w.sets ?? []).filter((s) => exerciseKey(s) === key);
    if (!sets.length) continue;
    if (!best || String(w.date) > best.date) best = { date: String(w.date), sets };
  }
  return best?.sets ?? [];
}

const n = (v: unknown, fallback = 0): number => (Number.isFinite(Number(v)) && v !== null && v !== undefined ? Number(v) : fallback);

/**
 * Vorbelegung für den nächsten Satz einer Übung.
 * @param index Nummer des nächsten Satzes (0-basiert, zählt alle Sätze der Übung in dieser Einheit)
 */
export function ghostFor({ trackingType, bodyweight, index, sessionSets, template, plan, previous }: {
  trackingType: TrackingTypeValue;
  bodyweight: boolean;
  index: number;
  sessionSets: readonly WorkoutSet[];
  template?: readonly WorkoutSet[] | null;
  plan?: Suggestion | null;
  previous?: readonly WorkoutSet[] | null;
}): GhostValues {
  const defaults = {
    weight: trackingType === TrackingType.WeightReps && !bodyweight ? GHOST_DEFAULTS.weight : 0,
    reps: trackingType === TrackingType.WeightReps ? GHOST_DEFAULTS.reps : 0,
    distance: trackingType === TrackingType.DistanceTime ? GHOST_DEFAULTS.distance : 0,
    time: trackingType === TrackingType.Duration ? GHOST_DEFAULTS.duration : trackingType === TrackingType.DistanceTime ? GHOST_DEFAULTS.time : 0,
  };
  const from = (s: WorkoutSet | Suggestion, source: GhostValues['source'], warmup = false): GhostValues => ({
    weight: n(s.weight, defaults.weight),
    reps: n(s.reps, defaults.reps),
    distance: n(s.distance, defaults.distance),
    time: n(s.time, defaults.time),
    isWarmup: warmup,
    source,
  });

  const planned = template?.[index];
  if (planned) return from(planned, 'template', !!planned.isWarmup);

  const lastInSession = sessionSets[sessionSets.length - 1];
  const hasPlan = !!plan && (plan.weight != null || plan.reps != null || plan.distance != null || plan.time != null);
  // Nach einem Aufwärmsatz nicht dessen (leichtes) Gewicht übernehmen, sondern zum Arbeitssatz springen.
  if (lastInSession && !lastInSession.isWarmup) return from(lastInSession, 'session');
  if (hasPlan) return from(plan!, 'plan');

  const prev = previous ?? [];
  if (prev.length) {
    const workingPrev = prev.filter(isWorkingSet);
    const doneWorking = sessionSets.filter((s) => !s.isWarmup).length;
    const pick = workingPrev[doneWorking] ?? workingPrev[workingPrev.length - 1] ?? prev[prev.length - 1];
    return from(pick, 'previous');
  }
  if (lastInSession) return from(lastInSession, 'session');
  return { ...defaults, isWarmup: false, source: 'default' };
}

/** Hinweis "vorher" pro Satznummer (Arbeitssätze der letzten Einheit). */
export function previousForRow(previous: readonly WorkoutSet[], workingIndex: number): WorkoutSet | null {
  const working = previous.filter(isWorkingSet);
  return working[workingIndex] ?? null;
}

// =====================================================================
// Suche (mehrsprachig, tolerant)
// =====================================================================

/** Kleinschreibung, ohne Akzente, ё -> е, ß -> ss, Satzzeichen weg. */
export function normalize(text: string | null | undefined): string {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ё/g, 'е')
    .replace(/й/g, 'и')
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Trefferwert einer Übung für eine Suchanfrage (0 = kein Treffer). Jedes Wort der Anfrage muss irgendwo passen.
 * @param haystacks alle Namen/Synonyme/Muskelgruppen der Übung (in allen Sprachen), bereits normalisiert
 */
export function matchScore(query: string, haystacks: readonly string[]): number {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length) return 1;
  const words = haystacks.flatMap((h) => h.split(' '));
  let score = 0;
  for (const token of tokens) {
    let best = 0;
    for (const h of haystacks) {
      if (h === token) best = Math.max(best, 100);
      else if (h.startsWith(token)) best = Math.max(best, 60);
      else if (h.includes(` ${token}`)) best = Math.max(best, 40);
      else if (h.includes(token)) best = Math.max(best, 20);
    }
    // Tippfehler: ein Zeichen Abstand zum Wortanfang (ab 4 Buchstaben), z. B. "bankdrüken", "присидания".
    if (!best && token.length >= 4 && words.some((w) => w.length >= 4 && [token.length - 1, token.length, token.length + 1].some((len) => withinOneEdit(token, w.slice(0, len))))) best = 8;
    if (!best) return 0;
    score += best;
  }
  return score;
}
