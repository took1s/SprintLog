// Coach: schaut auf alles (Plan, Wochenplan, Erholung, Belastung, Befinden, Ziele) und sagt, was heute sinnvoll ist.
// Regelbasiert und nachvollziehbar - jede Empfehlung nennt ihre Gründe. Keine Diagnose, keine Medizin.

import type { LoadZone } from './program';
import type { RecoveryStatus, Region } from './recovery';
import type { DayKind } from './schedule';

export type TodayKind = 'train' | 'light' | 'rest' | 'match' | 'rehab';

export type Reason =
  | { key: 'matchToday' }
  | { key: 'matchTomorrow' }
  | { key: 'restDay' }
  | { key: 'loadHigh' } | { key: 'loadDanger' } | { key: 'loadLow' }
  | { key: 'readinessLow'; value: number } | { key: 'readinessGood'; value: number }
  | { key: 'notRecovered'; region: Region; percent: number }
  | { key: 'recovered' }
  | { key: 'longBreak'; days: number }
  | { key: 'rehab' }
  | { key: 'planNext'; day: string }
  | { key: 'trainedToday' };

export interface CoachInput {
  now: Date;
  todayKind: DayKind | null;
  tomorrowKind: DayKind | null;
  loadZone: LoadZone;
  readiness: number | null;
  recovery: readonly RecoveryStatus[];
  daysSinceLast: number | null;
  trainedToday: boolean;
  rehab: boolean;
  /** Name des nächsten Plan-Tags (falls ein Programm aktiv ist). */
  nextDay: string | null;
  /** Bereiche, die der nächste Plan-Tag hauptsächlich belastet. */
  nextDayRegions: readonly Region[];
}

export interface CoachToday {
  kind: TodayKind;
  reasons: Reason[];
  /** Darf der Plan-Tag gestartet werden (oder lieber nicht)? */
  startPlan: boolean;
}

const READY = 75;

export function coachToday(c: CoachInput): CoachToday {
  const reasons: Reason[] = [];
  const notReady = c.recovery.filter((r) => r.percent < READY).sort((a, b) => a.percent - b.percent);
  const blocking = notReady.filter((r) => c.nextDayRegions.includes(r.region) || r.region === 'system');

  if (c.trainedToday) return { kind: 'rest', reasons: [{ key: 'trainedToday' }], startPlan: false };
  if (c.todayKind === 'match') return { kind: 'match', reasons: [{ key: 'matchToday' }], startPlan: false };
  if (c.rehab) {
    reasons.push({ key: 'rehab' });
    if (c.nextDay) reasons.push({ key: 'planNext', day: c.nextDay });
    return { kind: 'rehab', reasons, startPlan: true };
  }

  let kind: TodayKind = 'train';
  if (c.todayKind === 'rest') { kind = 'rest'; reasons.push({ key: 'restDay' }); }
  if (c.tomorrowKind === 'match') { kind = kind === 'rest' ? 'rest' : 'light'; reasons.push({ key: 'matchTomorrow' }); }
  if (c.loadZone === 'danger') { kind = 'rest'; reasons.push({ key: 'loadDanger' }); }
  else if (c.loadZone === 'high' && kind === 'train') { kind = 'light'; reasons.push({ key: 'loadHigh' }); }
  if (c.readiness != null && c.readiness < 45) { kind = kind === 'train' ? 'light' : kind; reasons.push({ key: 'readinessLow', value: c.readiness }); }
  if (blocking.length && kind === 'train') { kind = 'light'; reasons.push({ key: 'notRecovered', region: blocking[0].region, percent: blocking[0].percent }); }

  // Lange Pause: lieber locker wieder einsteigen als gar nicht (auch an einem Ruhetag)
  if (c.daysSinceLast != null && c.daysSinceLast >= 4 && kind === 'rest' && !reasons.some((r) => r.key === 'loadDanger')) {
    kind = 'light';
    reasons.push({ key: 'longBreak', days: c.daysSinceLast });
  }

  if (kind === 'train') {
    if (c.readiness != null && c.readiness >= 70) reasons.push({ key: 'readinessGood', value: c.readiness });
    if (c.recovery.length && !notReady.length) reasons.push({ key: 'recovered' });
    if (c.loadZone === 'low') reasons.push({ key: 'loadLow' });
    if (c.nextDay) reasons.push({ key: 'planNext', day: c.nextDay });
  }
  return { kind, reasons, startPlan: kind === 'train' };
}

/** Hauptsächlich belastete Bereiche einer Übungsliste (für "passt der nächste Plan-Tag zur Erholung?"). */
export function regionsOf(items: readonly { region: Region | null; sets: number }[]): Region[] {
  const sum = new Map<Region, number>();
  for (const i of items) if (i.region) sum.set(i.region, (sum.get(i.region) ?? 0) + i.sets);
  const total = [...sum.values()].reduce((a, b) => a + b, 0);
  return [...sum.entries()].filter(([, v]) => total > 0 && v / total >= 0.25).map(([r]) => r);
}
