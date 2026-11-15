// Routine durchspielen: aus der Dosis eines Schritts ("2 × 30 s je Seite", "3 × 15", "8–10 Min.") werden Phasen mit Timer
// (Halten, Seitenwechsel, Pause) bzw. Phasen zum Abhaken (Wiederholungen). Reine Funktionen - der Player zeigt sie an.
import type { RoutineStep } from './routines';

export interface Dose {
  sets: number;
  /** Haltezeit bzw. Dauer je Satz in Sekunden (null = Wiederholungen oder ohne Angabe). */
  seconds: number | null;
  reps: number | null;
  /** Je Seite / je Bein: jeder Satz zweimal. */
  perSide: boolean;
}

const SETS = /(\d+)\s*[x×х*]\s*/i;
const RANGE = '(\\d+(?:[.,]\\d+)?)(?:\\s*[–\\-]\\s*(\\d+(?:[.,]\\d+)?))?';
const MINUTES = new RegExp(`${RANGE}\\s*(?:min|мин|minuten|minutes?)\\b\\.?`, 'i');
const SECONDS = new RegExp(`${RANGE}\\s*(?:s|sec|secs|seconds?|sek|сек|с)(?![a-zа-яё])`, 'i');
const REPS = new RegExp(`${RANGE}\\s*(?:[a-zа-яё]+\\s+)?(?:reps?|wdh|wiederholungen|повтор[а-яё]*|раз(?:а)?)(?![a-zа-яё])`, 'i');
const PER_SIDE = /(per side|each side|per leg|each leg|je seite|pro seite|je bein|pro bein|на сторону|на каждую|на ногу|на каждую ногу|каждой ногой|je arm|per arm|на руку)/i;
const num = (s: string) => Number(s.replace(',', '.'));

/** Untere Grenze eines Bereichs ("20–30 s" -> 20): für Reha die vorsichtige Wahl. */
const lower = (m: RegExpMatchArray) => num(m[1]!);

export function parseDose(dose: string | null | undefined): Dose {
  const text = (dose ?? '').trim();
  const sets = Number(text.match(SETS)?.[1] ?? 1);
  const perSide = PER_SIDE.test(text);
  const min = text.match(MINUTES);
  const sec = text.match(SECONDS);
  const reps = text.match(REPS);
  let seconds: number | null = min ? Math.round(lower(min) * 60) : sec ? Math.round(lower(sec)) : null;
  let repCount: number | null = reps ? Math.round(lower(reps)) : null;
  // "3 × 15" ohne Einheit: Wiederholungen
  if (seconds == null && repCount == null) {
    const after = text.match(/\d+\s*[x×х*]\s*(\d+)(?:\s*[–-]\s*\d+)?/i);
    if (after) repCount = Number(after[1]);
  }
  if (seconds != null && (seconds < 3 || seconds > 3600)) seconds = null;
  if (repCount != null && (repCount < 1 || repCount > 500)) repCount = null;
  return { sets: Math.max(1, Math.min(20, Number.isFinite(sets) ? sets : 1)), seconds, reps: repCount, perSide };
}

export type PhaseKind = 'work' | 'switch' | 'rest' | 'next';

export interface Phase {
  kind: PhaseKind;
  /** Index des Schritts (bei 'next': der kommende Schritt). */
  step: number;
  set: number;
  sets: number;
  side: 'left' | 'right' | null;
  /** Timer in Sekunden; null = mit "Fertig" abhaken (Wiederholungen). */
  seconds: number | null;
  reps: number | null;
}

export interface PlayerOptions {
  /** Pause zwischen Sätzen (Halten) bzw. Wiederholungs-Sätzen. */
  restHold: number;
  restReps: number;
  /** Seitenwechsel. */
  switchSide: number;
  /** Vorbereitung vor dem nächsten Schritt. */
  prepare: number;
}

export const DEFAULT_PLAYER: PlayerOptions = { restHold: 15, restReps: 30, switchSide: 5, prepare: 8 };

/** Alle Phasen einer Runde in Reihenfolge. */
export function buildPhases(steps: readonly Pick<RoutineStep, 'name' | 'dose'>[], o: PlayerOptions = DEFAULT_PLAYER): Phase[] {
  const out: Phase[] = [];
  steps.forEach((s, step) => {
    const d = parseDose(s.dose);
    if (step > 0) out.push({ kind: 'next', step, set: 1, sets: d.sets, side: null, seconds: o.prepare, reps: null });
    const sides: ('left' | 'right' | null)[] = d.perSide ? ['left', 'right'] : [null];
    for (let set = 1; set <= d.sets; set++) {
      sides.forEach((side, i) => {
        if (i > 0) out.push({ kind: 'switch', step, set, sets: d.sets, side, seconds: o.switchSide, reps: null });
        out.push({ kind: 'work', step, set, sets: d.sets, side, seconds: d.seconds, reps: d.reps });
      });
      if (set < d.sets) out.push({ kind: 'rest', step, set, sets: d.sets, side: null, seconds: d.seconds != null ? o.restHold : o.restReps, reps: null });
    }
  });
  return out;
}

/** Gesamtdauer der Timer-Phasen in Sekunden (Wiederholungen ohne Zeit zählen nicht). */
export const timedSeconds = (phases: readonly Phase[]): number => phases.reduce((n, p) => n + (p.seconds ?? 0), 0);
