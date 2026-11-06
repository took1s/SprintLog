// Laufende Einheit und KI: kompakte Beschreibung für den Coach und das Anwenden seiner Änderungen
// (hinzufügen, tauschen, entfernen, restliche Sätze anpassen). Dazu Studio-Helfer.
// Reine Funktionen (getestet) - der Store hält nur den Zustand und speichert.
import type { Exercise, ExerciseNote, TrackingType, WorkoutSet } from '@/types';

// ---------- Studios ----------

/** Vergleichsschlüssel eines Studios: ohne Groß/klein und Leerzeichen; keine Angabe = Hauptstudio. */
export const gymKey = (gym: string | null | undefined, mainGym?: string | null): string =>
  (gym?.trim() || mainGym?.trim() || '').toLocaleLowerCase().replace(/\s+/g, ' ');

/** Namen, die auf Maschinen/Kabel hinweisen (englischer Katalogname). */
const MACHINE = /machine|cable|smith|pulldown|pull-down|leg press|leg extension|leg curl|pec deck|hack squat|assisted|crossover|pullover|lat pull|hip abduction|hip adduction|glute kickback/i;

/**
 * Hängt der Wert vom Studio ab? Maschinen, Kabelzüge, unterstützte Geräte und Ausdauergeräte sind je Studio
 * anders kalibriert (25 kg am Kabel in Studio A sind nicht 25 kg in Studio B). Eigene Übungen auch - wir wissen
 * nicht, was dahinter steckt. Lang- und Kurzhantel, Körpergewicht und Feld bleiben vergleichbar.
 */
export function isGymDependent(ex: Pick<Exercise, 'name' | 'isAssisted' | 'isCustom' | 'trackingType' | 'category'> | null | undefined): boolean {
  if (!ex || ex.category === 'Football') return false;
  return !!ex.isAssisted || !!ex.isCustom || ex.trackingType === 'Cardio' || MACHINE.test(ex.name);
}

// ---------- Beschreibung für die KI ----------

interface LiveSet extends WorkoutSet { exerciseId: number }

export interface LiveSession {
  startedAt: string | null;
  gym: string | null;
  planDayName?: string | null;
  order: number[];
  sets: readonly LiveSet[];
  done: readonly number[];
  notes: Readonly<Record<number, ExerciseNote>>;
  targets: ReadonlyMap<number, { sets?: number | null; repsMin?: number | null; repsMax?: number | null; time?: number | null; distance?: number | null; targetRpe?: number | null; note?: string | null }>;
}

const r = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** Satz kurz wie im Server-Werkzeug: "80x5@8", "assist 25kg x8", "45s/side", "20:00min 8.4km L8 165W". */
export function liveSetText(s: WorkoutSet, ex: Pick<Exercise, 'trackingType' | 'isAssisted' | 'perSide'> | undefined): string {
  const side = ex?.perSide ? '/side' : '';
  const rpe = s.rpe ? `@${s.rpe}` : '';
  const warm = s.isWarmup ? 'warmup ' : '';
  const type = ex?.trackingType ?? s.trackingType;
  if (type === 'Cardio') {
    const parts = [
      s.time ? `${Math.floor(s.time / 60)}:${String(Math.round(s.time % 60)).padStart(2, '0')}min` : '',
      s.distance ? `${r(s.distance / 1000)}km` : '',
      s.level != null ? `L${s.level}` : '',
      s.power != null ? `${s.power}W` : '',
      s.heartRate != null ? `HR${s.heartRate}` : '',
    ];
    return warm + parts.filter(Boolean).join(' ') + rpe;
  }
  if (type === 'DistanceTime') return `${warm}${r(s.distance ?? 0, 0)}m ${r(s.time ?? 0)}s${side}`;
  if (type === 'Duration') return `${warm}${r(s.time ?? 0, 0)}s${side}`;
  const w = (s.weight ?? 0) > 0 ? r(s.weight!) : 0;
  return ex?.isAssisted ? `${warm}assist ${w}kg x${s.reps ?? 0}${side}${rpe}` : `${warm}${w || 'BW'}x${s.reps ?? 0}${side}${rpe}`;
}

/** Die laufende Einheit als kompaktes JSON für den Coach (Übungen in Reihenfolge, erledigte Sätze, Vorgaben, Notizen). */
export function liveSessionText(s: LiveSession, exercise: (id: number) => Exercise | undefined, now: Date, max = 7_500): string {
  const minutes = s.startedAt ? Math.max(0, Math.round((now.getTime() - new Date(s.startedAt).getTime()) / 60_000)) : 0;
  const exercises = s.order.map((id) => {
    const ex = exercise(id);
    const sets = s.sets.filter((x) => x.exerciseId === id);
    const target = s.targets.get(id);
    const note = s.notes[id];
    return {
      id,
      name: ex?.name ?? sets[0]?.exerciseName ?? `#${id}`,
      tracking: ex?.trackingType ?? sets[0]?.trackingType ?? 'WeightReps',
      ...(ex?.isAssisted ? { assisted: true } : {}),
      ...(ex?.perSide ? { perSide: true } : {}),
      ...(target ? { plan: Object.fromEntries(Object.entries(target).filter(([, v]) => v != null && v !== '')) } : {}),
      done: s.done.includes(id),
      sets: sets.map((x) => liveSetText(x, ex)),
      ...(note?.note ? { note: note.note } : {}),
      ...(note?.skipped ? { skipped: note.reason ?? true } : {}),
    };
  });
  const payload = { gym: s.gym ?? null, planDay: s.planDayName ?? null, minutesSinceStart: minutes, exercises };
  let text = JSON.stringify(payload);
  // Sehr lange Einheiten: älteste Satzdetails kürzen statt abzuschneiden (gültiges JSON bleibt)
  while (text.length > max && exercises.some((e) => e.sets.length > 2)) {
    const longest = exercises.reduce((a, b) => (b.sets.length > a.sets.length ? b : a));
    longest.sets = [`${longest.sets.length - 2} earlier sets`, ...longest.sets.slice(-2)];
    text = JSON.stringify(payload);
  }
  return text.length > max ? text.slice(0, max) : text;
}

// ---------- Änderungen der KI anwenden ----------

export interface WorkoutOp {
  op: 'add' | 'replace' | 'remove' | 'adjust';
  exerciseId: number;
  name?: string;
  withExerciseId?: number;
  withName?: string;
  trackingType?: TrackingType | string;
  sets?: number;
  reps?: number;
  weight?: number;
  time?: number;
  distance?: number;
  targetRpe?: number;
  note?: string;
}

/** Was von der laufenden Einheit angepasst wird (Struktur wie im Store, ohne Abhängigkeit davon). */
export interface EditableSession {
  sets: LiveSet[];
  order?: number[];
  done?: number[];
  templates?: Record<number, WorkoutSet[]>;
  hints?: Record<number, string>;
  plan: { targets: { exerciseId: number; sets: number; [k: string]: unknown }[] } | null;
}

/** Vorbelegte Sätze aus den Werten der KI (fehlende Werte: letzter Satz der Übung heute). */
function plannedSets(op: WorkoutOp, base: WorkoutSet | undefined, count: number): WorkoutSet[] {
  const set: WorkoutSet = {
    weight: op.weight ?? base?.weight ?? null,
    reps: op.reps ?? base?.reps ?? null,
    time: op.time ?? base?.time ?? null,
    distance: op.distance ?? base?.distance ?? null,
  };
  return Array.from({ length: Math.max(1, count) }, () => ({ ...set }));
}

/**
 * Wendet die Vorschläge auf eine Kopie der Einheit an. Bereits geloggte Sätze werden nie gelöscht:
 * "entfernen" einer Übung mit Sätzen schließt sie nur ab, "tauschen" lässt das Original mit seinen Sätzen stehen.
 * @returns neue Einheit und die Ids der geänderten Übungen (für den Store: Entwürfe verwerfen)
 */
export function applyWorkoutOps<T extends EditableSession>(session: T, ops: readonly WorkoutOp[]): { session: T; touched: number[] } {
  const s: T = JSON.parse(JSON.stringify(session)) as T; // JSON statt structuredClone: der Store reicht reaktive Proxys herein
  const order = [...new Set([...(s.order ?? []), ...(s.plan?.targets.map((x) => x.exerciseId) ?? []), ...s.sets.map((x) => x.exerciseId)])];
  let done = new Set(s.done ?? []);
  const templates = { ...(s.templates ?? {}) };
  const hints = { ...(s.hints ?? {}) };
  const touched = new Set<number>();
  const setsOf = (id: number) => s.sets.filter((x) => x.exerciseId === id);
  const target = (id: number) => s.plan?.targets.find((x) => x.exerciseId === id);

  for (const op of ops) {
    const id = op.exerciseId;
    const logged = setsOf(id);
    if (op.op === 'add') {
      if (!order.includes(id)) order.push(id);
      templates[id] = [...logged.map((x) => ({ ...x })), ...plannedSets(op, logged.at(-1), op.sets ?? 3)];
      done.delete(id);
    } else if (op.op === 'replace' && op.withExerciseId != null && op.withExerciseId !== id) {
      const to = op.withExerciseId;
      if (order.includes(to)) continue;
      const at = order.indexOf(id);
      const t = target(id);
      const workingDone = logged.filter((x) => !x.isWarmup).length;
      // Der Ersatz bekommt, was von der Vorgabe noch offen ist (oder was die KI sagt)
      const remaining = Math.max(1, op.sets ?? (t ? t.sets - workingDone : 3));
      if (logged.length) {
        order.splice(at < 0 ? order.length : at + 1, 0, to);
        done.add(id);
      } else {
        if (at < 0) order.push(to); else order.splice(at, 1, to);
        delete templates[id];
        done.delete(id);
      }
      if (t && s.plan) {
        const copy = { ...t, exerciseId: to, sets: remaining, replacedFrom: t.exerciseName ?? t.name ?? op.name };
        s.plan.targets = logged.length
          ? [...s.plan.targets.map((x) => (x.exerciseId === id ? { ...x, sets: Math.max(1, workingDone) } : x)), copy]
          : s.plan.targets.map((x) => (x.exerciseId === id ? copy : x));
      }
      templates[to] = plannedSets(op, undefined, remaining);
      touched.add(to);
    } else if (op.op === 'remove') {
      if (logged.length) {
        done.add(id);
      } else {
        const i = order.indexOf(id);
        if (i >= 0) order.splice(i, 1);
        if (s.plan) s.plan.targets = s.plan.targets.filter((x) => x.exerciseId !== id);
        delete templates[id];
        done.delete(id);
      }
    } else if (op.op === 'adjust') {
      if (!order.includes(id)) order.push(id);
      const more = op.sets ?? Math.max(1, (target(id)?.sets ?? logged.length + 1) - logged.filter((x) => !x.isWarmup).length);
      // Vorlage = schon Geloggtes (hält die Satznummern) + die neuen Vorgaben für die restlichen Sätze
      templates[id] = [...logged.map((x) => ({ ...x })), ...plannedSets(op, logged.filter((x) => !x.isWarmup).at(-1), more)];
      const t = target(id);
      if (t) t.sets = logged.filter((x) => !x.isWarmup).length + more;
      done.delete(id);
    } else {
      continue;
    }
    if (op.note) hints[op.op === 'replace' && op.withExerciseId ? op.withExerciseId : id] = op.note;
    touched.add(id);
  }

  done = new Set([...done].filter((x) => order.includes(x)));
  s.order = order;
  s.done = [...done];
  s.templates = templates;
  s.hints = hints;
  return { session: s, touched: [...touched] };
}
