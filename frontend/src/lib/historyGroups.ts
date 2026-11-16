// Verlauf nach Wochen (Mo-So) gruppiert, mit Wochen-Kennzahlen: Einheiten, Zeit, Trainingslast (sRPE × Minuten),
// und Volltextsuche über Übungen, Gegner, Notizen und Studio.
import type { Workout } from '../types';

export interface WeekGroup {
  /** Montag (yyyy-MM-dd, lokal). */
  key: string;
  start: Date;
  end: Date;
  workouts: Workout[];
  minutes: number;
  load: number;
  sets: number;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Liste (neueste zuerst) -> Wochen (neueste zuerst); Reihenfolge innerhalb bleibt. */
export function groupByWeek(list: readonly Workout[]): WeekGroup[] {
  const out: WeekGroup[] = [];
  const byKey = new Map<string, WeekGroup>();
  for (const w of list) {
    const start = mondayOf(new Date(w.date));
    const key = ymd(start);
    let g = byKey.get(key);
    if (!g) {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      g = { key, start, end, workouts: [], minutes: 0, load: 0, sets: 0 };
      byKey.set(key, g);
      out.push(g);
    }
    g.workouts.push(w);
    const minutes = Math.round((w.durationSeconds ?? 0) / 60);
    g.minutes += minutes;
    if (w.sessionRpe) g.load += w.sessionRpe * minutes;
    g.sets += w.sets.filter((s) => !s.isWarmup).length;
  }
  return out;
}

/** Suche (ohne Groß/Klein, mehrere Wörter = alle müssen vorkommen) über den Text, den nameOf je Satz liefert. */
export function matchesSearch(w: Workout, query: string, nameOf: (exerciseId: number | null, fallback?: string) => string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [
    ...w.sets.map((s) => nameOf(s.exerciseId ?? null, s.exerciseName)),
    w.notes ?? '', w.gym ?? '', w.match?.opponent ?? '', w.match?.wentWell ?? '', w.match?.toImprove ?? '',
    ...w.sets.map((s) => s.note ?? ''),
  ].join(' ').toLowerCase();
  return words.every((x) => hay.includes(x));
}
