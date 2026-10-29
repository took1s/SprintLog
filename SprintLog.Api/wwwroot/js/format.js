// Formatierung für die Anzeige. Locale = Browser-Einstellung.

const nf = (digits) => new Intl.NumberFormat(undefined, { maximumFractionDigits: digits });
const nf0 = nf(0);
const nf1 = nf(1);
const nf2 = nf(2);

export const formatNumber = (value, digits = 1) =>
  value == null || Number.isNaN(value) ? '--' : (digits === 0 ? nf0 : digits === 2 ? nf2 : nf1).format(value);

/** Große Zahlen kompakt: 12.4k */
export const formatCompact = (value) =>
  new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value ?? 0);

/** Sekunden -> "4.2 s", "1:30", "1:05:00" */
export function formatSeconds(seconds) {
  if (!(seconds > 0)) return '--';
  if (seconds < 60) return `${nf2.format(seconds)} s`;
  return formatClock(Math.round(seconds));
}

/** Sekunden -> "m:ss" bzw. "h:mm:ss" */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Dauer einer Einheit -> "1 h 05 min" / "45 min" */
export function formatDuration(totalSeconds) {
  if (!(totalSeconds > 0)) return '';
  const minutes = Math.round(totalSeconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

export const formatDate = (iso, options = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  new Date(iso).toLocaleDateString(undefined, options);

export const formatTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export const formatWeekday = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });

/** Relativ: "today", "yesterday", "3 days ago" */
export function formatRelative(iso, now = new Date()) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(days) < 7) return rtf.format(-days, 'day');
  if (Math.abs(days) < 30) return rtf.format(-Math.round(days / 7), 'week');
  return rtf.format(-Math.round(days / 30), 'month');
}

/** Kurzbeschreibung eines Satzes je nach Tracking-Typ. */
export function describeSet(set, trackingType) {
  switch (trackingType) {
    case 'DistanceTime': {
      const parts = [];
      if (set.distance > 0) parts.push(`${formatNumber(set.distance)} m`);
      if (set.time > 0) parts.push(formatSeconds(set.time));
      return parts.join(' / ') || 'No metrics';
    }
    case 'Duration':
      return formatSeconds(set.time);
    default:
      if (!(set.reps > 0)) return 'No metrics';
      return set.weight > 0 ? `${formatNumber(set.weight, 2)} kg × ${set.reps}` : `BW × ${set.reps}`;
  }
}
