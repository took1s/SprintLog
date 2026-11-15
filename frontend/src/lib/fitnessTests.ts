// Leistungstests für Fußballer: Sprint 10/30 m, Sprung (CMJ), Richtungswechsel 5-10-5, Yo-Yo IR1, 30-15 IFT.
// Ergebnis -> Niveau (Amateur, Semi-Profi, Profi, Elite) mit Ausrichtung auf die Position. Richtwerte für erwachsene Männer
// aus Studien (Haugen et al. 2013, Profi-Fußball Norwegen; Yo-Yo- und 30-15-IFT-Normen; Pro-Agility-Benchmarks),
// gerechnet auf Lichtschranke mit Start 0,5 m hinter der Linie. Ziel ist Orientierung, keine Diagnose.
import { addDays, daysBetween } from './routines';

export const TEST_IDS = ['sprint10', 'sprint30', 'cmj', 'agility', 'yoyo', 'ift'] as const;
export type TestId = (typeof TEST_IDS)[number];

export type Position = 'goalkeeper' | 'defender' | 'fullback' | 'midfielder' | 'winger' | 'striker';
export const LEVELS = ['amateur', 'semi', 'pro', 'elite'] as const;
export type Level = (typeof LEVELS)[number] | 'below';

export interface TestDef {
  id: TestId;
  unit: 's' | 'cm' | 'm' | 'kmh';
  lowerIsBetter: boolean;
  decimals: number;
  /** Eingabegrenzen (wie der Server). */
  min: number;
  max: number;
  step: number;
  /** Schwellen ab denen ein Niveau erreicht ist (Amateur, Semi, Profi, Elite). */
  norms: [number, number, number, number];
  /** Anpassung der Schwellen je Position (+ = leichter erreichbar). */
  position: Partial<Record<Position, number>>;
}

export const TESTS: Record<TestId, TestDef> = {
  sprint10: { id: 'sprint10', unit: 's', lowerIsBetter: true, decimals: 2, min: 1.2, max: 4, step: 0.01, norms: [1.95, 1.85, 1.76, 1.68],
    position: { striker: -0.03, winger: -0.03, midfielder: 0.02, goalkeeper: 0.05 } },
  sprint30: { id: 'sprint30', unit: 's', lowerIsBetter: true, decimals: 2, min: 3, max: 8, step: 0.01, norms: [4.5, 4.32, 4.15, 4.0],
    position: { striker: -0.06, winger: -0.06, midfielder: 0.04, goalkeeper: 0.12 } },
  cmj: { id: 'cmj', unit: 'cm', lowerIsBetter: false, decimals: 1, min: 5, max: 90, step: 0.5, norms: [33, 37, 40, 44],
    position: { goalkeeper: -1.5, defender: -1.5, striker: -1.5, midfielder: 1.5 } },
  agility: { id: 'agility', unit: 's', lowerIsBetter: true, decimals: 2, min: 3.5, max: 8, step: 0.01, norms: [4.85, 4.6, 4.4, 4.2],
    position: { winger: -0.05, fullback: -0.05, goalkeeper: 0.1 } },
  yoyo: { id: 'yoyo', unit: 'm', lowerIsBetter: false, decimals: 0, min: 40, max: 4000, step: 40, norms: [1400, 1800, 2200, 2600],
    position: { midfielder: -200, fullback: -200, winger: -100, defender: 150, striker: 150, goalkeeper: 700 } },
  ift: { id: 'ift', unit: 'kmh', lowerIsBetter: false, decimals: 1, min: 8, max: 26, step: 0.5, norms: [17.5, 18.5, 19.5, 20.5],
    position: { midfielder: -0.5, fullback: -0.5, defender: 0.3, striker: 0.3, goalkeeper: 2 } },
};

/**
 * Schwellen für eine Position: der Tabellenwert sagt, um wie viel es leichter (+) bzw. strenger (-) ist.
 * Bei "kleiner ist besser" (Zeiten) wird die Hürde dadurch größer, sonst kleiner. Ohne Position: Feldspieler allgemein.
 */
export function thresholds(test: TestId, position: Position | null | undefined): [number, number, number, number] {
  const def = TESTS[test];
  const shift = position ? def.position[position] ?? 0 : 0;
  return def.norms.map((n) => round(def.lowerIsBetter ? n + shift : n - shift, def.decimals)) as [number, number, number, number];
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const better = (def: TestDef, a: number, b: number) => (def.lowerIsBetter ? a <= b : a >= b);

export interface Rating {
  level: Level;
  /** Nächstes Niveau und wie weit es entfernt ist (in der Einheit des Tests, immer positiv). */
  next: (typeof LEVELS)[number] | null;
  gap: number | null;
  /** Lage auf der Skala 0 (deutlich unter Amateur) bis 100 (Elite) - für den Balken. */
  score: number;
}

export function rate(test: TestId, value: number, position?: Position | null): Rating {
  const def = TESTS[test];
  const th = thresholds(test, position);
  let reached = -1;
  th.forEach((t, i) => { if (better(def, value, t)) reached = i; });
  const level: Level = reached < 0 ? 'below' : LEVELS[reached]!;
  const nextIdx = reached + 1 < LEVELS.length ? reached + 1 : null;
  const gap = nextIdx == null ? null : round(Math.abs(th[nextIdx]! - value), def.decimals);
  // Skala: eine Stufe Abstand unter Amateur = 0, Elite = 100 (linear zwischen den Schwellen)
  const stops = [th[0]! - (th[1]! - th[0]!), ...th];
  let score: number;
  const v = def.lowerIsBetter ? -value : value;
  const s = stops.map((x) => (def.lowerIsBetter ? -x : x));
  if (v <= s[0]!) score = 0;
  else if (v >= s[4]!) score = 100;
  else {
    let i = 0;
    while (v > s[i + 1]!) i++;
    score = Math.round((i + (v - s[i]!) / (s[i + 1]! - s[i]!)) * 25);
  }
  return { level, next: nextIdx == null ? null : LEVELS[nextIdx]!, gap, score };
}

export interface TestResult { clientId: string; day: string; test: TestId; value: number; notes?: string | null; updatedAt: string; pending?: 'put' | 'delete' }

/** Verlauf eines Tests (alt -> neu) und Veränderung zum vorherigen Ergebnis (positiv = besser). */
export function history(results: readonly TestResult[], test: TestId) {
  const list = results.filter((r) => r.test === test && r.pending !== 'delete').sort((a, b) => a.day.localeCompare(b.day));
  const last = list[list.length - 1] ?? null;
  const prev = list[list.length - 2] ?? null;
  const def = TESTS[test];
  const change = last && prev ? round(def.lowerIsBetter ? prev.value - last.value : last.value - prev.value, def.decimals) : null;
  const best = list.length ? list.reduce((b, r) => (better(def, r.value, b.value) ? r : b)) : null;
  return { list, last, prev, change, best };
}

/** Wieder testen: ab 6 Wochen fällig, ab 8 Wochen überfällig; ohne Test: Einstieg empfehlen. */
export const RETEST_DUE = 42;
export const RETEST_OVERDUE = 56;
export function testDue(results: readonly TestResult[], today: string): { state: 'none' | 'ok' | 'due' | 'overdue'; lastDay: string | null; days: number | null; nextDay: string | null } {
  const days = results.filter((r) => r.pending !== 'delete').map((r) => r.day).sort();
  const lastDay = days[days.length - 1] ?? null;
  if (!lastDay) return { state: 'none', lastDay: null, days: null, nextDay: null };
  const since = daysBetween(lastDay, today);
  return { state: since >= RETEST_OVERDUE ? 'overdue' : since >= RETEST_DUE ? 'due' : 'ok', lastDay, days: since, nextDay: addDays(lastDay, RETEST_DUE) };
}

/** Zahl mit passender Genauigkeit; Yo-Yo ohne Nachkommastellen. */
export const formatValue = (test: TestId, value: number, locale?: string): string =>
  value.toLocaleString(locale, { minimumFractionDigits: TESTS[test].decimals, maximumFractionDigits: TESTS[test].decimals });
