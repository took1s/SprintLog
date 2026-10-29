// Chart.js-Wrapper (Chart kommt als UMD-Global aus /vendor/chart.umd.js).
import { formatDate } from './format.js';

const ACCENT = '#00c3ff';
const GREEN = '#10b981';

function base() {
  const Chart = window.Chart;
  if (!Chart) return null;
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
  Chart.defaults.font.family = '"Inter Variable", Inter, system-ui, sans-serif';
  return Chart;
}

const tooltip = {
  backgroundColor: 'rgba(2,4,10,0.92)',
  titleFont: { size: 11 },
  bodyFont: { size: 13, weight: 'bold' },
  padding: 10,
  displayColors: false,
  cornerRadius: 8,
  borderColor: 'rgba(255,255,255,0.1)',
  borderWidth: 1,
};

const axes = (unit) => ({
  y: {
    beginAtZero: false,
    grid: { color: 'rgba(255,255,255,0.05)' },
    ticks: { color: '#64748b', font: { size: 10 } },
    title: unit ? { display: true, text: unit, color: '#64748b', font: { size: 10 } } : undefined,
  },
  x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
});

/** Liniendiagramm für den Verlauf einer Übung. Gibt die Chart-Instanz zurück. */
export function renderProgressChart(canvas, points, { label, unit, highlightBest = true, lowerIsBetter = false, field = false }) {
  const Chart = base();
  if (!Chart || !canvas) return null;
  const color = field ? GREEN : ACCENT;
  const values = points.map((p) => p.value);
  const bestValue = values.length ? (lowerIsBetter ? Math.min(...values) : Math.max(...values)) : null;

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
        pointBackgroundColor: values.map((v) => (highlightBest && v === bestValue ? '#facc15' : '#02040a')),
        pointBorderColor: values.map((v) => (highlightBest && v === bestValue ? '#facc15' : color)),
        pointBorderWidth: 2,
        pointRadius: values.map((v) => (highlightBest && v === bestValue ? 6 : 4)),
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
        tooltip: { ...tooltip, callbacks: { label: (ctx) => `${ctx.parsed.y} ${unit}` } },
      },
      scales: axes(unit),
    },
  });
}

/** Balkendiagramm Wochenvolumen. */
export function renderWeeklyChart(canvas, weeks, { metric = 'volume', unit = 'kg' } = {}) {
  const Chart = base();
  if (!Chart || !canvas) return null;
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
        tooltip: { ...tooltip, callbacks: { label: (ctx) => `${Math.round(ctx.parsed.y).toLocaleString()} ${unit}` } },
      },
      scales: { ...axes(''), y: { ...axes('').y, beginAtZero: true } },
    },
  });
}
