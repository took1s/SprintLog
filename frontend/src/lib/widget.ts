// Widget auf dem iPhone-Home-Bildschirm: die App schreibt einen Schnappschuss der nächsten 7 Tage (Einheit des Tages,
// fällige Routinen mit Durchgängen und nächster Uhrzeit) in die gemeinsame App-Gruppe; das Widget zeigt den Eintrag des
// jeweiligen Tages - auch nach Mitternacht ohne die App zu öffnen. Texte und Farben kommen fertig aus der App.
import { addDays, doneCount, isScheduled, nextRound, parseDay, type Routine } from './routines';
import { kindOf, weekdayOf, type Schedule } from './schedule';
import type { PlannedWorkout } from './planned';

export type WidgetSessionKind = 'training' | 'match' | 'extra' | 'rest';

export interface WidgetDay {
  day: string;
  session: { kind: WidgetSessionKind; label: string; title: string | null };
  routines: { title: string; done: number; total: number; next: string | null }[];
}

export interface WidgetSnapshot {
  v: 1;
  updatedAt: string;
  days: WidgetDay[];
  /** Farben des aktiven Themes als "r g b". */
  colors: { bg: string; fg: string; muted: string; accent: string; success: string };
  labels: { routines: string; allDone: string; none: string; next: string };
}

export interface WidgetInput {
  today: string;
  now: string;
  routines: readonly Routine[];
  planned: readonly PlannedWorkout[];
  schedule: Partial<Schedule> | null;
  /** Name des nächsten Plan-Tags (für Trainingstage). */
  planDayName: string | null;
  labels: WidgetSnapshot['labels'] & { training: string; match: string; rest: string; extra: string };
  colors: WidgetSnapshot['colors'];
}

/** Höchstens so viele Routinen pro Tag (das mittlere Widget zeigt drei). */
const MAX_ROUTINES = 6;

export function widgetSnapshot(input: WidgetInput, days = 7): WidgetSnapshot {
  const { labels } = input;
  const list = input.routines.filter((r) => r.pending !== 'delete');
  return {
    v: 1,
    updatedAt: new Date().toISOString(),
    colors: input.colors,
    labels: { routines: labels.routines, allDone: labels.allDone, none: labels.none, next: labels.next },
    days: Array.from({ length: days }, (_, i) => {
      const day = addDays(input.today, i);
      const extra = input.planned.find((p) => p.date === day && p.status === 'planned' && p.pending !== 'delete');
      const kind = kindOf(input.schedule, weekdayOf(parseDay(day)));
      const session: WidgetDay['session'] = extra
        ? { kind: 'extra', label: labels.extra, title: extra.title }
        : kind === 'match' ? { kind: 'match', label: labels.match, title: null }
        : kind === 'training' ? { kind: 'training', label: labels.training, title: i === 0 ? input.planDayName : null }
        : { kind: 'rest', label: labels.rest, title: null };
      const routines = list.filter((r) => isScheduled(r, day))
        .sort((a, b) => Number(b.kind === 'rehab') - Number(a.kind === 'rehab') || a.title.localeCompare(b.title))
        .slice(0, MAX_ROUTINES)
        .map((r) => {
          const done = i === 0 ? Math.min(doneCount(r, day), r.timesPerDay) : 0;
          const next = i === 0 ? nextRound(r, day, input.now)?.time ?? null : r.times[0] ?? null;
          return { title: r.title, done, total: r.timesPerDay, next };
        });
      return { day, session, routines };
    }),
  };
}
