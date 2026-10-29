// Trainingspläne: nächster Tag, Zielvorgaben mit Double Progression, Belastungssteuerung (ACWR).
// Reine Funktionen ohne DOM/Netzwerk -> unit-getestet (tests/program.test.ts).

import { t, tDynamic } from '../i18n';
import { epley1RM, exerciseKey, isWorkingSet, sessionLoad, roundTo } from './analytics';
import type { Exercise, ProgramDay, ProgramExercise, TrainingProgram, WeekStep, Workout, WorkoutSet } from '../types';

const DAY_MS = 86_400_000;
const time = (d: string | Date) => new Date(d).getTime();

/** Aktuelle Woche des Plans (1-basiert) seit dem Start. */
export function currentWeek(program: Pick<TrainingProgram, 'startedAt'> | null | undefined, now = new Date()): number {
  if (!program?.startedAt) return 1;
  const days = Math.floor((now.getTime() - time(program.startedAt)) / DAY_MS);
  return Math.max(1, Math.floor(days / 7) + 1);
}

/** Einheiten, die zu diesem Plan gehören (über programDayId), neueste zuerst. */
// ---------- Periodisierung ----------

/** Woche innerhalb des Zyklus (1-basiert), z. B. Woche 6 bei 4-Wochen-Zyklus -> 2. Ohne Zyklus = Planwoche. */
export function cycleWeek(program: Pick<TrainingProgram, 'cycleWeeks'> | null | undefined, week: number): number {
  const cycle = program?.cycleWeeks;
  return cycle && cycle > 0 ? ((week - 1) % cycle) + 1 : week;
}

/** Jede N-te Planwoche ist eine Entlastungswoche (deloadEvery). */
export function isDeloadWeek(program: Pick<TrainingProgram, 'deloadEvery'> | null | undefined, week: number): boolean {
  const every = program?.deloadEvery;
  return !!every && every > 1 && week > 0 && week % every === 0;
}

/** Vorgabe einer Übung in einer bestimmten Woche: Grundwerte + gültige Wochen-Stufe + ggf. Entlastung. */
export interface EffectivePrescription extends ProgramExercise {
  /** Woche, nach der sich die Vorgabe richtet (Zyklus-Woche). */
  week: number;
  /** Ab welcher Woche die angewendete Stufe gilt (null = Grundwerte). */
  stepWeek: number | null;
  deload: boolean;
}

export function activeStep(steps: readonly WeekStep[] | null | undefined, week: number): WeekStep | null {
  let best: WeekStep | null = null;
  for (const step of steps ?? []) if (step.fromWeek <= week && (!best || step.fromWeek > best.fromWeek)) best = step;
  return best;
}

export function effectivePrescription(
  px: ProgramExercise,
  program: Pick<TrainingProgram, 'cycleWeeks' | 'deloadEvery'> | null | undefined,
  week: number,
): EffectivePrescription {
  const w = cycleWeek(program, week);
  const step = activeStep(px.weekSteps, w);
  const out: EffectivePrescription = {
    ...px,
    sets: step?.sets ?? px.sets,
    repsMin: step?.repsMin ?? px.repsMin,
    repsMax: step?.repsMax ?? px.repsMax,
    distance: step?.distance ?? px.distance,
    time: step?.time ?? px.time,
    percentOf1Rm: step?.percentOf1Rm ?? px.percentOf1Rm,
    targetRpe: step?.targetRpe ?? px.targetRpe,
    note: step?.note ?? px.note,
    week: w,
    stepWeek: step?.fromWeek ?? null,
    deload: isDeloadWeek(program, week),
  };
  if (out.deload) {
    // Entlastung: ~60 % der Sätze, Intensität runter - Anpassung kommt in der Erholung.
    out.sets = Math.max(1, Math.ceil(out.sets * 0.6));
    if (out.targetRpe) out.targetRpe = Math.max(5, out.targetRpe - 2);
    if (out.percentOf1Rm) out.percentOf1Rm = Math.round(out.percentOf1Rm * 0.9);
  }
  return out;
}

/** Bestes geschätztes 1RM (Epley, Arbeitssätze bis 12 Wdh.) der letzten `days` Tage. */
export function bestRecentE1RM(exerciseId: number, workouts: readonly Workout[] | null | undefined, now = new Date(), days = 120): number {
  const key = exerciseKey({ exerciseId });
  const since = now.getTime() - days * DAY_MS;
  let best = 0;
  for (const w of workouts ?? []) {
    if (time(w.date) < since) continue;
    for (const s of w.sets ?? []) if (exerciseKey(s) === key && isWorkingSet(s)) best = Math.max(best, epley1RM(s.weight, s.reps));
  }
  return best;
}

export function programWorkouts(program: Pick<TrainingProgram, 'days'> | null | undefined, workouts: readonly Workout[] | null | undefined): Workout[] {
  const dayIds = new Set((program?.days ?? []).map((d) => d.id));
  return (workouts ?? [])
    .filter((w) => w.programDayId != null && dayIds.has(w.programDayId))
    .sort((a, b) => time(b.date) - time(a.date));
}

export interface ProgramStatus {
  week: number;
  weeks: number;
  finished: boolean;
  sessions: number;
  lastByDay: Map<number, string>;
  next: ProgramDay | null;
  lastDate: string | null;
}

/** Fortschritt im Plan: erledigte Einheiten seit Start, zuletzt erledigter Tag je Tag, nächster Tag (Rotation). */
export function programStatus(program: TrainingProgram, workouts: readonly Workout[] | null | undefined, now = new Date()): ProgramStatus {
  const days = [...(program?.days ?? [])].sort((a, b) => a.position - b.position);
  const done = programWorkouts(program, workouts);
  const since = program?.startedAt ? time(program.startedAt) : 0;
  const doneSinceStart = done.filter((w) => time(w.date) >= since);

  const lastByDay = new Map<number, string>();
  for (const w of done) if (!lastByDay.has(w.programDayId!)) lastByDay.set(w.programDayId!, w.date);

  let next: ProgramDay | null = days[0] ?? null;
  if (done.length && days.length) {
    const lastIndex = days.findIndex((d) => d.id === done[0].programDayId);
    next = days[(lastIndex + 1) % days.length];
  }

  const week = currentWeek(program, now);
  return {
    week,
    weeks: program?.weeks ?? 0,
    finished: week > (program?.weeks ?? Infinity),
    sessions: doneSinceStart.length,
    lastByDay,
    next,
    lastDate: done[0]?.date ?? null,
  };
}

/** Letzte Einheit, in der die Übung als Arbeitssatz vorkam - mit diesen Sätzen. */
function lastPerformance(exerciseId: number, workouts: readonly Workout[] | null | undefined): { date: string; sets: WorkoutSet[] } | null {
  const key = exerciseKey({ exerciseId });
  const sorted = [...(workouts ?? [])].sort((a, b) => time(b.date) - time(a.date));
  for (const w of sorted) {
    const sets = (w.sets ?? []).filter((s) => exerciseKey(s) === key && isWorkingSet(s));
    if (sets.length) return { date: w.date, sets };
  }
  return null;
}

export interface TargetSuggestion {
  kind: 'new' | 'progress' | 'repeat' | 'reference' | 'percent' | 'deload';
  weight?: number | null;
  reps?: number;
  distance?: number | null;
  time?: number | null;
  /** Englischer Text (Referenz, u. a. für Tests); angezeigt wird suggestionNote() in der aktuellen Sprache. */
  note: string;
  noteKey: SuggestionKey;
  noteParams?: Record<string, string | number>;
}

export type SuggestionKey = 'none' | 'reference' | 'sprintNew' | 'holdMore' | 'hold' | 'pickWeight' | 'repRange' | 'addWeight' | 'topReached' | 'sameWeight'
  | 'percent' | 'percentNoMax' | 'deload' | 'deloadEasy';

/** Hinweis einer Zielvorgabe in der aktuellen Sprache. */
export const suggestionNote = (s: Pick<TargetSuggestion, 'note' | 'noteKey' | 'noteParams'>): string =>
  s.noteKey === 'none' ? '' : tDynamic(`plan.suggest.${s.noteKey}`, s.note, s.noteParams);

/** 25 -> "25 s", 480 -> "8:00" (ohne Sprachabhängigkeit der Einheit bei Minuten). */
export function formatDurationShort(seconds: number | null | undefined): string {
  const v = Math.round(seconds ?? 0);
  if (v < 60) return `${v} ${t('units.s')}`;
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

/**
 * Zielvorgabe für die nächste Einheit (Double Progression):
 *  - Alle geplanten Sätze haben das obere Ende des Wdh.-Bereichs erreicht -> Gewicht + Steigerung, Wdh. wieder unten.
 *  - Sonst gleiches Gewicht, eine Wiederholung mehr als beim schwächsten Satz (innerhalb des Bereichs).
 *  - Keine Historie -> Gewicht selbst wählen (ca. 2 Wdh. Reserve).
 */
export function suggestTarget(
  px: ProgramExercise & { deload?: boolean },
  workouts: readonly Workout[] | null | undefined,
  now = new Date(),
): TargetSuggestion {
  const type = px.trackingType ?? 'WeightReps';
  // Prozentbasiert (z. B. 5/3/1): Gewicht = % des besten geschätzten 1RM.
  if (type === 'WeightReps' && px.percentOf1Rm) {
    const reps = px.repsMax ?? px.repsMin ?? 5;
    const max = bestRecentE1RM(px.exerciseId, workouts, now);
    if (!max) {
      return { kind: 'new', weight: null, reps, note: `Work up to a heavy set of 3-5 reps first - then weights are calculated at ${px.percentOf1Rm} %`, noteKey: 'percentNoMax', noteParams: { pct: px.percentOf1Rm } };
    }
    const weight = roundTo((max * px.percentOf1Rm) / 100, 2.5);
    return { kind: 'percent', weight, reps, note: `${px.percentOf1Rm} % of your estimated 1RM (${roundTo(max, 0.5)} kg)`, noteKey: 'percent', noteParams: { pct: px.percentOf1Rm, max: roundTo(max, 0.5) } };
  }

  const base = baseSuggestion(px, workouts);
  if (!px.deload) return base;
  if (base.weight && base.weight > 0) {
    const weight = roundTo(base.weight * 0.9, 2.5);
    return { ...base, kind: 'deload', weight, note: `Deload week: ${weight} kg, fewer sets, easy reps`, noteKey: 'deload', noteParams: { weight } };
  }
  return { ...base, kind: 'deload', note: 'Deload week: fewer sets, keep it easy', noteKey: 'deloadEasy', noteParams: undefined };
}

function baseSuggestion(px: ProgramExercise, workouts: readonly Workout[] | null | undefined): TargetSuggestion {
  const last = lastPerformance(px.exerciseId, workouts);
  const type = px.trackingType ?? 'WeightReps';

  if (type === 'DistanceTime') {
    const atDistance = last?.sets.filter((s) => s.distance === px.distance && (s.time ?? 0) > 0) ?? [];
    const best = atDistance.length ? Math.min(...atDistance.map((s) => s.time!)) : null;
    return {
      kind: best ? 'reference' : 'new',
      distance: px.distance ?? last?.sets[0]?.distance ?? null,
      time: best ?? null,
      note: best ? `Last best ${best} s over ${px.distance} m` : 'Run at full speed, full rest between reps',
      // Eigener Hinweis der Vorgabe (z. B. "75-80 % Tempo") hat Vorrang vor dem allgemeinen Sprint-Hinweis.
      noteKey: best ? 'reference' : px.note ? 'none' : 'sprintNew',
      noteParams: best ? { time: best, distance: px.distance ?? '' } : undefined,
    };
  }

  if (type === 'Duration') {
    const lastMin = last ? Math.min(...last.sets.map((s) => s.time ?? 0)) : 0;
    const allHit = !!last && last.sets.length >= px.sets && lastMin >= (px.time ?? 0);
    const t = allHit ? Math.max(px.time ?? 0, lastMin) + 5 : px.time ?? lastMin;
    // Lange Dauern (Läufe, Intervalle) nicht steigern - nur Halteübungen bis 2 min bekommen +5 s.
    const holdLike = (px.time ?? 0) <= 120;
    const target = allHit && holdLike ? t : px.time ?? lastMin;
    return {
      kind: allHit && holdLike ? 'progress' : last ? 'repeat' : 'new',
      time: target,
      note: allHit && holdLike ? '+5 s - all holds completed last time' : `Target ${target} s`,
      noteKey: allHit && holdLike ? 'holdMore' : px.note && !last ? 'none' : 'hold',
      noteParams: { time: formatDurationShort(target) },
    };
  }

  const min = px.repsMin ?? px.repsMax ?? 8;
  const max = px.repsMax ?? px.repsMin ?? 8;
  const step = px.progressionStep ?? 2.5;
  if (!last) {
    return step > 0
      ? { kind: 'new', weight: null, reps: max, note: `Pick a weight for ${max} reps with ~2 reps in reserve`, noteKey: 'pickWeight', noteParams: { reps: max } }
      : { kind: 'new', weight: 0, reps: min, note: `${min}-${max} reps per set`, noteKey: 'repRange', noteParams: { min, max } };
  }

  const topWeight = Math.max(...last.sets.map((s) => s.weight ?? 0));
  const topSets = last.sets.filter((s) => (s.weight ?? 0) === topWeight);
  const weakest = Math.min(...topSets.map((s) => s.reps ?? 0));
  const allHitTop = topSets.length >= px.sets && weakest >= max;

  if (allHitTop && step > 0) {
    return { kind: 'progress', weight: roundTo(topWeight + step, 0.25), reps: min, note: `+${step} kg - you hit ${max} reps on all sets`, noteKey: 'addWeight', noteParams: { step, max } };
  }
  if (allHitTop) {
    return { kind: 'progress', weight: topWeight, reps: max, note: 'Top of the range reached - add load or a harder variation', noteKey: 'topReached' };
  }
  const reps = Math.min(max, Math.max(min, weakest + 1));
  return { kind: 'repeat', weight: topWeight, reps, note: `Same weight, aim for ${reps} reps (range ${min}-${max})`, noteKey: 'sameWeight', noteParams: { reps, min, max } };
}

/** Kurzform einer Vorgabe: "4 × 5-8 · RPE 8 · 2:00 rest" */
export function prescriptionText(px: ProgramExercise): string {
  const parts: string[] = [];
  if (px.trackingType === 'DistanceTime') parts.push(`${px.sets} × ${px.distance} ${t('units.m')}`);
  else if (px.trackingType === 'Duration') parts.push(`${px.sets} × ${formatDurationShort(px.time)}`);
  else parts.push(`${px.sets} × ${px.repsMin === px.repsMax || px.repsMax == null ? px.repsMin ?? px.repsMax : `${px.repsMin}-${px.repsMax}`}`);
  if (px.percentOf1Rm) parts.push(t('plan.prescription.percent', { pct: px.percentOf1Rm }));
  if (px.targetRpe) parts.push(t('plan.prescription.rpe', { rpe: px.targetRpe }));
  if (px.restSeconds) parts.push(t('plan.prescription.rest', { time: `${Math.floor(px.restSeconds / 60)}:${String(px.restSeconds % 60).padStart(2, '0')}` }));
  return parts.join(' · ');
}

/** Wie viele Arbeitssätze einer Vorgabe in der laufenden Session schon erledigt sind. */
export function setsDone(exerciseId: number, sessionSets: readonly WorkoutSet[] | null | undefined): number {
  return (sessionSets ?? []).filter((s) => s.exerciseId === exerciseId && isWorkingSet(s)).length;
}

export type LoadZone = 'unknown' | 'low' | 'optimal' | 'high' | 'danger';

export interface LoadStatus {
  acute: number;
  chronic: number;
  ratio: number | null;
  zone: LoadZone;
  enoughData: boolean;
  coverage: { withRpe: number; total: number };
}

/**
 * Belastungssteuerung nach dem Acute:Chronic Workload Ratio (Gabbett).
 * acute = Last der letzten 7 Tage, chronic = Durchschnitt pro Woche der letzten 28 Tage.
 * Zonen: < 0.8 niedrig, 0.8-1.3 optimal ("sweet spot"), 1.3-1.5 erhöht, > 1.5 hohes Verletzungsrisiko.
 */
export function loadStatus(workouts: readonly Workout[] | null | undefined, now = new Date()): LoadStatus {
  const t = now.getTime();
  const inRange = (w: Workout, days: number) => {
    const d = time(w.date);
    return d <= t && d > t - days * DAY_MS;
  };
  const last28 = (workouts ?? []).filter((w) => inRange(w, 28));
  const withLoad = last28.filter((w) => sessionLoad(w) > 0);
  const acute = (workouts ?? []).filter((w) => inRange(w, 7)).reduce((sum, w) => sum + sessionLoad(w), 0);
  const chronic = withLoad.reduce((sum, w) => sum + sessionLoad(w), 0) / 4;

  const weeksWithData = new Set(withLoad.map((w) => Math.floor((t - time(w.date)) / (7 * DAY_MS)))).size;
  const enoughData = weeksWithData >= 3 && chronic > 0;
  const ratio = enoughData ? Math.round((acute / chronic) * 100) / 100 : null;

  let zone: LoadZone = 'unknown';
  if (ratio !== null) zone = ratio < 0.8 ? 'low' : ratio <= 1.3 ? 'optimal' : ratio <= 1.5 ? 'high' : 'danger';

  return {
    acute: Math.round(acute),
    chronic: Math.round(chronic),
    ratio,
    zone,
    enoughData,
    coverage: { withRpe: withLoad.length, total: last28.length },
  };
}

export type Tone = 'slate' | 'blue' | 'green' | 'orange' | 'red';

export const ZONE_INFO: Readonly<Record<LoadZone, { label: string; tone: Tone; advice: string }>> = Object.freeze({
  unknown: { label: 'Not enough data', tone: 'slate', advice: 'Rate your sessions (session RPE) for 3+ weeks to unlock load tracking.' },
  low: { label: 'Low', tone: 'blue', advice: 'Load is below your usual level - fine for a deload, otherwise build up gradually.' },
  optimal: { label: 'Sweet spot', tone: 'green', advice: 'Load matches what your body is used to. Keep it steady.' },
  high: { label: 'Elevated', tone: 'orange', advice: 'Load rises quickly. Plan an easier day and sleep well.' },
  danger: { label: 'Spike', tone: 'red', advice: 'Load spike vs. the last 4 weeks - higher injury risk. Reduce volume or intensity.' },
});

// ---------- Editor ----------

/** Wert eines Formularfelds: Zahl, leer ('') oder Text aus einem Eingabefeld. */
export type FormNumber = number | string | null;

/** Zeile im Editor (Felder kommen direkt aus Eingabefeldern). */
export interface DraftExercise {
  exerciseId: FormNumber;
  sets: FormNumber;
  repsMin?: FormNumber;
  repsMax?: FormNumber;
  distance?: FormNumber;
  time?: FormNumber;
  targetRpe?: FormNumber;
  restSeconds?: FormNumber;
  progressionStep?: FormNumber;
  percentOf1Rm?: FormNumber;
  note?: string;
  weekSteps?: DraftStep[];
}
/** Wochen-Stufe im Editor (leere Felder = Grundwert der Übung). */
export interface DraftStep {
  fromWeek: FormNumber;
  sets?: FormNumber;
  repsMin?: FormNumber;
  repsMax?: FormNumber;
  distance?: FormNumber;
  time?: FormNumber;
  percentOf1Rm?: FormNumber;
  note?: string;
}
export interface DraftDay { id: number | null; name: string; notes: string; exercises: DraftExercise[] }
export interface ProgramDraft {
  id: number | null; name: string; goal: string; weeks: FormNumber; days: DraftDay[];
  cycleWeeks?: FormNumber; deloadEvery?: FormNumber;
}

/** Leeres Programm für den Editor. */
export const emptyProgramDraft = (): ProgramDraft => ({
  id: null,
  name: '',
  goal: 'Strength',
  weeks: 8,
  days: [{ id: null, name: 'Day A', notes: '', exercises: [] }],
  cycleWeeks: null,
  deloadEvery: null,
});

export const emptyDraftRow = (): DraftExercise => ({
  exerciseId: '', sets: 3, repsMin: 8, repsMax: 10, distance: 20, time: 30, targetRpe: null, restSeconds: 90, progressionStep: 2.5,
  percentOf1Rm: null, note: '', weekSteps: [],
});

/** Neue Wochen-Stufe: eine Woche nach der letzten, Werte noch leer (= wie bisher). */
export function newDraftStep(row: DraftExercise, maxWeek: number): DraftStep {
  const last = Math.max(1, ...(row.weekSteps ?? []).map((st) => Number(st.fromWeek) || 1));
  return { fromWeek: Math.min(maxWeek, (row.weekSteps?.length ? last : 1) + 1), sets: null, repsMin: null, repsMax: null, distance: null, time: null, percentOf1Rm: null, note: '' };
}

/** Programm (API) -> bearbeitbare Kopie für den Editor. */
export function toDraft(program: TrainingProgram): ProgramDraft {
  return {
    id: program.id,
    name: program.name,
    goal: program.goal,
    weeks: program.weeks,
    cycleWeeks: program.cycleWeeks ?? null,
    deloadEvery: program.deloadEvery ?? null,
    days: program.days.map((d) => ({
      id: d.id,
      name: d.name,
      notes: d.notes ?? '',
      exercises: d.exercises.map((x) => ({
        exerciseId: x.exerciseId, sets: x.sets, repsMin: x.repsMin ?? null, repsMax: x.repsMax ?? null, distance: x.distance ?? null,
        time: x.time ?? null, targetRpe: x.targetRpe ?? null, restSeconds: x.restSeconds ?? null, progressionStep: x.progressionStep ?? null,
        percentOf1Rm: x.percentOf1Rm ?? null, note: x.note ?? '',
        weekSteps: (x.weekSteps ?? []).map((st) => ({
          fromWeek: st.fromWeek, sets: st.sets ?? null, repsMin: st.repsMin ?? null, repsMax: st.repsMax ?? null,
          distance: st.distance ?? null, time: st.time ?? null, percentOf1Rm: st.percentOf1Rm ?? null, note: st.note ?? '',
        })),
      })),
    })),
  };
}

export interface ProgramPayload {
  name: string;
  goal: string;
  weeks: number;
  cycleWeeks: number | null;
  deloadEvery: number | null;
  days: { id: number | null; name: string; notes: string | null; exercises: Omit<ProgramExercise, 'id' | 'position' | 'exerciseName' | 'trackingType' | 'muscleGroup'>[] }[];
}

/** Editor-Entwurf -> API-Payload; Felder passend zum Tracking-Typ der Übung. */
export function draftToPayload(draft: ProgramDraft, exercisesById: ReadonlyMap<number, Pick<Exercise, 'trackingType'>>): ProgramPayload {
  const num = (v: unknown): number | null => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
  return {
    name: draft.name.trim(),
    goal: draft.goal,
    weeks: Number(draft.weeks) || 1,
    cycleWeeks: num(draft.cycleWeeks),
    deloadEvery: num(draft.deloadEvery),
    days: draft.days.map((d) => ({
      id: d.id ?? null,
      name: d.name.trim(),
      notes: d.notes?.trim() || null,
      exercises: d.exercises.filter((x) => x.exerciseId).map((x) => {
        const type = exercisesById.get(Number(x.exerciseId))?.trackingType ?? 'WeightReps';
        return {
          exerciseId: Number(x.exerciseId),
          sets: num(x.sets) ?? 3,
          repsMin: type === 'WeightReps' ? num(x.repsMin) ?? num(x.repsMax) ?? 8 : null,
          repsMax: type === 'WeightReps' ? num(x.repsMax) ?? num(x.repsMin) ?? 8 : null,
          distance: type === 'DistanceTime' ? num(x.distance) ?? 20 : null,
          time: type === 'Duration' ? num(x.time) ?? 30 : null,
          targetRpe: num(x.targetRpe),
          restSeconds: num(x.restSeconds),
          progressionStep: type === 'WeightReps' ? num(x.progressionStep) ?? 2.5 : null,
          percentOf1Rm: type === 'WeightReps' ? num(x.percentOf1Rm) : null,
          note: x.note?.trim() || null,
          weekSteps: (x.weekSteps ?? [])
            .filter((st) => num(st.fromWeek))
            .map((st) => ({
              fromWeek: num(st.fromWeek)!,
              sets: num(st.sets),
              repsMin: type === 'WeightReps' ? num(st.repsMin) : null,
              repsMax: type === 'WeightReps' ? num(st.repsMax) ?? num(st.repsMin) : null,
              distance: type === 'DistanceTime' ? num(st.distance) : null,
              time: type === 'Duration' ? num(st.time) : null,
              percentOf1Rm: type === 'WeightReps' ? num(st.percentOf1Rm) : null,
              targetRpe: null,
              note: st.note?.trim() || null,
            }))
            .sort((a, b) => a.fromWeek - b.fromWeek),
        };
      }),
    })),
  };
}

// ---------- Fortschritt im Plan ----------

export interface ExerciseProgress { exerciseId: number; name?: string; start: number; current: number; change: number }

function bestE1RMBetween(exerciseId: number, workouts: readonly Workout[] | null | undefined, from: number, to: number): number {
  const key = exerciseKey({ exerciseId });
  let best = 0;
  for (const w of workouts ?? []) {
    const ts = time(w.date);
    if (ts < from || ts > to) continue;
    for (const s of w.sets ?? []) if (exerciseKey(s) === key && isWorkingSet(s)) best = Math.max(best, epley1RM(s.weight, s.reps));
  }
  return best;
}

/**
 * Geschätztes 1RM zu Beginn des Plans (4 Wochen davor bis 2 Wochen danach) vs. jetzt (letzte 3 Wochen),
 * für die Kraftübungen des Plans. Erst ab 3 Wochen Laufzeit, sonst wäre "jetzt" = "Start".
 */
export function programProgress(
  program: Pick<TrainingProgram, 'startedAt' | 'days'> | null | undefined,
  workouts: readonly Workout[] | null | undefined,
  now = new Date(),
  limit = 5,
): ExerciseProgress[] {
  if (!program?.startedAt) return [];
  const start = time(program.startedAt);
  const t = now.getTime();
  if (t - start < 21 * DAY_MS) return [];
  const seen = new Map<number, string | undefined>();
  for (const d of program.days) for (const x of d.exercises) if ((x.trackingType ?? 'WeightReps') === 'WeightReps') seen.set(x.exerciseId, x.exerciseName);
  const out: ExerciseProgress[] = [];
  for (const [exerciseId, name] of seen) {
    const startValue = bestE1RMBetween(exerciseId, workouts, start - 28 * DAY_MS, start + 14 * DAY_MS);
    const current = bestE1RMBetween(exerciseId, workouts, t - 21 * DAY_MS, t);
    if (!startValue || !current) continue;
    out.push({ exerciseId, name, start: startValue, current, change: Math.round(((current - startValue) / startValue) * 1000) / 10 });
  }
  return out.sort((a, b) => b.change - a.change).slice(0, limit);
}
