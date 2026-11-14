// Geplante Einzel-Einheiten neben dem Trainingsplan (Zusatz-, Nachhol-, Reha-Einheit an einem Datum).
// Regel wie auf dem Server: nie an einem Trainings- oder Spieltag des aktiven Plans - eine Einheit pro Tag.
// Reine Funktionen (getestet); Zustand und Sync im Store stores/planned.ts. Datumswerte: lokale Tage yyyy-MM-dd.
import { addDays, parseDay } from './routines';
import { bit, weekdayOf, type Schedule } from './schedule';
import { newClientId } from './clientSync';

export type PlannedStatus = 'planned' | 'done' | 'skipped';
export type PlannedCategory = 'Gym' | 'Football';

export interface PlannedExercise {
  exerciseId: number;
  sets: number;
  repsMin?: number | null;
  repsMax?: number | null;
  weight?: number | null;
  distance?: number | null;
  time?: number | null;
  targetRpe?: number | null;
  note?: string | null;
}

export interface PlannedWorkout {
  clientId: string;
  date: string;
  title: string;
  category: PlannedCategory;
  notes: string | null;
  source: 'user' | 'coach';
  status: PlannedStatus;
  workoutClientId: string | null;
  exercises: PlannedExercise[];
  createdAt: string;
  updatedAt: string;
  pending?: 'put' | 'delete';
}

export const MAX_PLANNED_EXERCISES = 15;
export const newPlannedId = (): string => newClientId('pl');

/** Belegt der Plan diesen Tag? "match", "training" oder null (frei). */
export function planConflict(schedule: Partial<Schedule> | null | undefined, day: string): 'training' | 'match' | null {
  if (!schedule) return null;
  const b = bit(weekdayOf(parseDay(day)));
  if ((schedule.matchDays ?? 0) & b) return 'match';
  if ((schedule.trainingDays ?? 0) & b) return 'training';
  return null;
}

const visible = <T extends PlannedWorkout>(list: readonly T[]) => list.filter((p) => p.pending !== 'delete');

/** Offen und heute fällig. */
export const plannedToday = <T extends PlannedWorkout>(list: readonly T[], today: string): T[] =>
  visible(list).filter((p) => p.date === today && p.status === 'planned');

/** Anstehend (ab heute, offen), nach Datum. */
export const upcoming = <T extends PlannedWorkout>(list: readonly T[], today: string): T[] =>
  visible(list).filter((p) => p.date >= today && p.status === 'planned').sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

/** Vergangen: erledigt, ausgelassen oder verpasst (offen geblieben), neueste zuerst. */
export const past = <T extends PlannedWorkout>(list: readonly T[], today: string, days = 30): T[] =>
  visible(list).filter((p) => p.date < today && p.date >= addDays(today, -days)).sort((a, b) => b.date.localeCompare(a.date));

export type PlannedDisplayStatus = PlannedStatus | 'missed';
export const displayStatus = (p: Pick<PlannedWorkout, 'status' | 'date'>, today: string): PlannedDisplayStatus =>
  p.status === 'planned' && p.date < today ? 'missed' : p.status;

/** Pro Tag (für den Kalender). */
export function byDay<T extends PlannedWorkout>(list: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const p of visible(list)) map.set(p.date, [...(map.get(p.date) ?? []), p]);
  return map;
}

/**
 * Freie Tage ab `from` für die Datumsauswahl: kein Plan-Tag, kein anderer offener Termin; dazu, ob es der Tag vor einem Spiel ist.
 * @param exceptId bearbeiteter Termin (zählt nicht als belegt)
 */
export function freeDays(schedule: Partial<Schedule> | null | undefined, list: readonly PlannedWorkout[], from: string, count: number, exceptId?: string | null) {
  const taken = new Set(visible(list).filter((p) => p.status === 'planned' && p.clientId !== exceptId).map((p) => p.date));
  const out: { day: string; beforeMatch: boolean }[] = [];
  for (let i = 0; out.length < count && i < 60; i++) {
    const day = addDays(from, i);
    if (planConflict(schedule, day) || taken.has(day)) continue;
    out.push({ day, beforeMatch: planConflict(schedule, addDays(day, 1)) === 'match' });
  }
  return out;
}

/** Kurztext einer Vorgabe: "3×5-8 @ 60 kg", "6×30 m", "3×45 s". */
export function prescriptionText(x: PlannedExercise, trackingType?: string): string {
  const sets = `${x.sets}×`;
  if (trackingType === 'DistanceTime' || (x.distance && !x.repsMin)) return `${sets}${x.distance ? `${x.distance} m` : ''}`;
  if (trackingType === 'Duration' || trackingType === 'Cardio' || (x.time && !x.repsMin)) {
    const t = x.time ?? 0;
    return `${sets}${t >= 60 ? `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')} min` : `${t} s`}`;
  }
  const reps = x.repsMin ? (x.repsMax && x.repsMax !== x.repsMin ? `${x.repsMin}-${x.repsMax}` : `${x.repsMin}`) : '';
  return `${sets}${reps}${x.weight ? ` @ ${x.weight} kg` : ''}${x.targetRpe ? ` RPE ${x.targetRpe}` : ''}`;
}
