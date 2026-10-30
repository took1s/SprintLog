// Reine Funktionen für Kennzahlen und Auswertungen.
// Kein DOM, kein Vue, kein Netzwerk -> mit Vitest unit-testbar.

import type { TrackingType as TrackingTypeValue, Workout, WorkoutSet } from '../types';

export const TrackingType = Object.freeze({
  WeightReps: 'WeightReps',
  DistanceTime: 'DistanceTime',
  Duration: 'Duration',
} as const satisfies Record<string, TrackingTypeValue>);

const DAY_MS = 24 * 60 * 60 * 1000;

type MaybeSet = WorkoutSet | null | undefined;
type DateInput = Date | string | number;

// ---------- Basis-Metriken ----------

/** Tracking-Typ eines Satzes. Ältere Daten haben keinen Typ -> aus den Werten ableiten. */
export function trackingOf(set: MaybeSet): TrackingTypeValue {
  if (set?.trackingType) return set.trackingType;
  if ((set?.weight ?? 0) > 0 || (set?.reps ?? 0) > 0) return TrackingType.WeightReps;
  if ((set?.distance ?? 0) > 0) return TrackingType.DistanceTime;
  if ((set?.time ?? 0) > 0) return TrackingType.Duration;
  return TrackingType.WeightReps;
}

/** Geschätztes 1-Rep-Max nach Epley. Über 12 Wiederholungen wird die Formel zu ungenau -> 0 (keine Schätzung). */
export function epley1RM(weight: number | null | undefined, reps: number | null | undefined): number {
  if (!(weight! > 0) || !(reps! > 0)) return 0;
  if (reps === 1) return round1(weight!);
  if (reps! > 12) return 0;
  return round1(weight! * (1 + reps! / 30));
}

/** Arbeitssatz = kein Aufwärmsatz. Nur Arbeitssätze zählen für Rekorde, Volumen und Verläufe. */
export const isWorkingSet = (set: MaybeSet): boolean => !set?.isWarmup;

export const setVolume = (set: MaybeSet): number =>
  isWorkingSet(set) && (set?.weight ?? 0) > 0 && (set?.reps ?? 0) > 0 ? set!.weight! * set!.reps! : 0;

/** Trainingslast nach Foster: Session-RPE × Dauer in Minuten (Arbitrary Units). */
export const sessionLoad = (workout: Pick<Workout, 'sessionRpe' | 'durationSeconds'> | null | undefined): number =>
  (workout?.sessionRpe ?? 0) > 0 && (workout?.durationSeconds ?? 0) > 0
    ? Math.round(workout!.sessionRpe! * (workout!.durationSeconds! / 60))
    : 0;

/** Geschwindigkeit in m/s. */
export const setSpeed = (set: Pick<WorkoutSet, 'distance' | 'time'> | null | undefined): number =>
  (set?.distance ?? 0) > 0 && (set?.time ?? 0) > 0 ? set!.distance! / set!.time! : 0;

export const msToKmh = (ms: number): number => ms * 3.6;

export interface TrainingZone { key: string; name: string; color: string }

/** Trainingszone nach Wiederholungsbereich. */
export function trainingZone(reps: number | null | undefined): TrainingZone {
  if (!(reps! > 0)) return { key: 'none', name: 'Awaiting metrics', color: 'text-slate-500' };
  if (reps! <= 5) return { key: 'strength', name: 'Strength / Power', color: 'text-red-400' };
  if (reps! <= 12) return { key: 'hypertrophy', name: 'Hypertrophy', color: 'text-accent' };
  return { key: 'endurance', name: 'Endurance', color: 'text-emerald-400' };
}

/** Rundet auf das nächste Vielfache von step (z. B. 2.5 kg Scheiben). */
export const roundTo = (value: number, step: number): number => Math.round(value / step) * step;

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Eindeutiger Schlüssel einer Übung - ID bevorzugt, Name als Fallback für Altdaten. */
export const exerciseKey = (set: MaybeSet): string =>
  set?.exerciseId ? `id:${set.exerciseId}` : `name:${set?.exerciseName ?? set?.name ?? '?'}`;

// ---------- Datum ----------

/** Lokales Datum als YYYY-MM-DD (nicht UTC - ein Training um 23:30 gehört zum selben Tag). */
export function dateKey(input: DateInput): string {
  const d = input instanceof Date ? input : new Date(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Montag 00:00 (lokal) der Woche - ISO-Woche, wie in Deutschland üblich. */
export function startOfWeek(input: DateInput): Date {
  const d = new Date(input instanceof Date ? input.getTime() : input);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 6) % 7; // So=0 -> 6, Mo=1 -> 0
  d.setDate(d.getDate() - diff);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

const time = (input: DateInput) => new Date(input).getTime();

// ---------- Einheiten ----------

export interface WorkoutSummary {
  sets: number;
  workingSets: number;
  warmups: number;
  load: number;
  exercises: number;
  volume: number;
  distance: number;
  durationWork: number;
}

/** Kennzahlen einer Einheit. */
export function summarizeWorkout(workout: Partial<Pick<Workout, 'sets' | 'sessionRpe' | 'durationSeconds'>> | null | undefined): WorkoutSummary {
  const sets = workout?.sets ?? [];
  let volume = 0;
  let distance = 0;
  let durationWork = 0;
  const exercises = new Set<string>();

  let warmups = 0;
  for (const s of sets) {
    exercises.add(exerciseKey(s));
    if (!isWorkingSet(s)) { warmups += 1; continue; }
    volume += setVolume(s);
    const type = trackingOf(s);
    if (type === TrackingType.DistanceTime && (s.distance ?? 0) > 0) distance += s.distance!;
    if (type === TrackingType.Duration && (s.time ?? 0) > 0) durationWork += s.time!;
  }

  return {
    sets: sets.length,
    workingSets: sets.length - warmups,
    warmups,
    load: sessionLoad(workout as Workout),
    exercises: exercises.size,
    volume: round1(volume),
    distance: round1(distance),
    durationWork: round1(durationWork),
  };
}

/** Sortiert Einheiten aufsteigend nach Datum (für chronologische Auswertungen). */
const chronological = <T extends Pick<Workout, 'date' | 'id'>>(workouts: readonly T[] | null | undefined): T[] =>
  [...(workouts ?? [])].sort((a, b) => time(a.date) - time(b.date) || (a.id ?? 0) - (b.id ?? 0));

export type IndexedSet = WorkoutSet & { index: number };
export interface SetGroup { key: string; exerciseId: number | null; name: string | undefined; trackingType: TrackingTypeValue; sets: IndexedSet[] }

/** Gruppiert die Sätze einer Einheit nach Übung (Reihenfolge des ersten Auftretens bleibt erhalten). */
export function groupSetsByExercise(sets: readonly WorkoutSet[] | null | undefined): SetGroup[] {
  const groups: SetGroup[] = [];
  const index = new Map<string, number>();
  (sets ?? []).forEach((set, i) => {
    const key = exerciseKey(set);
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ key, exerciseId: set.exerciseId ?? null, name: set.exerciseName ?? set.name, trackingType: trackingOf(set), sets: [] });
    }
    groups[index.get(key)!].sets.push({ ...set, index: i });
  });
  return groups;
}

// ---------- Rekorde ----------

export interface RecordValue { value: number; date: string }
export type RecordField = 'maxWeight' | 'maxE1RM' | 'maxVolume' | 'topSpeed' | 'maxDistance' | 'longest';

export interface ExerciseRecord extends Record<RecordField, RecordValue | null> {
  key: string;
  exerciseId: number | null;
  name: string | undefined;
  trackingType: TrackingTypeValue;
  lastDate: string | null;
  sessions: number;
}

function emptyRecord(set: WorkoutSet): ExerciseRecord {
  return {
    key: exerciseKey(set),
    exerciseId: set.exerciseId ?? null,
    name: set.exerciseName ?? set.name,
    trackingType: trackingOf(set),
    maxWeight: null,
    maxE1RM: null,
    maxVolume: null,
    topSpeed: null,    // m/s
    maxDistance: null,
    longest: null,     // Sekunden (Duration)
    lastDate: null,
    sessions: 0,
  };
}

const better = (current: RecordValue | null, value: number) => value > 0 && (current === null || value > current.value);

/** Bestwerte pro Übung über die gesamte Historie (exerciseKey -> Record). */
export function computeRecords(workouts: readonly Workout[] | null | undefined): Map<string, ExerciseRecord> {
  const records = new Map<string, ExerciseRecord>();
  for (const w of chronological(workouts)) {
    const seenInWorkout = new Set<string>();
    for (const s of w.sets ?? []) {
      if (!isWorkingSet(s)) continue;
      const key = exerciseKey(s);
      if (!records.has(key)) records.set(key, emptyRecord(s));
      const r = records.get(key)!;
      if (!seenInWorkout.has(key)) {
        r.sessions += 1;
        seenInWorkout.add(key);
      }
      r.lastDate = w.date;

      const candidates: Record<RecordField, number> = {
        maxWeight: s.weight ?? 0,
        maxE1RM: epley1RM(s.weight, s.reps),
        maxVolume: setVolume(s),
        topSpeed: setSpeed(s),
        maxDistance: trackingOf(s) === TrackingType.DistanceTime ? s.distance ?? 0 : 0,
        longest: trackingOf(s) === TrackingType.Duration ? s.time ?? 0 : 0,
      };
      for (const [field, value] of Object.entries(candidates) as [RecordField, number][]) {
        if (better(r[field], value)) r[field] = { value: round2(value), date: w.date };
      }
    }
  }
  return records;
}

type PrField = 'maxWeight' | 'maxVolume' | 'topSpeed' | 'maxDistance' | 'longest';
export type BadgeTone = 'gold' | 'orange' | 'green';
export interface PrBadge { field: PrField; label: string; icon: string; tone: BadgeTone }
export interface PrEvent extends PrBadge { key: string; date: string; name: string | undefined; value: number; previous: number }

const PR_BADGES: Record<PrField, Omit<PrBadge, 'field'>> = {
  maxWeight: { label: 'MAX WT', icon: '👑', tone: 'gold' },
  maxVolume: { label: 'MAX VOL', icon: '🔥', tone: 'orange' },
  topSpeed: { label: 'TOP SPD', icon: '⚡', tone: 'green' },
  maxDistance: { label: 'MAX DIST', icon: '👑', tone: 'gold' },
  longest: { label: 'LONGEST', icon: '⏱', tone: 'green' },
};

/**
 * Erkennt historische Rekorde: ein Satz bekommt ein Badge, wenn er zum Zeitpunkt des Trainings
 * den bisherigen Bestwert übertroffen hat. Der allererste Satz einer Übung zählt nicht (kein Vergleich).
 * badges: Schlüssel `${workoutKey}#${setIndex}` -> Liste von Badges; events: alle PR-Ereignisse, neueste zuerst.
 */
export function detectPRs(workouts: readonly Workout[] | null | undefined): { badges: Map<string, PrBadge[]>; events: PrEvent[] } {
  const best = new Map<string, Record<PrField, number>>();
  const badges = new Map<string, PrBadge[]>();
  const events: PrEvent[] = [];

  for (const w of chronological(workouts)) {
    const wKey = workoutKey(w);
    (w.sets ?? []).forEach((s, index) => {
      if (!isWorkingSet(s)) return;
      const key = exerciseKey(s);
      const values: Record<PrField, number> = {
        maxWeight: s.weight ?? 0,
        maxVolume: setVolume(s),
        topSpeed: setSpeed(s),
        maxDistance: trackingOf(s) === TrackingType.DistanceTime ? s.distance ?? 0 : 0,
        longest: trackingOf(s) === TrackingType.Duration ? s.time ?? 0 : 0,
      };
      const previous = best.get(key);
      if (!previous) {
        best.set(key, { ...values });
        return;
      }
      for (const [field, value] of Object.entries(values) as [PrField, number][]) {
        if (value > 0 && value > (previous[field] ?? 0) + 1e-9) {
          if ((previous[field] ?? 0) > 0) {
            const badge: PrBadge = { field, ...PR_BADGES[field] };
            const list = badges.get(`${wKey}#${index}`) ?? [];
            list.push(badge);
            badges.set(`${wKey}#${index}`, list);
            events.push({ ...badge, key, date: w.date, name: s.exerciseName ?? s.name, value: round2(value), previous: round2(previous[field]) });
          }
          previous[field] = value;
        }
      }
    });
  }

  events.reverse();
  return { badges, events };
}

/** Stabiler Schlüssel einer Einheit (Server-ID oder Client-ID bei noch nicht synchronisierten). */
export const workoutKey = (w: Pick<Workout, 'id' | 'clientId' | 'date'> | null | undefined): string =>
  w?.id ? `w:${w.id}` : `c:${w?.clientId ?? w?.date}`;

// ---------- Zeitreihen ----------

export const ChartMetric = Object.freeze({
  MaxWeight: 'maxWeight',
  E1RM: 'e1rm',
  Volume: 'volume',
  TopSpeed: 'topSpeed',
  BestTime: 'bestTime',
  Distance: 'distance',
  Longest: 'longest',
} as const);
export type ChartMetricValue = (typeof ChartMetric)[keyof typeof ChartMetric];

export interface MetricOption { key: ChartMetricValue; label: string; unit: string; lowerIsBetter?: boolean }

export function metricsFor(trackingType: TrackingTypeValue | null | undefined): MetricOption[] {
  switch (trackingType) {
    case TrackingType.DistanceTime:
      return [
        { key: ChartMetric.TopSpeed, label: 'Top speed', unit: 'km/h' },
        { key: ChartMetric.BestTime, label: 'Best time', unit: 's', lowerIsBetter: true },
        { key: ChartMetric.Distance, label: 'Total distance', unit: 'm' },
      ];
    case TrackingType.Duration:
      return [{ key: ChartMetric.Longest, label: 'Longest', unit: 's' }];
    default:
      return [
        { key: ChartMetric.MaxWeight, label: 'Max weight', unit: 'kg' },
        { key: ChartMetric.E1RM, label: 'Est. 1RM', unit: 'kg' },
        { key: ChartMetric.Volume, label: 'Volume', unit: 'kg' },
      ];
  }
}

export interface SeriesPoint { date: string; value: number }

/** Ein Wert pro Einheit für die gewählte Übung und Kennzahl - chronologisch. */
export function exerciseSeries(workouts: readonly Workout[] | null | undefined, key: string, metric: ChartMetricValue | string): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (const w of chronological(workouts)) {
    const sets = (w.sets ?? []).filter((s) => exerciseKey(s) === key && isWorkingSet(s));
    if (sets.length === 0) continue;
    let value: number;
    switch (metric) {
      case ChartMetric.MaxWeight: value = Math.max(...sets.map((s) => s.weight ?? 0)); break;
      case ChartMetric.E1RM: value = Math.max(...sets.map((s) => epley1RM(s.weight, s.reps))); break;
      case ChartMetric.Volume: value = sets.reduce((sum, s) => sum + setVolume(s), 0); break;
      case ChartMetric.TopSpeed: value = msToKmh(Math.max(...sets.map(setSpeed))); break;
      case ChartMetric.BestTime: {
        const times = sets.map((s) => s.time ?? 0).filter((t) => t > 0);
        value = times.length ? Math.min(...times) : 0;
        break;
      }
      case ChartMetric.Distance: value = sets.reduce((sum, s) => sum + (s.distance ?? 0), 0); break;
      case ChartMetric.Longest: value = Math.max(...sets.map((s) => s.time ?? 0)); break;
      default: value = 0;
    }
    if (value > 0) points.push({ date: w.date, value: round2(value) });
  }
  return points;
}

// ---------- Wochen, Serien, Heatmap ----------

export interface WeekBucket { weekStart: string; volume: number; distance: number; sessions: number; sets: number; load: number }

/** Volumen, Distanz und Anzahl Einheiten der letzten `weeks` Wochen (älteste zuerst). */
export function weeklyTotals(workouts: readonly Workout[] | null | undefined, weeks = 12, now = new Date()): WeekBucket[] {
  const thisWeek = startOfWeek(now);
  const buckets: WeekBucket[] = [];
  const byKey = new Map<string, WeekBucket>();
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const bucket = { weekStart: dateKey(start), volume: 0, distance: 0, sessions: 0, sets: 0, load: 0 };
    buckets.push(bucket);
    byKey.set(bucket.weekStart, bucket);
  }
  for (const w of workouts ?? []) {
    const bucket = byKey.get(dateKey(startOfWeek(w.date)));
    if (!bucket) continue;
    const summary = summarizeWorkout(w);
    bucket.volume = round1(bucket.volume + summary.volume);
    bucket.distance = round1(bucket.distance + summary.distance);
    bucket.sessions += 1;
    bucket.sets += summary.workingSets;
    bucket.load += summary.load;
  }
  return buckets;
}

/** Anzahl aufeinanderfolgender Wochen mit mindestens einer Einheit (diese oder letzte Woche als Start). */
export function weekStreak(workouts: readonly Workout[] | null | undefined, now = new Date()): number {
  const weeksWithTraining = new Set((workouts ?? []).map((w) => dateKey(startOfWeek(w.date))));
  let cursor = startOfWeek(now);
  // Läuft die aktuelle Woche noch ohne Training, zählt die Serie ab letzter Woche.
  if (!weeksWithTraining.has(dateKey(cursor))) cursor = addDays(cursor, -7);
  let streak = 0;
  while (weeksWithTraining.has(dateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

export interface MuscleShare { group: string; sets: number; share: number }

/** Sätze pro Muskelgruppe in den letzten `days` Tagen, absteigend sortiert. */
export function muscleDistribution(workouts: readonly Workout[] | null | undefined, days = 30, now = new Date()): MuscleShare[] {
  const since = now.getTime() - days * DAY_MS;
  const counts = new Map<string, number>();
  for (const w of workouts ?? []) {
    if (time(w.date) < since) continue;
    for (const s of w.sets ?? []) {
      if (!isWorkingSet(s)) continue;
      const group = s.muscleGroup || 'Other';
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .map(([group, sets]) => ({ group, sets, share: total ? sets / total : 0 }))
    .sort((a, b) => b.sets - a.sets || a.group.localeCompare(b.group));
}

export interface HeatDay { date: string; sets: number; sessions: number; level: number; future: boolean }
export interface Heatmap { columns: HeatDay[][]; months: { index: number; label: string }[] }

/** Heatmap im GitHub-Stil: `weeks` Spalten (Mo-So), Intensität 0-4 nach Anzahl Sätzen am Tag. */
export function activityHeatmap(workouts: readonly Workout[] | null | undefined, weeks = 26, now = new Date(), locale?: string): Heatmap {
  const perDay = new Map<string, { sets: number; sessions: number }>();
  for (const w of workouts ?? []) {
    const key = dateKey(w.date);
    const entry = perDay.get(key) ?? { sets: 0, sessions: 0 };
    entry.sets += (w.sets ?? []).length;
    entry.sessions += 1;
    perDay.set(key, entry);
  }
  const max = Math.max(1, ...[...perDay.values()].map((e) => e.sets));
  const todayKey = dateKey(now);
  const first = addDays(startOfWeek(now), -7 * (weeks - 1));

  const columns: HeatDay[][] = [];
  const months: Heatmap['months'] = [];
  let lastMonth = -1;
  for (let c = 0; c < weeks; c++) {
    const column: HeatDay[] = [];
    for (let r = 0; r < 7; r++) {
      const day = addDays(first, c * 7 + r);
      const key = dateKey(day);
      const entry = perDay.get(key) ?? { sets: 0, sessions: 0 };
      let level = 0;
      if (entry.sessions > 0) {
        const ratio = entry.sets / max;
        level = ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
      }
      column.push({ date: key, ...entry, level, future: key > todayKey });
    }
    const month = addDays(first, c * 7).getMonth();
    if (month !== lastMonth) {
      months.push({ index: c, label: addDays(first, c * 7).toLocaleDateString(locale, { month: 'short' }) });
      lastMonth = month;
    }
    columns.push(column);
  }
  return { columns, months };
}

export type DatedSet = WorkoutSet & { date: string };

/** Letzter Satz einer Übung in der Historie (für "Previous log" und Vorbelegung). */
export function lastSetFor(workouts: readonly Workout[] | null | undefined, key: string): DatedSet | null {
  const sorted = chronological(workouts).reverse();
  for (const w of sorted) {
    const sets = (w.sets ?? []).filter((s) => exerciseKey(s) === key);
    const working = sets.filter(isWorkingSet);
    const pick = working.length ? working : sets;
    if (pick.length) return { ...pick[pick.length - 1], date: w.date };
  }
  return null;
}

/**
 * Letzter (Arbeits-)Satz pro Übung in EINEM Durchlauf - für Listen mit vielen Übungen (Katalog, Auswahl).
 * Gleiches Ergebnis wie lastSetFor() je Übung, aber O(Sätze) statt O(Übungen × Sätze).
 */
export function lastSetsByKey(workouts: readonly Workout[] | null | undefined): Map<string, DatedSet> {
  const result = new Map<string, DatedSet>();
  for (const w of chronological(workouts)) {
    const seenInWorkout = new Map<string, { last: WorkoutSet; working: WorkoutSet | null }>();
    for (const s of w.sets ?? []) {
      const key = exerciseKey(s);
      const entry = seenInWorkout.get(key) ?? { last: s, working: null };
      entry.last = s;
      if (isWorkingSet(s)) entry.working = s;
      seenInWorkout.set(key, entry);
    }
    // Spätere Einheiten überschreiben frühere; Arbeitssätze haben Vorrang vor Aufwärmsätzen derselben Einheit.
    for (const [key, entry] of seenInWorkout) {
      result.set(key, { ...(entry.working ?? entry.last), date: w.date });
    }
  }
  return result;
}

/** Wie oft wurde jede Übung insgesamt geloggt (Sätze)? */
export function usageCounts(workouts: readonly Workout[] | null | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const w of workouts ?? []) {
    for (const s of w.sets ?? []) counts.set(exerciseKey(s), (counts.get(exerciseKey(s)) ?? 0) + 1);
  }
  return counts;
}

/** Leitet den Einheiten-Typ aus den Kategorien der Sätze ab. */
export function inferWorkoutType(sets: readonly WorkoutSet[] | null | undefined): 'Gym' | 'Football' | 'Hybrid' {
  const categories = new Set((sets ?? []).map((s) => s.category).filter(Boolean));
  if (categories.has('Gym') && categories.has('Football')) return 'Hybrid';
  if (categories.has('Football')) return 'Football';
  if (categories.size === 0) {
    // Fallback für Altdaten ohne Kategorie
    const hasWeight = (sets ?? []).some((s) => trackingOf(s) === TrackingType.WeightReps);
    const hasField = (sets ?? []).some((s) => trackingOf(s) !== TrackingType.WeightReps);
    if (hasWeight && hasField) return 'Hybrid';
    return hasField ? 'Football' : 'Gym';
  }
  return 'Gym';
}

/** Vergleich zweier Werte in Prozent (null, wenn kein Vergleichswert). */
export function percentChange(current: number, previous: number | null | undefined): number | null {
  if (!(previous! > 0)) return null;
  return Math.round(((current - previous!) / previous!) * 100);
}
