// Chart.js-Wrapper. Nur die benötigten Bausteine werden registriert (Tree-Shaking: kleineres Bundle).
import {
  Chart, LineController, BarController, LineElement, BarElement, PointElement, LinearScale, CategoryScale,
  Filler, Tooltip, type TooltipItem,
} from 'chart.js';
import { formatDate } from './format';
import type { SeriesPoint, WeekBucket } from './analytics';

Chart.register(LineController, BarController, LineElement, BarElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
Chart.defaults.font.family = '"Inter Variable", Inter, system-ui, sans-serif';

const ACCENT = '#00c3ff';
const GREEN = '#10b981';

const tooltip = {
  backgroundColor: 'rgba(2,4,10,0.92)',
  titleFont: { size: 11 },
  bodyFont: { size: 13, weight: 'bold' as const },
  padding: 10,
  displayColors: false,
  cornerRadius: 8,
  borderColor: 'rgba(255,255,255,0.1)',
  borderWidth: 1,
};

const axes = (unit: string) => ({
  y: {
    beginAtZero: false,
    grid: { color: 'rgba(255,255,255,0.05)' },
    ticks: { color: '#64748b', font: { size: 10 } },
    title: unit ? { display: true, text: unit, color: '#64748b', font: { size: 10 } } : undefined,
  },
  x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
});

export interface ProgressChartOptions { label: string; unit: string; highlightBest?: boolean; lowerIsBetter?: boolean; field?: boolean }

/** Liniendiagramm für den Verlauf einer Übung. Gibt die Chart-Instanz zurück. */
export function renderProgressChart(canvas: HTMLCanvasElement | null | undefined, points: readonly SeriesPoint[],
  { label, unit, highlightBest = true, lowerIsBetter = false, field = false }: ProgressChartOptions): Chart | null {
  if (!canvas) return null;
  const color = field ? GREEN : ACCENT;
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
        backgroundColor: `${color}26`,
        borderWidth: 3,
        pointBackgroundColor: values.map((v) => (isBest(v) ? '#facc15' : '#02040a')),
        pointBorderColor: values.map((v) => (isBest(v) ? '#facc15' : color)),
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
        tooltip: { ...tooltip, callbacks: { label: (ctx: TooltipItem<'line'>) => `${ctx.parsed.y} ${unit}` } },
      },
      scales: axes(unit),
    },
  });
}

export type WeeklyMetric = 'volume' | 'distance' | 'sessions' | 'load';

/** Balkendiagramm Wochenwerte. */
export function renderWeeklyChart(canvas: HTMLCanvasElement | null | undefined, weeks: readonly WeekBucket[],
  { metric = 'volume', unit = 'kg' }: { metric?: WeeklyMetric; unit?: string } = {}): Chart | null {
  if (!canvas) return null;
  const currentIndex = weeks.length - 1;
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: weeks.map((w) => formatDate(w.weekStart, { day: '2-digit', month: 'short' })),
      datasets: [{
        label: metric,
        data: weeks.map((w) => w[metric]),
        backgroundColor: weeks.map((_, i) => (i === currentIndex ? ACCENT : 'rgba(0,195,255,0.35)')),
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
        tooltip: { ...tooltip, callbacks: { label: (ctx: TooltipItem<'bar'>) => `${Math.round(ctx.parsed.y ?? 0).toLocaleString()} ${unit}` } },
      },
      scales: { ...axes(''), y: { ...axes('').y, beginAtZero: true } },
    },
  });
}
