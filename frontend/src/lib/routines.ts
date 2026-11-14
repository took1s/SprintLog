// Routinen neben dem Trainingsplan (Dehnen, Reha, Prävention): wann fällig, Fortschritt im Zeitraum, Serie, Erfüllung.
// Reine Funktionen (getestet) - der Store hält Zustand, Speicher und Sync.
// Datumswerte sind lokale Tage als yyyy-MM-dd (wie beim Befinden): "heute" ist der Tag des Nutzers, nicht UTC.
import { bit, weekdayOf } from './schedule';
import { localDay } from './wellness';
import { newClientId } from './clientSync';

export const ROUTINE_KINDS = ['mobility', 'rehab', 'prevention', 'activation', 'recovery', 'other'] as const;
export type RoutineKind = (typeof ROUTINE_KINDS)[number];

export const EVERY_DAY = 127;
export const MAX_ROUTINE_STEPS = 12;
export const MAX_TIMES_PER_DAY = 6;

export interface RoutineStep { name: string; dose?: string | null; exerciseId?: number | null }

export interface Routine {
  clientId: string;
  title: string;
  kind: RoutineKind;
  /** Bitmaske Mo = 1 ... So = 64 (wie der Wochenplan). */
  days: number;
  startDate: string;
  /** Einschließlich; null = ohne Ende. */
  endDate: string | null;
  reason: string | null;
  source: 'user' | 'coach';
  steps: RoutineStep[];
  /** Wie oft pro fälligem Tag (1 = einmal). Ein Tag ist erledigt, wenn so oft abgehakt. */
  timesPerDay: number;
  /** Ein Eintrag pro erledigtem Durchgang: bei 3x täglich bis zu 3x dasselbe Datum. */
  doneDates: string[];
  createdAt: string;
  updatedAt: string;
  /** Nur lokal: noch nicht synchronisiert. */
  pending?: 'put' | 'delete';
}

export type RoutineState = 'upcoming' | 'active' | 'ended';

/** yyyy-MM-dd -> lokales Datum (Mittag: keine Sommerzeit-Kanten). */
export const parseDay = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12);
};
export const addDays = (day: string, n: number): string => { const d = parseDay(day); d.setDate(d.getDate() + n); return localDay(d); };
/** Ganze Tage von a nach b (b - a). */
export const daysBetween = (a: string, b: string): number => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);

export function routineState(r: Pick<Routine, 'startDate' | 'endDate'>, today: string): RoutineState {
  if (r.startDate > today) return 'upcoming';
  if (r.endDate && r.endDate < today) return 'ended';
  return 'active';
}

/** An diesem Tag fällig: im Zeitraum und an einem der Wochentage. */
export const isScheduled = (r: Pick<Routine, 'days' | 'startDate' | 'endDate'>, day: string): boolean =>
  day >= r.startDate && (!r.endDate || day <= r.endDate) && (r.days & bit(weekdayOf(parseDay(day)))) !== 0;

const times = (r: Pick<Routine, 'timesPerDay'>) => Math.max(1, Math.min(MAX_TIMES_PER_DAY, r.timesPerDay || 1));

/** Wie oft an diesem Tag abgehakt (0 ... timesPerDay). */
export const doneCount = (r: Pick<Routine, 'doneDates'>, day: string): number => r.doneDates.reduce((n, d) => n + (d === day ? 1 : 0), 0);

/** Tag komplett erledigt (alle Durchgänge). */
export const isDone = (r: Pick<Routine, 'doneDates' | 'timesPerDay'>, day: string): boolean => doneCount(r, day) >= times(r);

/** Durchgänge eines Tages auf n setzen (0 ... timesPerDay); Ergebnis sortiert. */
export function setDoneCount(r: Pick<Routine, 'doneDates' | 'timesPerDay'>, day: string, n: number): string[] {
  const count = Math.max(0, Math.min(times(r), Math.round(n)));
  return [...r.doneDates.filter((d) => d !== day), ...Array.from({ length: count }, () => day)].sort();
}

/**
 * Tipp auf den k-ten Durchgang (1-basiert): bis k abhaken - oder, wenn genau k schon steht, den k-ten wieder lösen.
 * Bei einmal täglich ist das ein normaler Haken.
 */
export function tapCount(current: number, k: number): number {
  return current === k ? k - 1 : k;
}

/** Fällige Tage zwischen from und to (einschließlich). */
export function scheduledDays(r: Pick<Routine, 'days' | 'startDate' | 'endDate'>, from: string, to: string): string[] {
  const out: string[] = [];
  const start = from > r.startDate ? from : r.startDate;
  const end = r.endDate && r.endDate < to ? r.endDate : to;
  for (let d = start, i = 0; d <= end && i < 800; d = addDays(d, 1), i++) if (isScheduled(r, d)) out.push(d);
  return out;
}

export interface RoutineProgress {
  state: RoutineState;
  /** Fällige Tage bis heute (einschließlich) und davon erledigt. */
  due: number;
  done: number;
  /** Fällige Tage im ganzen Zeitraum (null ohne Ende). */
  total: number | null;
  /** Tage bis zum Ende (0 = letzter Tag heute), null ohne Ende. */
  daysLeft: number | null;
  /** Erledigt in Folge an fälligen Tagen (heute zählt nur, wenn erledigt). */
  streak: number;
  /** 0-100: Anteil erledigter fälliger Tage der letzten 14 Tage. */
  adherence: number | null;
  /** Heute fällig, heute erledigt, heutige Durchgänge (bei mehrmals täglich). */
  dueToday: boolean;
  doneToday: boolean;
  countToday: number;
  /** Fälliger Tag vor heute (bis 6 Tage zurück) ohne vollständigen Haken - zum Nachtragen. */
  missedRecent: string | null;
}

export function routineProgress(r: Routine, today: string): RoutineProgress {
  const state = routineState(r, today);
  const past = scheduledDays(r, r.startDate, today);
  const done = past.filter((d) => isDone(r, d)).length;
  let streak = 0;
  for (let i = past.length - 1; i >= 0; i--) {
    if (isDone(r, past[i])) streak++;
    else if (past[i] === today) continue; // heute noch offen bricht die Serie nicht
    else break;
  }
  const recent = scheduledDays(r, addDays(today, -13), today).filter((d) => d !== today || isDone(r, d));
  return {
    state,
    due: past.length,
    done,
    total: r.endDate ? scheduledDays(r, r.startDate, r.endDate).length : null,
    daysLeft: r.endDate ? Math.max(0, daysBetween(today, r.endDate)) : null,
    streak,
    adherence: recent.length ? Math.round((recent.filter((d) => isDone(r, d)).length / recent.length) * 100) : null,
    dueToday: isScheduled(r, today),
    doneToday: isDone(r, today),
    countToday: doneCount(r, today),
    missedRecent: [...scheduledDays(r, addDays(today, -6), addDays(today, -1))].reverse().find((d) => !isDone(r, d)) ?? null,
  };
}

/** Routinen für heute: Reha zuerst, dann nach Name - feste Reihenfolge, damit nichts beim Abhaken wegspringt. */
export function todaysRoutines<T extends Routine>(list: readonly T[], today: string): T[] {
  return list.filter((r) => r.pending !== 'delete' && isScheduled(r, today))
    .sort((a, b) => Number(b.kind === 'rehab') - Number(a.kind === 'rehab') || a.title.localeCompare(b.title));
}

/** Liste im Plan-Tab: laufend, dann kommend, dann beendet (neueste zuerst). */
export function sortRoutines<T extends Routine>(list: readonly T[], today: string): T[] {
  const rank: Record<RoutineState, number> = { active: 0, upcoming: 1, ended: 2 };
  return list.filter((r) => r.pending !== 'delete').sort((a, b) =>
    rank[routineState(a, today)] - rank[routineState(b, today)]
    || (routineState(a, today) === 'ended' ? (b.endDate ?? '').localeCompare(a.endDate ?? '') : a.startDate.localeCompare(b.startDate))
    || a.title.localeCompare(b.title));
}

/** Client-Id wie vom Server erwartet: ^[A-Za-z0-9_-]{8,64}$. */
export const newRoutineId = (): string => newClientId('rt');

export type HistoryCellState = 'done' | 'partial' | 'missed' | 'open' | 'off' | 'future' | 'outside';

export interface HistoryCell { day: string; state: HistoryCellState; count: number }

/**
 * Verlauf als Wochen (Mo-So) für die Detailansicht: erledigt, teilweise, verpasst, heute offen, nicht fällig,
 * Zukunft oder außerhalb des Zeitraums. Neueste Woche zuletzt.
 */
export function historyWeeks(r: Routine, today: string, weeks = 5): HistoryCell[][] {
  const monday = addDays(today, -weekdayOf(parseDay(today)));
  const out: HistoryCell[][] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = addDays(monday, -7 * w);
    out.push(Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i);
      const count = doneCount(r, day);
      let state: HistoryCellState;
      if (day < r.startDate || (r.endDate && day > r.endDate)) state = 'outside';
      else if (day > today) state = isScheduled(r, day) ? 'future' : 'off';
      else if (!isScheduled(r, day)) state = count > 0 ? 'done' : 'off';
      else if (isDone(r, day)) state = 'done';
      else if (count > 0) state = 'partial';
      else state = day === today ? 'open' : 'missed';
      return { day, state, count };
    }));
  }
  return out;
}


export interface DayRoutines { due: Routine[]; done: number; partial: number }

/** Fällige Routinen eines Tages und wie viele davon (teilweise) erledigt sind - für den Kalender. */
export function routinesOnDay<T extends Routine>(list: readonly T[], day: string): DayRoutines & { due: T[] } {
  const due = list.filter((r) => r.pending !== 'delete' && isScheduled(r, day));
  const done = due.filter((r) => isDone(r, day)).length;
  const partial = due.filter((r) => !isDone(r, day) && doneCount(r, day) > 0).length;
  return { due, done, partial };
}
