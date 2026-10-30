// Chart.js-Wrapper. Nur die benötigten Bausteine werden registriert (Tree-Shaking: kleineres Bundle).
import {
  Chart, LineController, BarController, LineElement, BarElement, PointElement, LinearScale, CategoryScale,
  Filler, Tooltip, type TooltipItem,
} from 'chart.js';
import { formatDate } from './format';
import type { SeriesPoint, WeekBucket } from './analytics';
import { tokenColor } from './theme';

Chart.register(LineController, BarController, LineElement, BarElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

/** Farben/Schrift aus den Design-Tokens des aktiven Themes - bei jedem Zeichnen neu gelesen (Theme-Wechsel). */
function palette() {
  const body = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue('--font-body').trim();
  Chart.defaults.font.family = body || 'system-ui, sans-serif';
  Chart.defaults.color = tokenColor('muted');
  Chart.defaults.borderColor = tokenColor('fg', 0.06);
  return {
    // Text-Variante des Akzents: auch im hellen Pitch-Theme (Lime) genug Kontrast auf Weiß
    accent: tokenColor('accent-text'),
    accentLine: tokenColor('accent-text'),
    accentSoft: tokenColor('accent-text', 0.3),
    accentFill: tokenColor('accent-text', 0.12),
    field: tokenColor('success-text'),
    fieldFill: tokenColor('success', 0.15),
    best: tokenColor('gold'),
    surface: tokenColor('surface'),
    grid: tokenColor('fg', 0.06),
    tick: tokenColor('subtle'),
    tooltip: {
      backgroundColor: tokenColor('surface-2', 0.97),
      titleColor: tokenColor('muted'),
      bodyColor: tokenColor('fg'),
      titleFont: { size: 11 },
      bodyFont: { size: 13, weight: 'bold' as const },
      padding: 10,
      displayColors: false,
      cornerRadius: 8,
      borderColor: tokenColor('fg', 0.12),
      borderWidth: 1,
    },
  };
}

const axes = (unit: string, c: ReturnType<typeof palette>) => ({
  y: {
    beginAtZero: false,
    grid: { color: c.grid },
    ticks: { color: c.tick, font: { size: 10 } },
    title: unit ? { display: true, text: unit, color: c.tick, font: { size: 10 } } : undefined,
  },
  x: { grid: { display: false }, ticks: { color: c.tick, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
});

export interface ProgressChartOptions { label: string; unit: string; highlightBest?: boolean; lowerIsBetter?: boolean; field?: boolean }

/** Liniendiagramm für den Verlauf einer Übung. Gibt die Chart-Instanz zurück. */
export function renderProgressChart(canvas: HTMLCanvasElement | null | undefined, points: readonly SeriesPoint[],
  { label, unit, highlightBest = true, lowerIsBetter = false, field = false }: ProgressChartOptions): Chart | null {
  if (!canvas) return null;
  const c = palette();
  const color = field ? c.field : c.accentLine;
  const values = points.map((p) => p.value);
  const bestValue = values.length ? (lowerIsBetter ? Math.min(...values) : Math.max(...values)) : null;
  const isBest = (v: number) => highlightBest && v === bestValue;

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: points.map((p) => formatDate(p.date, { day: '2-digit', month: 'short' })),
      datasets: [{
        label,
        data: values,
        borderColor: color,
        backgroundColor: field ? c.fieldFill : c.accentFill,
        borderWidth: 3,
        pointBackgroundColor: values.map((v) => (isBest(v) ? c.best : c.surface)),
        pointBorderColor: values.map((v) => (isBest(v) ? c.best : color)),
        pointBorderWidth: 2,
        pointRadius: values.map((v) => (isBest(v) ? 6 : 4)),
        pointHoverRadius: 7,
        fill: true,
        tension: 0.3,
        cubicInterpolationMode: 'monotone',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: { ...c.tooltip, callbacks: { label: (ctx: TooltipItem<'line'>) => `${ctx.parsed.y} ${unit}` } },
      },
      scales: axes(unit, c),
    },
  });
}

export type WeeklyMetric = 'volume' | 'distance' | 'sessions' | 'load';

/** Balkendiagramm Wochenwerte. */
export function renderWeeklyChart(canvas: HTMLCanvasElement | null | undefined, weeks: readonly WeekBucket[],
  { metric = 'volume', unit = 'kg' }: { metric?: WeeklyMetric; unit?: string } = {}): Chart | null {
  if (!canvas) return null;
  const c = palette();
  const currentIndex = weeks.length - 1;
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: weeks.map((w) => formatDate(w.weekStart, { day: '2-digit', month: 'short' })),
      datasets: [{
        label: metric,
        data: weeks.map((w) => w[metric]),
        backgroundColor: weeks.map((_, i) => (i === currentIndex ? c.accent : c.accentSoft)),
        borderRadius: 6,
        maxBarThickness: 28,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: { ...c.tooltip, callbacks: { label: (ctx: TooltipItem<'bar'>) => `${Math.round(ctx.parsed.y ?? 0).toLocaleString()} ${unit}` } },
      },
      scales: { ...axes('', c), y: { ...axes('', c).y, beginAtZero: true } },
    },
  });
}
