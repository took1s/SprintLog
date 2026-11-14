// Wochenbericht (Mo-So): Einheiten, Plan-Tage erfüllt, Routinen, Zusatz-Einheiten, Belastung im Vergleich zur Vorwoche,
// Schmerz-Tendenz der Reha. Reine Funktionen (getestet) - Karte und Coach-Frage bauen darauf auf.
// Sonntag: laufende Woche (bis heute); Montag: abgeschlossene Vorwoche. Sonst keine Karte.
import type { Workout } from '@/types';
import { indexByDay, type DayIndex } from './calendar';
import { addDays, isDone, isScheduled, painSummary, parseDay, tracksPain, type PainTrend, type Routine } from './routines';
import { displayStatus, type PlannedWorkout } from './planned';
import { kindOf, weekdayOf, type DayKind, type Schedule } from './schedule';

export interface ReportDay {
  day: string;
  kind: DayKind;
  sessions: number;
  minutes: number;
  load: number;
  match: boolean;
  /** Fällige Routinen und davon (vollständig) erledigt. */
  routinesDue: number;
  routinesDone: number;
  future: boolean;
}

export interface WeekReport {
  from: string;
  to: string;
  days: ReportDay[];
  sessions: number;
  matches: number;
  minutes: number;
  load: number;
  /** Vorwoche zum Vergleich. */
  prevSessions: number;
  prevLoad: number;
  /** Plan-Trainingstage (bis heute) mit Einheit; null ohne Wochenplan. */
  planDays: { done: number; total: number } | null;
  routines: { done: number; due: number; pct: number | null };
  rehab: { title: string; latest: number | null; trend: PainTrend | null }[];
  extras: { done: number; skipped: number; missed: number; open: number };
  /** Mittlere Anstrengung (session RPE) der Einheiten mit Angabe. */
  rpe: number | null;
}

/** Montag der Woche, für die heute ein Bericht gezeigt wird - Sonntag: diese Woche, Montag: letzte; sonst null. */
export function reportWeekStart(today: string): string | null {
  const wd = weekdayOf(parseDay(today));
  if (wd === 6) return addDays(today, -6);
  if (wd === 0) return addDays(today, -7);
  return null;
}

export interface WeekReportInput {
  today: string;
  workouts: readonly Workout[];
  schedule: Partial<Schedule> | null;
  routines: readonly Routine[];
  planned: readonly PlannedWorkout[];
  index?: DayIndex;
}

const MATCH = 'Match';

export function weekReport(input: WeekReportInput, monday: string): WeekReport {
  const { today, schedule } = input;
  const index = input.index ?? indexByDay(input.workouts);
  const routines = input.routines.filter((r) => r.pending !== 'delete');
  const to = addDays(monday, 6);
  const days: ReportDay[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    const d = index.get(day);
    const due = routines.filter((r) => isScheduled(r, day));
    return {
      day,
      kind: kindOf(schedule, i),
      sessions: d?.sessions ?? 0,
      minutes: d?.minutes ?? 0,
      load: d?.load ?? 0,
      match: !!d?.kinds.includes(MATCH),
      routinesDue: day <= today ? due.length : 0,
      routinesDone: day <= today ? due.filter((r) => isDone(r, day)).length : 0,
      future: day > today,
    };
  });
  const sum = (f: (d: ReportDay) => number) => days.reduce((n, d) => n + f(d), 0);
  const prev = Array.from({ length: 7 }, (_, i) => index.get(addDays(monday, i - 7)));

  const trainingDays = days.filter((d) => d.kind === 'training' && !d.future);
  const hasPlan = !!schedule && ((schedule.trainingDays ?? 0) | (schedule.matchDays ?? 0)) !== 0;
  const routinesDue = sum((d) => d.routinesDue);
  const routinesDone = sum((d) => d.routinesDone);

  const extras = { done: 0, skipped: 0, missed: 0, open: 0 };
  for (const p of input.planned) {
    if (p.date < monday || p.date > to) continue;
    const s = displayStatus(p, today);
    if (s === 'done') extras.done++;
    else if (s === 'skipped') extras.skipped++;
    else if (s === 'missed') extras.missed++;
    else extras.open++;
  }

  const rpes = days.flatMap((d) => (index.get(d.day)?.workouts ?? []).map((w) => w.sessionRpe).filter((x): x is number => x != null && x > 0));
  const last = to < today ? to : today;
  const rehab = routines
    .filter((r) => tracksPain(r) && r.startDate <= last && (!r.endDate || r.endDate >= monday))
    .map((r) => { const s = painSummary(r, last); return { title: r.title, latest: s.latest?.level ?? null, trend: s.trend }; });

  return {
    from: monday,
    to,
    days,
    sessions: sum((d) => d.sessions),
    matches: days.filter((d) => d.match).length,
    minutes: sum((d) => d.minutes),
    load: Math.round(sum((d) => d.load)),
    prevSessions: prev.reduce((n, d) => n + (d?.sessions ?? 0), 0),
    prevLoad: Math.round(prev.reduce((n, d) => n + (d?.load ?? 0), 0)),
    planDays: hasPlan && trainingDays.length ? { done: trainingDays.filter((d) => d.sessions > 0).length, total: trainingDays.length } : null,
    routines: { done: routinesDone, due: routinesDue, pct: routinesDue ? Math.round((routinesDone / routinesDue) * 100) : null },
    rehab,
    extras,
    rpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
  };
}

/** Kennzahlen für die Coach-Frage (Englisch, der Coach antwortet in der Sprache des Nutzers). */
export function reportFacts(r: WeekReport): string {
  const lines = [
    `Week ${r.from} to ${r.to}.`,
    `Sessions: ${r.sessions} (previous week ${r.prevSessions}), matches: ${r.matches}, minutes: ${r.minutes}.`,
    `Load (sRPE x min): ${r.load} (previous week ${r.prevLoad})${r.rpe != null ? `, average session RPE ${r.rpe}` : ''}.`,
    r.planDays ? `Plan training days done: ${r.planDays.done}/${r.planDays.total}.` : 'No weekly plan schedule set.',
    r.routines.due ? `Routines done on scheduled days: ${r.routines.done}/${r.routines.due} (${r.routines.pct}%).` : 'No routines due this week.',
    `Extra sessions: ${r.extras.done} done, ${r.extras.skipped} skipped, ${r.extras.missed} missed, ${r.extras.open} open.`,
    ...r.rehab.map((x) => `Rehab "${x.title}": latest pain ${x.latest ?? 'n/a'}/10, trend ${x.trend ?? 'n/a'}.`),
    `Per day: ${r.days.map((d) => `${d.day} ${d.kind}${d.sessions ? ` ${d.sessions} session(s)${d.match ? ' incl. match' : ''}` : ''}${d.routinesDue ? ` routines ${d.routinesDone}/${d.routinesDue}` : ''}`).join('; ')}.`,
  ];
  return lines.join('\n');
}
