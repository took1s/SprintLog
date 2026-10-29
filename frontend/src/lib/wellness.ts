// Tägliches Befinden (Wellness-Fragebogen nach McLean et al. 2010): Schlaf, Energie, Muskelkater, Stimmung - je 1-5, höher = besser.
// Readiness = Mittelwert in Prozent (1 -> 0 %, 5 -> 100 %). Kombiniert mit der Trainingslast (ACWR) ergibt sich eine Empfehlung.

import type { LoadZone } from './program';

export interface WellnessEntry {
  date: string; // yyyy-MM-dd (lokaler Tag)
  sleep: number;
  energy: number;
  soreness: number;
  mood: number;
  sleepHours?: number | null;
  note?: string | null;
  updatedAt?: string;
  /** Nur lokal: noch nicht an den Server übertragen. */
  pending?: boolean;
}

export const WELLNESS_FIELDS = ['sleep', 'energy', 'soreness', 'mood'] as const;
export type WellnessField = (typeof WELLNESS_FIELDS)[number];

/** Lokales Datum als yyyy-MM-dd (nicht UTC - "heute" ist der Tag des Nutzers). */
export function localDay(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 0-100 %. */
export function readiness(entry: Pick<WellnessEntry, WellnessField> | null | undefined): number | null {
  if (!entry) return null;
  const values = WELLNESS_FIELDS.map((f) => entry[f]);
  if (values.some((v) => !(v >= 1 && v <= 5))) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(((avg - 1) / 4) * 100);
}

export type ReadinessLevel = 'good' | 'ok' | 'low';
export const readinessLevel = (value: number | null): ReadinessLevel | null =>
  value == null ? null : value >= 70 ? 'good' : value >= 45 ? 'ok' : 'low';

/**
 * Empfehlung aus Befinden + Belastung:
 *  - niedrige Readiness oder Lastspitze -> leichter Tag
 *  - gute Readiness bei optimaler/niedriger Last -> normal/hart trainieren
 */
export type ReadinessAdvice = 'easy' | 'normal' | 'push' | 'unknown';
export function readinessAdvice(value: number | null, zone: LoadZone): ReadinessAdvice {
  const level = readinessLevel(value);
  if (!level) return 'unknown';
  if (level === 'low' || (level === 'ok' && (zone === 'high' || zone === 'danger')) || zone === 'danger') return 'easy';
  if (level === 'good' && (zone === 'optimal' || zone === 'low' || zone === 'unknown')) return 'push';
  return 'normal';
}

/** Letzte `days` Tage (ältester zuerst) mit Readiness oder null für Tage ohne Eintrag. */
export function readinessTrend(entries: readonly WellnessEntry[], days = 14, today = new Date()): { date: string; value: number | null }[] {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const out: { date: string; value: number | null }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = localDay(d);
    out.push({ date: key, value: readiness(byDate.get(key)) });
  }
  return out;
}

/** Durchschnitt der letzten 7 Tage mit Eintrag (für den Vergleich "heute vs. sonst"). */
export function weeklyAverage(entries: readonly WellnessEntry[], today = new Date()): number | null {
  const values = readinessTrend(entries, 7, today).map((d) => d.value).filter((v): v is number => v != null);
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}
