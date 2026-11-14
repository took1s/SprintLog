// Erinnerungen: Routinen zu ihren Uhrzeiten, morgens die Einheit des Tages (Plan-Tag, Spiel, Zusatz-Einheit),
// sonntags der Wochenbericht. Reine Planung (getestet) - verschickt werden sie als lokale Mitteilungen (iOS-App)
// bzw. im Browser, solange SprintLog offen ist (stores/reminders.ts).
import { addDays, doneCount, isScheduled, parseDay, roundTime, slotOf, type DaySlot, type Routine } from './routines';
import { kindOf, weekdayOf, type Schedule } from './schedule';
import type { PlannedWorkout } from './planned';

export interface ReminderPrefs {
  enabled: boolean;
  /** Routinen zu ihren Uhrzeiten (ohne Uhrzeit: zu `routineTime`). */
  routines: boolean;
  routineTime: string;
  /** Morgens: Einheit des Tages. */
  today: boolean;
  todayTime: string;
  /** Sonntags: Wochenbericht. */
  report: boolean;
  reportTime: string;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = Object.freeze({
  enabled: false, routines: true, routineTime: '18:30', today: true, todayTime: '08:30', report: true, reportTime: '19:00',
});

export type ReminderKind = 'routine' | 'today' | 'report';

export interface Reminder {
  /** Stabile Nummer (iOS-Mitteilungen brauchen eine Zahl): gleiche Erinnerung = gleiche Id. */
  id: number;
  at: Date;
  kind: ReminderKind;
  /** Ziel beim Antippen: Routine-Id, Zusatz-Einheit-Id oder leer. */
  target: string | null;
  title: string;
  body: string;
}

/** Texte kommen von außen (i18n) - die Planung bleibt rein. */
export interface ReminderTexts {
  routine(r: Routine, k: number, slot: DaySlot | null): { title: string; body: string };
  planned(p: PlannedWorkout): { title: string; body: string };
  training(): { title: string; body: string };
  match(): { title: string; body: string };
  report(): { title: string; body: string };
}

export interface ReminderInput {
  now: Date;
  prefs: ReminderPrefs;
  routines: readonly Routine[];
  planned: readonly PlannedWorkout[];
  schedule: Partial<Schedule> | null;
  texts: ReminderTexts;
  /** Wie viele Tage im Voraus (iOS erlaubt 64 ausstehende Mitteilungen). */
  days?: number;
}

/** iOS hält höchstens 64 ausstehende Mitteilungen; eine bleibt für den Pausen-Timer frei. */
export const MAX_REMINDERS = 60;

const at = (day: string, time: string): Date => {
  const d = parseDay(day);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
};

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Stabile 31-Bit-Id aus einem Schlüssel (FNV-1a), Bereich 100000+ (darunter liegen feste Ids wie der Pausen-Timer). */
export function reminderId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return 100_000 + ((h >>> 0) % 2_000_000_000);
}

export function planReminders(input: ReminderInput): Reminder[] {
  const { now, prefs, texts } = input;
  if (!prefs.enabled) return [];
  const today = localKey(now);
  const out: Reminder[] = [];
  const add = (key: string, when: Date, kind: ReminderKind, target: string | null, text: { title: string; body: string }) => {
    if (when.getTime() <= now.getTime() + 30_000) return; // Vergangenes (und gleich Fälliges) nicht mehr planen
    out.push({ id: reminderId(key), at: when, kind, target, ...text });
  };

  for (let i = 0; i < (input.days ?? 7); i++) {
    const day = addDays(today, i);
    const wd = weekdayOf(parseDay(day));

    if (prefs.routines) {
      for (const r of input.routines) {
        if (r.pending === 'delete' || !isScheduled(r, day)) continue;
        const done = day === today ? doneCount(r, day) : 0;
        if (r.times.length > 0) {
          // Jeder Durchgang mit Uhrzeit; heute nur die noch offenen
          for (let k = done + 1; k <= r.timesPerDay; k++) {
            const time = roundTime(r, k);
            if (time) add(`r:${r.clientId}:${day}:${k}`, at(day, time), 'routine', r.clientId, texts.routine(r, k, slotOf(time)));
          }
        } else if (done < r.timesPerDay) {
          add(`r:${r.clientId}:${day}`, at(day, prefs.routineTime), 'routine', r.clientId, texts.routine(r, done + 1, null));
        }
      }
    }

    if (prefs.today) {
      const extra = input.planned.find((p) => p.date === day && p.status === 'planned');
      const kind = kindOf(input.schedule, wd);
      const when = at(day, prefs.todayTime);
      if (extra) add(`p:${extra.clientId}:${day}`, when, 'today', extra.clientId, texts.planned(extra));
      else if (kind === 'match') add(`m:${day}`, when, 'today', null, texts.match());
      else if (kind === 'training') add(`t:${day}`, when, 'today', null, texts.training());
    }

    if (prefs.report && wd === 6) add(`w:${day}`, at(day, prefs.reportTime), 'report', null, texts.report());
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_REMINDERS);
}
