// Fortschritt: Zeiträume, Kennzahlen eines Verlaufs und die Trendliste aller Übungen - reine Funktionen (getestet).
import type { Workout, WorkoutSet } from '@/types';
import {
  exerciseKey, hasMetricValue, isWorkingSet, metricsFor, metricValue, percentChange,
  type ExerciseRecord, type MetricOption, type SeriesPoint,
} from '@/lib/analytics';

export type ProgressRange = '1m' | '3m' | '6m' | '1y' | 'all';
export const PROGRESS_RANGES: readonly ProgressRange[] = ['1m', '3m', '6m', '1y', 'all'];
const RANGE_MONTHS: Record<ProgressRange, number> = { '1m': 1, '3m': 3, '6m': 6, '1y': 12, all: 0 };

/** Erster Tag (00:00 lokal) eines Zeitraums bis heute; null = alles. */
export function rangeStart(range: ProgressRange, now: Date): Date | null {
  const months = RANGE_MONTHS[range];
  return months ? new Date(now.getFullYear(), now.getMonth() - months, now.getDate()) : null;
}

export function inRange(series: readonly SeriesPoint[], range: ProgressRange, now: Date): SeriesPoint[] {
  const from = rangeStart(range, now);
  return from ? series.filter((p) => new Date(p.date) >= from) : [...series];
}

/** Zeiträume, die gegenüber dem nächstgrößeren wirklich etwas weglassen (keine fünf Knöpfe mit gleichem Inhalt). */
export function usefulRanges(series: readonly SeriesPoint[], now: Date): ProgressRange[] {
  if (!series.length) return ['all'];
  const oldest = new Date(series[0]!.date);
  return PROGRESS_RANGES.filter((r) => {
    const from = rangeStart(r, now);
    return !from || from > oldest;
  });
}

export interface SeriesSummary {
  latest: SeriesPoint;
  first: SeriesPoint;
  best: SeriesPoint;
  /** Veränderung erster -> letzter Wert in %, "besser" positiv (auch bei Zeiten, wo weniger besser ist). */
  change: number | null;
  /** Letzter Wert gegenüber dem davor (absolut, "besser" positiv). */
  lastStep: number | null;
  /** Ist der letzte Wert der beste im Zeitraum? */
  latestIsBest: boolean;
  count: number;
}

const isBetter = (a: number, b: number, lowerIsBetter: boolean) => (lowerIsBetter ? a < b : a > b);

export function summarize(series: readonly SeriesPoint[], lowerIsBetter = false): SeriesSummary | null {
  if (!series.length) return null;
  const first = series[0]!;
  const latest = series[series.length - 1]!;
  let best = first;
  for (const p of series) if (isBetter(p.value, best.value, lowerIsBetter)) best = p;
  const raw = series.length > 1 ? percentChange(latest.value, first.value) : null;
  const prev = series.length > 1 ? series[series.length - 2]! : null;
  const step = prev ? Math.round((latest.value - prev.value) * 100) / 100 : null;
  return {
    latest, first, best,
    change: raw === null ? null : lowerIsBetter ? -raw : raw,
    lastStep: step === null ? null : lowerIsBetter ? -step : step,
    latestIsBest: latest.value === best.value,
    count: series.length,
  };
}

/** Punkte für eine Mini-Linie (SVG polyline) in einem w×h-Feld; die Werte werden auf die Höhe gestreckt. */
export function sparkPoints(values: readonly number[], w: number, h: number, pad = 2): string {
  if (!values.length) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = values.length > 1 ? pad + i * step : w / 2;
      const y = max === min ? h / 2 : pad + (1 - (v - min) / span) * (h - pad * 2);
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(' ');
}

/** Mögliche Kennzahlen einer Übung in Reihenfolge der Vorliebe (Gewicht, sonst Wiederholungen, Tempo, Dauer). */
export const metricsOf = (record: Pick<ExerciseRecord, 'trackingType' | 'maxWeight' | 'isAssisted'>): MetricOption[] =>
  metricsFor(record.trackingType, (record.maxWeight?.value ?? 0) > 0, !!record.isAssisted);

export interface ExerciseTrend {
  key: string;
  record: ExerciseRecord;
  metric: MetricOption;
  /** Letzte Werte (höchstens 12) für die Mini-Linie, chronologisch. */
  recent: number[];
  latest: number | null;
  /** Veränderung in den letzten 90 Tagen (oder seit Beginn, wenn es dort weniger als 2 Werte gibt). */
  change: number | null;
  lastDate: string | null;
}

/** Trend jeder Übung in einem Durchlauf über alle Einheiten (statt einer Runde pro Übung). */
export function exerciseTrends(records: Iterable<ExerciseRecord>, workouts: readonly Workout[] | null | undefined, now: Date): ExerciseTrend[] {
  // Alle Kandidaten gleichzeitig sammeln; genommen wird die erste Kennzahl mit Werten
  // (Weitsprung ohne Zeit hat kein Tempo, aber eine Distanz)
  const metrics = new Map<string, { record: ExerciseRecord; options: MetricOption[]; series: SeriesPoint[][] }>();
  for (const r of records) {
    if (r.sessions > 0) { const options = metricsOf(r); metrics.set(r.key, { record: r, options, series: options.map(() => []) }); }
  }

  const ordered = [...(workouts ?? [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (const w of ordered) {
    const byKey = new Map<string, WorkoutSet[]>();
    for (const s of w.sets ?? []) {
      if (!isWorkingSet(s)) continue;
      const key = exerciseKey(s);
      if (!metrics.has(key)) continue;
      (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(s);
    }
    for (const [key, sets] of byKey) {
      const entry = metrics.get(key)!;
      entry.options.forEach((m, i) => {
        const value = metricValue(sets, m.key);
        if (hasMetricValue(m.key, value)) entry.series[i]!.push({ date: w.date, value });
      });
    }
  }

  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
  return [...metrics.values()].map(({ record, options, series: all }) => {
    const pick = Math.max(0, all.findIndex((s) => s.length > 0));
    const metric = options[pick]!;
    const series = all[pick] ?? [];
    const recentWindow = series.filter((p) => new Date(p.date) >= since);
    const basis = recentWindow.length >= 2 ? recentWindow : series;
    return {
      key: record.key,
      record,
      metric,
      recent: series.slice(-12).map((p) => p.value),
      latest: series.length ? series[series.length - 1]!.value : null,
      change: summarize(basis, !!metric.lowerIsBetter)?.change ?? null,
      lastDate: record.lastDate,
    };
  });
}

export type TrendSort = 'recent' | 'sessions' | 'growth';

export function sortTrends(list: readonly ExerciseTrend[], sort: TrendSort, nameOf: (t: ExerciseTrend) => string): ExerciseTrend[] {
  const byName = (a: ExerciseTrend, b: ExerciseTrend) => nameOf(a).localeCompare(nameOf(b));
  const time = (d: string | null) => (d ? new Date(d).getTime() : 0);
  return [...list].sort((a, b) => {
    if (sort === 'sessions') return b.record.sessions - a.record.sessions || byName(a, b);
    if (sort === 'growth') return (b.change ?? -Infinity) - (a.change ?? -Infinity) || byName(a, b);
    return time(b.lastDate) - time(a.lastDate) || byName(a, b);
  });
}

/** Suche ohne Groß/klein und Akzente ("Bankdrücken" findet "bankdrucken"). */
export function matchesQuery(name: string, query: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const q = norm(query);
  return !q || norm(name).includes(q);
}
