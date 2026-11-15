// Match-Day-Periodisierung: jeder Tag relativ zum nächsten/letzten Spiel (MD-4 ... MD+2) mit Schwerpunkt und Belastung.
// Gleiche Regeln wie der Server (SprintLog.Api/Services/MatchDay.cs): bei zwei Spielen pro Woche MD+1 vor MD-1 vor MD+2.
// Plan-Tage werden an MD-1/MD+1/MD+2 automatisch leichter (weniger Sätze, RPE gedeckelt).
import { addDays, parseDay } from './routines';
import { bit, weekdayOf, type Schedule } from './schedule';

export type MdLabel = 'MD' | 'MD+1' | 'MD+2' | 'MD-1' | 'MD-2' | 'MD-3' | 'MD-4';
export type MdLoad = 'match' | 'recovery' | 'off' | 'low' | 'moderate' | 'high' | 'peak';

export interface MdInfo {
  label: MdLabel;
  /** Schwerpunkt (i18n: md.focus.<key>). */
  focus: 'match' | 'recovery' | 'rest' | 'activation' | 'speed' | 'endurance' | 'strength';
  load: MdLoad;
  /** Anteil der geplanten Sätze (1 = unverändert). */
  volume: number;
  /** Obergrenze für die Ziel-RPE (null = keine). */
  rpeCap: number | null;
}

const INFO: Record<MdLabel, Omit<MdInfo, 'label'>> = {
  MD: { focus: 'match', load: 'match', volume: 1, rpeCap: null },
  'MD+1': { focus: 'recovery', load: 'recovery', volume: 0.5, rpeCap: 5 },
  'MD+2': { focus: 'rest', load: 'off', volume: 0.7, rpeCap: 6 },
  'MD-1': { focus: 'activation', load: 'low', volume: 0.6, rpeCap: 6 },
  'MD-2': { focus: 'speed', load: 'moderate', volume: 0.85, rpeCap: 8 },
  'MD-3': { focus: 'endurance', load: 'peak', volume: 1, rpeCap: null },
  'MD-4': { focus: 'strength', load: 'high', volume: 1, rpeCap: null },
};

const isMatch = (day: string, matchDays: number) => (matchDays & bit(weekdayOf(parseDay(day)))) !== 0;

/** Phase eines Tages; null ohne Spieltage oder ohne Spiel in der Nähe. */
export function mdLabel(day: string, schedule: Partial<Schedule> | null | undefined): MdLabel | null {
  const m = schedule?.matchDays ?? 0;
  if (!m) return null;
  if (isMatch(day, m)) return 'MD';
  // Reihenfolge bei zwei Spielen pro Woche: MD+1 (Regeneration) > MD-1 (Aktivierung) > MD+2 > MD-2 ... MD-4
  if (isMatch(addDays(day, -1), m)) return 'MD+1';
  if (isMatch(addDays(day, 1), m)) return 'MD-1';
  if (isMatch(addDays(day, -2), m)) return 'MD+2';
  for (let k = 2; k <= 4; k++) if (isMatch(addDays(day, k), m)) return `MD-${k}` as MdLabel;
  return null;
}

export function mdInfo(day: string, schedule: Partial<Schedule> | null | undefined): MdInfo | null {
  const label = mdLabel(day, schedule);
  return label ? { label, ...INFO[label] } : null;
}

/** Sätze und Ziel-RPE an die Phase anpassen (mindestens 1 Satz); unverändert, wenn die Phase nichts verlangt. */
export function adjustForMd<T extends { sets: number; targetRpe?: number | null }>(target: T, info: MdInfo | null): T {
  if (!info || (info.volume >= 1 && info.rpeCap == null)) return target;
  const sets = Math.max(1, Math.round(target.sets * info.volume));
  const targetRpe = info.rpeCap != null && target.targetRpe != null ? Math.min(target.targetRpe, info.rpeCap) : target.targetRpe;
  return { ...target, sets, targetRpe };
}
