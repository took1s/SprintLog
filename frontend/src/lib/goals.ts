// Kraft-Ziele: "Ich will 100 kg Bankdrücken" -> die App führt Einheit für Einheit dorthin.
//
// Methode (bewährt aus Kraftsport-Coaching, bewusst einfach und nachvollziehbar):
// - Trainiert wird in einer festen Wiederholungszahl (Zielwdh. 1-3 -> 5er-Sätze, sonst die Zielwdh.), 3 Arbeitssätze,
//   Startgewicht bei ca. RPE 8 (2 Wiederholungen Reserve), berechnet aus dem geschätzten 1RM.
// - Lineare Progression mit Autoregulation:
//     alle Sätze geschafft und RPE <= 9  -> nächstes Mal + Steigerung (bei sehr leichten Sätzen bis zu 3 Stufen)
//     Wiederholungen verfehlt            -> Gewicht wiederholen
//     zweimal in Folge verfehlt          -> Deload: 10 % runter und neu aufbauen
// - Reicht das Trainingsgewicht rechnerisch für das Ziel, wird ein Testtag vorgeschlagen.
// - Prognose: Trend des geschätzten 1RM (lineare Regression über die letzten 10 Wochen), sonst geplante Steigerung.
//
// e1RM nach Epley; mit RPE wird die Reserve eingerechnet (8 Wdh. @ RPE 8 ~ 10 Wdh. bis zum Versagen).

import type { Workout, WorkoutSet } from '../types';
import { epley1RM, exerciseKey, isWorkingSet, roundTo } from './analytics';

export interface LiftGoal {
  exerciseId: number;
  targetWeight: number;
  targetReps: number;
  increment: number;
  startE1RM: number | null;
  targetDate: string | null;
  createdAt: string;
  updatedAt?: string;
  achievedAt: string | null;
  /** Lokal geändert, noch nicht beim Server. */
  pending?: 'put' | 'delete';
}

export interface GoalSession { date: string; sets: WorkoutSet[] }

export type PrescriptionKind = 'start' | 'progress' | 'jump' | 'repeat' | 'deload' | 'test' | 'achieved';

export interface GoalPrescription {
  kind: PrescriptionKind;
  /** null = noch keine Daten (Startgewicht selbst wählen). */
  weight: number | null;
  reps: number;
  sets: number;
}

export interface GoalProgress {
  /** Aktuelles geschätztes 1RM (bestes der letzten zwei Einheiten). */
  current: number;
  start: number;
  target: number;
  /** 0-100 */
  percent: number;
  achieved: boolean;
  /** Trend in kg e1RM pro Woche (null = zu wenig Daten). */
  trendPerWeek: number | null;
  /** Voraussichtliches Datum (ISO) oder null. */
  eta: string | null;
  /** Prognose aus echtem Trend oder nur aus geplanter Steigerung. */
  etaSource: 'trend' | 'plan' | null;
  /** Mit Wunschdatum: nötige Steigerung pro Woche. */
  neededPerWeek: number | null;
  /** Mit Wunschdatum: Schaffbar im bisherigen Tempo? */
  onTrack: boolean | null;
  sessions: number;
}

export const WORK_SETS = 3;
/** Testtag erst, wenn das Trainingsgewicht rechnerisch klar reicht. */
const TEST_MARGIN = 1.03;
/** Ab so viel Steigerung pro Woche (Anteil am 1RM) gilt ein Wunschdatum als sehr ehrgeizig. */
const MAX_REALISTIC_WEEKLY = 0.015;
const DAY = 86_400_000;

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Trainingswiederholungen für ein Ziel: Maximalkraft-Ziele (1-3) werden über 5er-Sätze aufgebaut. */
export const trainingReps = (goal: Pick<LiftGoal, 'targetReps'>): number => (goal.targetReps <= 3 ? 5 : Math.min(goal.targetReps, 12));

/** Ziel als geschätztes 1RM. */
export const targetE1RM = (goal: Pick<LiftGoal, 'targetWeight' | 'targetReps'>): number => epley1RM(goal.targetWeight, goal.targetReps);

/** e1RM eines Satzes inkl. Reserve aus dem RPE. */
export function effectiveE1RM(set: Pick<WorkoutSet, 'weight' | 'reps' | 'rpe'>): number {
  const reps = set.reps ?? 0;
  const reserve = set.rpe != null && set.rpe >= 5 ? Math.max(0, 10 - set.rpe) : 0;
  return epley1RM(set.weight, Math.min(12, reps + reserve));
}

/** Gewicht für `reps` Wiederholungen bei ca. RPE 8 aus einem 1RM. */
export const workingWeight = (e1rm: number, reps: number, increment: number): number =>
  Math.max(increment, roundTo(e1rm / (1 + (reps + 2) / 30), increment));

/** Einheiten mit dieser Übung (nur Arbeitssätze), älteste zuerst. */
export function goalSessions(workouts: readonly Workout[], exerciseId: number): GoalSession[] {
  const key = `id:${exerciseId}`;
  return workouts
    .map((w) => ({ date: String(w.date), sets: (w.sets ?? []).filter((s) => exerciseKey(s) === key && isWorkingSet(s) && (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0) }))
    .filter((s) => s.sets.length)
    .sort((a, b) => a.date.localeCompare(b.date));
}

const sessionE1RM = (s: GoalSession): number => Math.max(0, ...s.sets.map(effectiveE1RM));

interface Outcome { weight: number; success: boolean; easy: boolean; e1rm: number }

/** Wie lief die Einheit gemessen an der Trainingswiederholungszahl? */
function outcome(session: GoalSession, reps: number): Outcome {
  const weight = Math.max(...session.sets.map((s) => s.weight ?? 0));
  const top = session.sets.filter((s) => (s.weight ?? 0) >= weight - 0.01);
  const maxRpe = Math.max(0, ...top.map((s) => s.rpe ?? 0));
  const success = top.every((s) => (s.reps ?? 0) >= reps) && maxRpe <= 9;
  const easy = success && top.every((s) => (s.reps ?? 0) >= reps + 3) && (maxRpe === 0 || maxRpe <= 7.5);
  return { weight, success, easy, e1rm: sessionE1RM(session) };
}

/** Ist das Ziel mit einem echten Satz erreicht? */
export const reachesGoal = (set: Pick<WorkoutSet, 'weight' | 'reps' | 'isWarmup'>, goal: Pick<LiftGoal, 'targetWeight' | 'targetReps'>): boolean =>
  !set.isWarmup && (set.weight ?? 0) >= goal.targetWeight - 0.01 && (set.reps ?? 0) >= goal.targetReps;

/** Vorgabe für die nächste Einheit. `sessions` = Einheiten seit Zielbeginn (älteste zuerst). */
export function nextPrescription(goal: LiftGoal, sessions: readonly GoalSession[]): GoalPrescription {
  const reps = trainingReps(goal);
  const inc = goal.increment > 0 ? goal.increment : 2.5;
  const since = sessions.filter((s) => s.date >= goal.createdAt.slice(0, 10) || !goal.createdAt);

  if (goal.achievedAt || since.some((s) => s.sets.some((x) => reachesGoal(x, goal)))) {
    return { kind: 'achieved', weight: goal.targetWeight, reps: goal.targetReps, sets: 1 };
  }

  const last = sessions.at(-1);
  if (!last) {
    const weight = goal.startE1RM ? workingWeight(goal.startE1RM, reps, inc) : null;
    return { kind: 'start', weight, reps, sets: WORK_SETS };
  }

  const now = outcome(last, reps);
  let kind: PrescriptionKind;
  let weight: number;
  if (now.success) {
    // Sehr leicht? Dann bis zu 3 Stufen springen - aber nie über das, was das e1RM hergibt.
    const fromE1rm = workingWeight(now.e1rm, reps, inc);
    const jump = now.easy ? Math.min(now.weight + 3 * inc, Math.max(now.weight + inc, fromE1rm)) : now.weight + inc;
    kind = jump > now.weight + inc + 0.01 ? 'jump' : 'progress';
    weight = jump;
  } else {
    const prev = sessions.at(-2);
    const prevFailed = prev ? !outcome(prev, reps).success && outcome(prev, reps).weight >= now.weight - 0.01 : false;
    kind = prevFailed ? 'deload' : 'repeat';
    weight = prevFailed ? Math.max(inc, roundTo(now.weight * 0.9, inc)) : now.weight;
  }

  // Trainingsgewicht reicht rechnerisch (mit 3 % Puffer, Epley überschätzt leicht) für das Ziel -> Testtag
  if (kind !== 'deload' && epley1RM(weight, reps + 2) >= targetE1RM(goal) * TEST_MARGIN) {
    return { kind: 'test', weight: goal.targetWeight, reps: goal.targetReps, sets: 1 };
  }
  return { kind, weight: Math.round(weight * 100) / 100, reps, sets: WORK_SETS };
}

/** Lineare Regression: Steigung in Einheiten pro Tag. */
function slopePerDay(points: readonly { x: number; y: number }[]): number | null {
  if (points.length < 3) return null;
  const mx = points.reduce((a, p) => a + p.x, 0) / points.length;
  const my = points.reduce((a, p) => a + p.y, 0) / points.length;
  const sxx = points.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  if (sxx < 7) return null; // Punkte liegen zu eng beieinander (unter ~1 Woche)
  return points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx;
}

/** Einheiten pro Woche mit dieser Übung in den letzten 6 Wochen (mind. 1). */
function frequency(sessions: readonly GoalSession[], now: Date): number {
  const from = now.getTime() - 42 * DAY;
  const recent = sessions.filter((s) => new Date(s.date).getTime() >= from).length;
  return Math.max(1, recent / 6);
}

export function goalProgress(goal: LiftGoal, sessions: readonly GoalSession[], now = new Date()): GoalProgress {
  const target = targetE1RM(goal);
  const lastTwo = sessions.slice(-2);
  const current = round1(Math.max(0, ...lastTwo.map(sessionE1RM)));
  const firstAfterStart = sessions.find((s) => s.date >= goal.createdAt.slice(0, 10));
  const start = round1(goal.startE1RM ?? (firstAfterStart ? sessionE1RM(firstAfterStart) : current));
  const achieved = !!goal.achievedAt || sessions.some((s) => s.date >= goal.createdAt.slice(0, 10) && s.sets.some((x) => reachesGoal(x, goal)));

  const span = target - start;
  // 100 % = rechnerisch stark genug (bestätigt wird es am Testtag); ohne Spanne zählt nur, ob das Ziel erreicht ist
  const percent = achieved ? 100 : span > 0 ? Math.max(0, Math.min(100, Math.round(((current - start) / span) * 100))) : current >= target ? 100 : 0;

  // Trend: letzte 10 Wochen
  const from = now.getTime() - 70 * DAY;
  const points = sessions
    .filter((s) => new Date(s.date).getTime() >= from)
    .map((s) => ({ x: (new Date(s.date).getTime() - from) / DAY, y: sessionE1RM(s) }));
  const perDay = slopePerDay(points);
  const trendPerWeek = perDay == null ? null : round1(perDay * 7);

  const remaining = Math.max(0, target - current);
  let eta: string | null = null;
  let etaSource: GoalProgress['etaSource'] = null;
  if (!achieved && remaining > 0) {
    if (trendPerWeek != null && trendPerWeek > 0.1) {
      eta = new Date(now.getTime() + (remaining / trendPerWeek) * 7 * DAY).toISOString();
      etaSource = 'trend';
    } else if (current > 0) {
      // Geplante Steigerung: pro erfolgreicher Einheit + Steigerung beim Trainingsgewicht; ~70 % der Einheiten klappen.
      const perSession = goal.increment * (1 + (trainingReps(goal) + 2) / 30) * 0.7;
      const weekly = perSession * frequency(sessions, now);
      eta = new Date(now.getTime() + (remaining / weekly) * 7 * DAY).toISOString();
      etaSource = 'plan';
    }
  }

  let neededPerWeek: number | null = null;
  let onTrack: boolean | null = null;
  if (goal.targetDate && !achieved) {
    const weeksLeft = (new Date(goal.targetDate).getTime() - now.getTime()) / (7 * DAY);
    neededPerWeek = weeksLeft > 0 ? round1(remaining / weeksLeft) : null;
    if (neededPerWeek != null) {
      onTrack = trendPerWeek != null ? trendPerWeek >= neededPerWeek : neededPerWeek <= Math.max(current, 1) * MAX_REALISTIC_WEEKLY;
    } else onTrack = false;
  }

  return { current, start, target: round1(target), percent, achieved, trendPerWeek, eta, etaSource, neededPerWeek, onTrack, sessions: sessions.length };
}

/** Ist ein Wunschdatum realistisch? (Anteil am aktuellen 1RM pro Woche) */
export function dateRealism(current: number, target: number, targetDate: string, now = new Date()): 'ok' | 'ambitious' | 'unrealistic' {
  const weeks = (new Date(targetDate).getTime() - now.getTime()) / (7 * DAY);
  if (weeks <= 0) return 'unrealistic';
  const weekly = Math.max(0, target - current) / weeks / Math.max(current, 1);
  if (weekly <= MAX_REALISTIC_WEEKLY * 0.67) return 'ok';
  if (weekly <= MAX_REALISTIC_WEEKLY * 1.5) return 'ambitious';
  return 'unrealistic';
}
