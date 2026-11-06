// Kompakte Zusammenfassung der eigenen Trainingsdaten für den KI-Coach.
//
// Bewusst als Text (wenige Tausend Zeichen statt Rohdaten): günstiger, schneller und es verlassen nur die Daten das
// Gerät, die für eine Antwort nötig sind. Englische Feldnamen - das Modell antwortet trotzdem in der App-Sprache.

import type { Workout, WorkoutSet } from '../types';
import type { WellnessEntry } from './wellness';

export const AI_CONTEXT_MAX = 11_000;
const DAY = 86_400_000;
const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface AiContextInput {
  now: Date;
  program: {
    name: string;
    goal: string;
    week: number;
    weeks: number;
    nextDay: string | null;
    days: { name: string; exercises: string[] }[];
  } | null;
  /** Wochentage (0 = Montag) mit Training bzw. Spiel - null ohne Wochenplan. */
  schedule: { training: number[]; match: number[] } | null;
  coach: { kind: string; reasons: string[] };
  recovery: { region: string; percent: number; readyAt: Date }[];
  load: { zone: string; ratio: number | null; acute: number; chronic: number };
  readiness: number | null;
  wellness: readonly WellnessEntry[];
  workouts: readonly Workout[];
  exerciseName: (set: WorkoutSet) => string;
  goals: { exercise: string; target: string; percent: number; achieved: boolean }[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const weekday = (d: Date) => WEEKDAY[(d.getDay() + 6) % 7];
const num = (n: number) => String(Math.round(n * 100) / 100);

/** Sätze einer Übung kurz: "80x8, 85x6" / "6x 30 m, best 4.2 s" / "3x 45 s". */
function setsText(sets: WorkoutSet[]): string {
  const work = sets.filter((s) => !s.isWarmup);
  const list = work.length ? work : sets;
  const first = list[0];
  const side = first?.perSide ? ' per side' : '';
  // Ausdauergerät: "20:00 min, 8.4 km, L8, 165 W, HR 142"
  if (first?.trackingType === 'Cardio') {
    return list.map((s) => [
      s.time ? `${Math.floor(s.time / 60)}:${String(Math.round(s.time % 60)).padStart(2, '0')} min` : '',
      s.distance ? `${num(s.distance / 1000)} km` : '',
      s.level != null ? `L${num(s.level)}` : '',
      s.power != null ? `${s.power} W` : '',
      s.heartRate != null ? `HR ${s.heartRate}` : '',
    ].filter(Boolean).join(', ')).join(' + ');
  }
  // Unterstützte Maschine: Gewicht = Hilfe (weniger ist besser)
  if (first?.isAssisted) return `assistance (less = better) ${list.map((s) => `${num(s.weight ?? 0)} kg x${s.reps ?? '?'}`).join(', ')}${side}`;
  if (first?.distance != null) {
    const times = list.map((s) => s.time).filter((x): x is number => x != null && x > 0);
    return `${list.length}x ${num(first.distance)} m${times.length ? `, best ${num(Math.min(...times))} s` : ''}`;
  }
  if (first?.time != null && first.weight == null && first.reps == null) return `${list.length}x ${list.map((s) => num(s.time ?? 0)).join('/')} s${side}`;
  const parts = list.map((s) => `${s.weight ? num(s.weight) : 'BW'}x${s.reps ?? '?'}${s.rpe ? ` @${s.rpe}` : ''}`);
  return (parts.length > 6 ? `${parts.slice(0, 6).join(', ')} (+${parts.length - 6} sets)` : parts.join(', ')) + side;
}

function workoutLine(w: Workout, name: AiContextInput['exerciseName']): string {
  const d = new Date(w.date);
  const head = [`${day(d)} ${weekday(d)}`, String(w.workoutType)];
  if (w.durationSeconds) head.push(`${Math.round(w.durationSeconds / 60)} min`);
  if (w.sessionRpe) head.push(`session RPE ${w.sessionRpe}`);
  if (w.gym) head.push(`gym ${w.gym}`);
  if (w.match && (w.match.goals || w.match.assists)) head.push(`${w.match.goals ?? 0} goals, ${w.match.assists ?? 0} assists`);
  const byExercise = new Map<string, WorkoutSet[]>();
  for (const s of w.sets) {
    const key = name(s);
    byExercise.set(key, [...(byExercise.get(key) ?? []), s]);
  }
  const body = [...byExercise.entries()].map(([n, sets]) => `${n} ${setsText(sets)}`).join('; ');
  // Notizen und Auslassungen pro Übung: warum etwas fehlt oder anders lief
  const exNotes = (w.exerciseNotes ?? []).map((n) => {
    const who = name({ exerciseId: n.exerciseId } as WorkoutSet);
    return `${who}: ${n.skipped ? `skipped${n.reason ? ` (${n.reason})` : ''}` : n.reason ?? 'note'}${n.note ? ` "${n.note.slice(0, 80)}"` : ''}`;
  });
  return `- ${head.join(', ')}${body ? `: ${body}` : ''}${exNotes.length ? ` | exercise notes: ${exNotes.join('; ')}` : ''}${w.notes ? ` | note: ${w.notes.slice(0, 120)}` : ''}`;
}

export function buildAiContext(c: AiContextInput): string {
  const out: string[] = [];
  out.push(`Today: ${day(c.now)} (${weekday(c.now)}), local time ${pad(c.now.getHours())}:${pad(c.now.getMinutes())}`);

  if (c.schedule) {
    const kind = (i: number) => (c.schedule!.match.includes(i) ? 'match' : c.schedule!.training.includes(i) ? 'training' : 'rest');
    out.push(`Week plan: ${WEEKDAY.map((w, i) => `${w} ${kind(i)}`).join(', ')}. Today is a ${kind((c.now.getDay() + 6) % 7)} day.`);
  } else out.push('Week plan: not set.');

  if (c.program) {
    const p = c.program;
    out.push(`Active program: "${p.name}" (goal ${p.goal}), week ${p.week} of ${p.weeks}${p.nextDay ? `, next day: "${p.nextDay}"` : ''}.`);
    for (const d of p.days) out.push(`  ${d.name}: ${d.exercises.join(', ')}`);
  } else out.push('Active program: none.');

  out.push(`App coach today (rule-based): ${c.coach.kind}${c.coach.reasons.length ? ` - ${c.coach.reasons.join('; ')}` : ''}.`);

  if (c.recovery.length) {
    out.push(`Recovery estimate: ${c.recovery.map((r) => `${r.region} ${r.percent}%${r.percent < 100 ? ` (ready ${weekday(r.readyAt)} ${pad(r.readyAt.getHours())}:00)` : ''}`).join(', ')}.`);
  }
  out.push(c.load.ratio != null
    ? `Training load: acute:chronic ratio ${c.load.ratio} (${c.load.zone}), last 7 days ${c.load.acute} AU vs. 4-week average ${c.load.chronic} AU.`
    : `Training load: not enough history for a ratio (last 7 days ${c.load.acute} AU).`);

  if (c.readiness != null) out.push(`Readiness today: ${c.readiness}/100.`);
  const recentWellness = [...c.wellness].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  if (recentWellness.length) {
    out.push('Wellness check-ins (1-5, higher is better; "muscles" 5 = no soreness):');
    for (const w of recentWellness) {
      out.push(`- ${w.date}: sleep ${w.sleep}${w.sleepHours ? ` (${num(w.sleepHours)} h)` : ''}, energy ${w.energy}, muscles ${w.soreness}, mood ${w.mood}${w.note ? ` | ${w.note.slice(0, 100)}` : ''}`);
    }
  }

  if (c.goals.length) {
    out.push(`Strength goals: ${c.goals.map((g) => `${g.exercise} ${g.target} - ${g.achieved ? 'achieved' : `${g.percent}%`}`).join('; ')}.`);
  }

  const since = c.now.getTime() - 28 * DAY;
  const recent = [...c.workouts]
    .filter((w) => new Date(w.date).getTime() >= since)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const older = c.workouts.length - recent.length;
  out.push(`Workouts in the last 28 days: ${recent.length}${older > 0 ? ` (plus ${older} older ones not listed)` : ''}. Newest first:`);

  // Bis zur Obergrenze auffüllen - lieber weniger alte Einheiten als ein abgeschnittener Kopf
  let text = out.join('\n');
  for (const w of recent) {
    const line = `\n${workoutLine(w, c.exerciseName)}`;
    if (text.length + line.length > AI_CONTEXT_MAX) { text += '\n- (older workouts omitted)'; break; }
    text += line;
  }
  return text.slice(0, AI_CONTEXT_MAX);
}
