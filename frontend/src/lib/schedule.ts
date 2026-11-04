// Wochenplan eines Programms: an welchen Wochentagen trainiert und gespielt wird, der Rest ist Erholung.
// Bitmaske wie im Backend: Montag = 1, Dienstag = 2 ... Sonntag = 64.

export type DayKind = 'training' | 'match' | 'rest';

/** Wochentage in Anzeige-Reihenfolge (Mo-So), Index 0 = Montag. */
export const WEEKDAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];
export const bit = (weekday: number): number => 1 << weekday;

/** JS-Datum -> 0 = Montag ... 6 = Sonntag. */
export const weekdayOf = (d: Date): number => (d.getDay() + 6) % 7;

export interface Schedule { trainingDays: number; matchDays: number }

export const hasSchedule = (s: Partial<Schedule> | null | undefined): boolean => !!s && ((s.trainingDays ?? 0) | (s.matchDays ?? 0)) !== 0;

export function kindOf(s: Partial<Schedule> | null | undefined, weekday: number): DayKind {
  if (!s) return 'rest';
  if ((s.matchDays ?? 0) & bit(weekday)) return 'match';
  if ((s.trainingDays ?? 0) & bit(weekday)) return 'training';
  return 'rest';
}

/** Tag im Wochenplan umschalten: Ruhe -> Training -> Spiel -> Ruhe. */
export function cycleDay(s: Schedule, weekday: number): Schedule {
  const b = bit(weekday);
  const kind = kindOf(s, weekday);
  if (kind === 'rest') return { trainingDays: s.trainingDays | b, matchDays: s.matchDays & ~b };
  if (kind === 'training') return { trainingDays: s.trainingDays & ~b, matchDays: s.matchDays | b };
  return { trainingDays: s.trainingDays & ~b, matchDays: s.matchDays & ~b };
}

export const countDays = (mask: number): number => WEEKDAYS.filter((d) => mask & bit(d)).length;

/**
 * Vorschlag für N Einheiten pro Woche: möglichst gleichmäßig verteilt (mind. ein Tag Pause dazwischen, wenn es geht),
 * nicht am Spieltag und nach Möglichkeit nicht am Tag davor oder danach.
 */
export function suggestTrainingDays(sessionsPerWeek: number, matchDays = 0): number {
  const n = Math.max(1, Math.min(6, Math.round(sessionsPerWeek)));
  const free = WEEKDAYS.filter((d) => !(matchDays & bit(d)));
  // Tag vor und nach dem Spiel bleiben möglichst frei (Frische vorher, Regeneration danach)
  const nearMatch = new Set(WEEKDAYS.filter((d) => matchDays & (bit((d + 1) % 7) | bit((d + 6) % 7))));
  const preferred = free.filter((d) => !nearMatch.has(d));
  const pool = preferred.length >= n ? preferred : free;
  // Bewährte Muster, an freie Tage angepasst
  const patterns: Record<number, number[][]> = {
    1: [[2], [1], [3]],
    2: [[1, 3], [0, 3], [1, 4]],
    3: [[0, 2, 4], [1, 3, 5], [0, 2, 5], [1, 3, 4], [1, 2, 4]],
    4: [[0, 1, 3, 4], [0, 2, 3, 5], [1, 2, 4, 5]],
    5: [[0, 1, 2, 3, 4], [0, 1, 3, 4, 5], [0, 2, 3, 4, 5]],
    6: [[0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 6]],
  };
  const fit = (patterns[n] ?? []).find((p) => p.every((d) => pool.includes(d)));
  const days = fit ?? pool.filter((_, i) => i % Math.max(1, Math.floor(pool.length / n)) === 0).slice(0, n);
  return days.reduce((m, d) => m | bit(d), 0);
}

/** Nächster Tag (ab `from`, inkl. heute) einer Art. */
export function nextDayOf(s: Partial<Schedule> | null | undefined, kind: DayKind, from = new Date()): Date | null {
  if (!hasSchedule(s)) return null;
  for (let i = 0; i < 7; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    if (kindOf(s, weekdayOf(d)) === kind) return d;
  }
  return null;
}

/** Hinweise zum Wochenplan (für die Anzeige unter dem Editor). */
export function scheduleWarnings(s: Schedule): ('noRest' | 'beforeMatch' | 'afterMatch' | 'threeInRow')[] {
  const out = new Set<'noRest' | 'beforeMatch' | 'afterMatch' | 'threeInRow'>();
  const k = (d: number) => kindOf(s, ((d % 7) + 7) % 7);
  const busy = (d: number) => k(d) !== 'rest';
  if (WEEKDAYS.every((d) => busy(d))) out.add('noRest');
  for (const d of WEEKDAYS) {
    if (k(d) === 'training' && k(d + 1) === 'match') out.add('beforeMatch');
    if (k(d) === 'match' && k(d + 1) === 'training') out.add('afterMatch');
    if (busy(d) && busy(d + 1) && busy(d + 2)) out.add('threeInRow');
  }
  return [...out];
}
