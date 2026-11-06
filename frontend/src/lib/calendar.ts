// Kalender: Tage, Monate und Jahre aus den Einheiten - reine Funktionen (getestet), die Ansicht rechnet nichts selbst.
// Woche beginnt am Montag (wie in DE/RU üblich), Datumsschlüssel lokal (Training um 23:30 gehört zum selben Tag).
import type { Workout } from '@/types';
import { dateKey, summarizeWorkout } from '@/lib/analytics';
import { kindOf, weekdayOf, type DayKind, type Schedule } from '@/lib/schedule';

export type CalendarKind = 'Gym' | 'Football' | 'Hybrid' | 'Match';

export interface CalendarDay {
  key: string;
  sessions: number;
  sets: number;
  minutes: number;
  volume: number;
  /** Belastung (sRPE × Minuten) - 0, wenn RPE oder Dauer fehlen. */
  load: number;
  kinds: CalendarKind[];
  workouts: Workout[];
}

export type DayIndex = Map<string, CalendarDay>;

const KINDS: readonly CalendarKind[] = ['Match', 'Gym', 'Football', 'Hybrid'];

/** Alle Einheiten nach Tag gruppiert. */
export function indexByDay(workouts: readonly Workout[] | null | undefined): DayIndex {
  const index: DayIndex = new Map();
  for (const w of workouts ?? []) {
    const key = dateKey(w.date);
    const day = index.get(key) ?? { key, sessions: 0, sets: 0, minutes: 0, volume: 0, load: 0, kinds: [], workouts: [] };
    const s = summarizeWorkout(w);
    day.sessions += 1;
    day.sets += s.sets;
    day.minutes += Math.round((w.durationSeconds ?? 0) / 60);
    day.volume += s.volume;
    day.load += s.load;
    const kind = (KINDS as readonly string[]).includes(w.workoutType) ? (w.workoutType as CalendarKind) : 'Gym';
    if (!day.kinds.includes(kind)) day.kinds.push(kind);
    day.workouts.push(w);
    index.set(key, day);
  }
  for (const d of index.values()) {
    d.kinds.sort((a, b) => KINDS.indexOf(a) - KINDS.indexOf(b));
    d.workouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
  return index;
}

/** Wie viel an einem Tag los war, unabhängig von der Art: Sätze zählen, Minuten auch (Feld/Spiel haben kaum Sätze). */
export const dayScore = (d: Pick<CalendarDay, 'sets' | 'minutes'> | undefined): number => (d ? d.sets + d.minutes / 4 : 0);

/** Stufe 0-4 relativ zum stärksten Tag; jeder Trainingstag mindestens 1. */
export function levelOf(day: CalendarDay | undefined, maxScore: number): 0 | 1 | 2 | 3 | 4 {
  if (!day?.sessions) return 0;
  const r = dayScore(day) / Math.max(1, maxScore);
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
}

export const maxScoreOf = (index: DayIndex): number => Math.max(1, ...[...index.values()].map(dayScore));

export interface GridCell { key: string; date: Date; inMonth: boolean; weekday: number }

/** 6 Wochen × 7 Tage ab dem Montag vor dem Monatsersten (immer 42 Zellen - kein Springen der Höhe). */
export function monthGrid(year: number, month: number): GridCell[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - weekdayOf(first));
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { key: dateKey(date), date, inMonth: date.getMonth() === month, weekday: weekdayOf(date) };
  });
}

export interface PeriodStats {
  sessions: number;
  activeDays: number;
  minutes: number;
  volume: number;
  matches: number;
  /** Längste Folge von Tagen mit Training in diesem Zeitraum. */
  bestStreak: number;
}

/** Kennzahlen für alle Tage mit Schlüssel im Bereich [from, to] (inklusive). */
export function periodStats(index: DayIndex, from: Date, to: Date): PeriodStats {
  const stats: PeriodStats = { sessions: 0, activeDays: 0, minutes: 0, volume: 0, matches: 0, bestStreak: 0 };
  let streak = 0;
  for (let d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d <= to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const day = index.get(dateKey(d));
    if (day?.sessions) {
      stats.sessions += day.sessions;
      stats.activeDays += 1;
      stats.minutes += day.minutes;
      stats.volume += day.volume;
      stats.matches += day.workouts.filter((w) => w.workoutType === 'Match').length;
      streak += 1;
      stats.bestStreak = Math.max(stats.bestStreak, streak);
    } else {
      streak = 0;
    }
  }
  stats.volume = Math.round(stats.volume);
  return stats;
}

export const monthStats = (index: DayIndex, year: number, month: number): PeriodStats =>
  periodStats(index, new Date(year, month, 1), new Date(year, month + 1, 0));

export const yearStats = (index: DayIndex, year: number): PeriodStats =>
  periodStats(index, new Date(year, 0, 1), new Date(year, 11, 31));

/** Einheiten je Monat eines Jahres (für die Balken in der Jahresansicht). */
export function sessionsPerMonth(index: DayIndex, year: number): number[] {
  const out = Array<number>(12).fill(0);
  for (const d of index.values()) {
    if (d.key.startsWith(`${year}-`)) out[Number(d.key.slice(5, 7)) - 1]! += d.sessions;
  }
  return out;
}

/** Jahre mit Daten plus das aktuelle - für die Jahresauswahl. */
export function yearsWithData(index: DayIndex, now: Date): number[] {
  const years = new Set<number>([now.getFullYear()]);
  for (const key of index.keys()) years.add(Number(key.slice(0, 4)));
  return [...years].sort((a, b) => a - b);
}

/** Geplante Art eines künftigen Tages laut Wochenplan des aktiven Programms (für die Vorschau). */
export const plannedKind = (schedule: Partial<Schedule> | null | undefined, date: Date): DayKind => kindOf(schedule, weekdayOf(date));
