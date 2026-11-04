// Motivations-Zeilen: kurz, sachlich, mit echtem Trainings-Hinweis (Deload nach Pause, kein schweres Gym am Spieltag).
// Startbildschirm: eine Zeile, Auswahl nach Priorität, pro Tag stabil (Rotation über die Tagesnummer).
// Ereignisse (Start, Rekord, Ende): rotierender Zähler pro Auslöser, damit sich nichts direkt wiederholt.

import { locale, motivationTexts } from '../i18n';
import type { MotivationKey } from '../i18n/motivation.en';
import { readJson, writeJson } from './storage';


export type { MotivationKey };
export type MotivationParams = Partial<Record<'name' | 'streak' | 'days' | 'count' | 'exercise' | 'weight' | 'total', string | number>>;

const DAY = 86_400_000;
const OFFSET: Record<MotivationKey, number> = {
  startMorning: 0, startEvening: 1, startDefault: 2, comeback: 3, streak: 4, weekStrong: 5, sessionStart: 0, matchDay: 1,
  personalRecord: 2, finish: 3, finishHard: 4, milestone: 5, restDay: 0, rehab: 1, goalReached: 2,
};

const usableName = (name: unknown) => typeof name === 'string' && !!name && name.length <= 16 && !name.includes('@');

function fill(text: string, params: MotivationParams): string | null {
  let missing = false;
  const out = text.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params[k as keyof MotivationParams];
    if (v == null || v === '') { missing = true; return ''; }
    return String(v);
  });
  return missing ? null : out;
}

function variants(key: MotivationKey, params: MotivationParams, lang?: string): string[] {
  const l = (lang ?? locale.value) as keyof typeof motivationTexts;
  const list = (motivationTexts[l] ?? motivationTexts.en)![key];
  const p = usableName(params.name) ? params : { ...params, name: undefined };
  return list.map((v) => fill(v, p)).filter((v): v is string => !!v);
}

/** Startbildschirm: pro Tag stabil, zwei Tage hintereinander nie dieselbe Zeile (bei gleichem Auslöser). */
export function dailyLine(key: MotivationKey, params: MotivationParams, date = new Date(), lang?: string): string {
  const list = variants(key, params, lang);
  if (!list.length) return '';
  const day = Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / DAY);
  return list[(day + OFFSET[key]) % list.length];
}

/** Ereignis-Zeile: rotiert pro Auslöser (Zähler im Gerät). */
export function eventLine(key: MotivationKey, params: MotivationParams, lang?: string): string {
  const list = variants(key, params, lang);
  if (!list.length) return '';
  const storeKey = `sprintlog:motivation:${key}`;
  const n = readJson<number>(storeKey, 0);
  writeJson(storeKey, n + 1);
  return list[n % list.length];
}

export interface StartContext {
  now: Date;
  name?: string | null;
  /** Heute schon trainiert? */
  trainedToday: boolean;
  /** Tage seit der letzten Einheit (null = noch nie). */
  daysSinceLast: number | null;
  streak: number;
  weekCount: number;
  todayKind?: 'training' | 'match' | 'rest' | null;
  rehabActive?: boolean;
}

/** Welche Zeile zeigt der Startbildschirm? Priorität: Spieltag > Reha > Comeback > Ruhetag > Serie > Woche > Tageszeit. */
export function startTrigger(c: StartContext): { key: MotivationKey; params: MotivationParams } | null {
  const name = c.name ?? undefined;
  if (c.trainedToday) {
    if (c.streak >= 3) return { key: 'streak', params: { streak: c.streak } };
    if (c.weekCount >= 3) return { key: 'weekStrong', params: { count: c.weekCount } };
    return null;
  }
  if (c.todayKind === 'match') return { key: 'matchDay', params: {} };
  if (c.rehabActive) return { key: 'rehab', params: {} };
  if (c.daysSinceLast != null && c.daysSinceLast >= 5) return { key: 'comeback', params: { days: c.daysSinceLast } };
  if (c.todayKind === 'rest') return { key: 'restDay', params: {} };
  if (c.streak >= 3) return { key: 'streak', params: { streak: c.streak } };
  if (c.weekCount >= 3) return { key: 'weekStrong', params: { count: c.weekCount } };
  const h = c.now.getHours();
  return { key: h < 11 ? 'startMorning' : h >= 17 ? 'startEvening' : 'startDefault', params: { name } };
}

/** Meilensteine: 10, 25, 50, 100, 150, 200 ... */
export const isMilestone = (total: number): boolean => [10, 25, 50, 100].includes(total) || (total > 100 && total % 50 === 0);
