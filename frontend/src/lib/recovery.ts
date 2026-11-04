// Erholungszeit nach dem Training - eine Schätzung, kein Messwert.
//
// Grundlage (vereinfacht aus der Sportwissenschaft):
// - Muskelkraft nach intensivem Krafttraining ist nach etwa 24-72 h wieder da; je mehr harte Sätze für eine
//   Muskelgruppe und je näher am Versagen (RPE), desto länger.
// - Sprints und Spiele belasten Beine und Nervensystem stark: nach einem Spiel typischerweise 48-72 h.
// - Lockere Ausdauer und Technik: unter einem Tag.
// Ergebnis pro Bereich (Beine, Oberkörper, Rumpf, Nervensystem/Gesamt) + wann alles wieder bereit ist.

import type { Workout, WorkoutSet } from '../types';

export type Region = 'legs' | 'upper' | 'core' | 'system';
export const REGIONS: Region[] = ['legs', 'upper', 'core', 'system'];

const LEGS = /^(legs|glutes|hamstrings|quads|quadriceps|calves|adductors|hip|plyometrics|power|speed|agility|sprint)/i;
const UPPER = /^(chest|back|shoulders|arms|biceps|triceps|lats|traps|upper)/i;
const CORE = /^(core|abs|obliques|lower back)/i;

const H = 3_600_000;

export interface SetInfo extends Pick<WorkoutSet, 'reps' | 'rpe' | 'isWarmup' | 'distance' | 'time'> {
  muscleGroup?: string | null;
  trackingType?: string | null;
}

export interface RecoveryEstimate {
  /** Stunden je Bereich (0 = nicht belastet). */
  hours: Record<Region, number>;
  /** Längste Erholung. */
  total: number;
  /** Am stärksten belasteter Bereich. */
  main: Region | null;
}

export function regionOf(muscleGroup: string | null | undefined, trackingType?: string | null): Region | null {
  const g = (muscleGroup ?? '').trim();
  if (LEGS.test(g)) return 'legs';
  if (UPPER.test(g)) return 'upper';
  if (CORE.test(g)) return 'core';
  if (trackingType === 'DistanceTime') return 'legs';
  return null;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Erholung für eine Einheit. `kind` = Art der Einheit (Spiel zählt pauschal), `sessionRpe` = Gesamtanstrengung. */
export function estimateRecovery(sets: readonly SetInfo[], opts: { kind?: string; sessionRpe?: number | null; durationMin?: number | null; rehab?: boolean } = {}): RecoveryEstimate {
  const hours: Record<Region, number> = { legs: 0, upper: 0, core: 0, system: 0 };
  const hard: Record<Region, number> = { legs: 0, upper: 0, core: 0, system: 0 };
  const rpeSum: Record<Region, number> = { legs: 0, upper: 0, core: 0, system: 0 };
  let sprints = 0;

  for (const s of sets) {
    if (s.isWarmup) continue;
    const region = regionOf(s.muscleGroup, s.trackingType);
    if (s.trackingType === 'DistanceTime' && (s.distance ?? 0) > 0 && (s.distance ?? 0) <= 100) sprints += 1;
    if (!region) continue;
    // Ein Satz zählt als "hart", wenn er nah am Versagen war (RPE >= 7) oder kein RPE angegeben ist
    const rpe = s.rpe ?? 8;
    if (s.trackingType === 'Duration' && region === 'core') { hard.core += 0.5; rpeSum.core += rpe * 0.5; continue; }
    const weight = rpe >= 7 ? 1 : 0.5;
    hard[region] += weight;
    rpeSum[region] += rpe * weight;
  }

  for (const r of ['legs', 'upper', 'core'] as const) {
    if (!hard[r]) continue;
    const avgRpe = rpeSum[r] / hard[r];
    const factor = avgRpe >= 9 ? 1.2 : avgRpe <= 6.5 ? 0.75 : 1;
    const base = r === 'core' ? 16 + 3 * Math.min(hard[r], 8) : 24 + 5 * Math.min(hard[r], 10);
    hours[r] = Math.round(clamp(base * factor, r === 'core' ? 12 : 18, r === 'legs' ? 84 : 72));
  }

  // Sprints: Nervensystem + Beine
  if (sprints >= 4) {
    const sprintHours = sprints >= 10 ? 48 : 36;
    hours.system = Math.max(hours.system, sprintHours);
    hours.legs = Math.max(hours.legs, sprintHours);
  }

  // Spiel: pauschal 48-72 h je nach Anstrengung und Spielzeit
  if (opts.kind === 'Match') {
    const minutes = opts.durationMin ?? 90;
    const rpe = opts.sessionRpe ?? 8;
    const matchHours = Math.round(clamp(36 + (minutes / 90) * 24 + (rpe - 7) * 6, 36, 72));
    hours.legs = Math.max(hours.legs, matchHours);
    hours.system = Math.max(hours.system, matchHours);
  }

  // Gesamte Anstrengung (sRPE): sehr harte, lange Einheiten belasten den ganzen Körper
  if (opts.sessionRpe != null && opts.durationMin != null) {
    const load = opts.sessionRpe * opts.durationMin;
    if (load >= 500) hours.system = Math.max(hours.system, Math.round(clamp(load / 15, 24, 60)));
  }

  // Reha: bewusst niedrige Belastung
  if (opts.rehab) for (const r of REGIONS) hours[r] = Math.min(hours[r], 24);

  const main = REGIONS.reduce<Region | null>((best, r) => (hours[r] && (!best || hours[r] > hours[best]) ? r : best), null);
  return { hours, total: main ? hours[main] : 0, main };
}

export interface RecoveryStatus {
  region: Region;
  /** Zeitpunkt, ab dem der Bereich wieder voll belastbar ist. */
  readyAt: Date;
  /** 0-100: wie weit erholt. */
  percent: number;
}

/** Aktueller Erholungsstatus aus den Einheiten der letzten 4 Tage. */
export function recoveryStatus(
  workouts: readonly Workout[],
  muscleOf: (exerciseId: number | null | undefined) => { muscleGroup?: string | null; trackingType?: string | null },
  now = new Date(),
  rehabProgramDays?: ReadonlySet<number>,
): RecoveryStatus[] {
  const since = now.getTime() - 4 * 24 * H;
  const latest = new Map<Region, { start: number; end: number }>();
  for (const w of workouts) {
    const start = new Date(String(w.date)).getTime();
    if (!Number.isFinite(start) || start < since || start > now.getTime()) continue;
    const ended = start + (w.durationSeconds ?? 3600) * 1000;
    const est = estimateRecovery(
      (w.sets ?? []).map((s) => ({ ...s, ...muscleOf(s.exerciseId) })),
      { kind: String(w.workoutType), sessionRpe: w.sessionRpe, durationMin: w.durationSeconds ? w.durationSeconds / 60 : null, rehab: w.programDayId != null && !!rehabProgramDays?.has(w.programDayId) },
    );
    for (const r of REGIONS) {
      if (!est.hours[r]) continue;
      const readyAt = ended + est.hours[r] * H;
      const cur = latest.get(r);
      if (!cur || readyAt > cur.end) latest.set(r, { start: ended, end: readyAt });
    }
  }
  return REGIONS.filter((r) => latest.has(r)).map((r) => {
    const { start, end } = latest.get(r)!;
    const percent = Math.round(clamp(((now.getTime() - start) / (end - start)) * 100, 0, 100));
    return { region: r, readyAt: new Date(end), percent };
  });
}
