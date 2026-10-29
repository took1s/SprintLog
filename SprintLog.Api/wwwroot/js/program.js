// Trainingspläne: nächster Tag, Zielvorgaben mit Double Progression, Belastungssteuerung (ACWR).
// Reine Funktionen ohne DOM/Netzwerk -> unit-getestet (frontend/tests/program.test.js).

import { exerciseKey, isWorkingSet, sessionLoad, roundTo } from './analytics.js';

const DAY_MS = 86_400_000;

/** Aktuelle Woche des Plans (1-basiert) seit dem Start. */
export function currentWeek(program, now = new Date()) {
  if (!program?.startedAt) return 1;
  const days = Math.floor((now.getTime() - new Date(program.startedAt).getTime()) / DAY_MS);
  return Math.max(1, Math.floor(days / 7) + 1);
}

/** Einheiten, die zu diesem Plan gehören (über programDayId), neueste zuerst. */
export function programWorkouts(program, workouts) {
  const dayIds = new Set((program?.days ?? []).map((d) => d.id));
  return (workouts ?? [])
    .filter((w) => w.programDayId != null && dayIds.has(w.programDayId))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Fortschritt im Plan: erledigte Einheiten seit Start, zuletzt erledigter Tag je Tag, nächster Tag (Rotation).
 */
export function programStatus(program, workouts, now = new Date()) {
  const days = [...(program?.days ?? [])].sort((a, b) => a.position - b.position);
  const done = programWorkouts(program, workouts);
  const since = program?.startedAt ? new Date(program.startedAt).getTime() : 0;
  const doneSinceStart = done.filter((w) => new Date(w.date).getTime() >= since);

  const lastByDay = new Map();
  for (const w of done) if (!lastByDay.has(w.programDayId)) lastByDay.set(w.programDayId, w.date);

  let next = days[0] ?? null;
  if (done.length && days.length) {
    const lastIndex = days.findIndex((d) => d.id === done[0].programDayId);
    next = days[(lastIndex + 1) % days.length];
  }

  const week = currentWeek(program, now);
  return {
    week,
    weeks: program?.weeks ?? 0,
    finished: week > (program?.weeks ?? Infinity),
    sessions: doneSinceStart.length,
    lastByDay,
    next,
    lastDate: done[0]?.date ?? null,
  };
}

/** Letzte Einheit, in der die Übung als Arbeitssatz vorkam - mit diesen Sätzen. */
function lastPerformance(exerciseId, workouts) {
  const key = exerciseKey({ exerciseId });
  const sorted = [...(workouts ?? [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const w of sorted) {
    const sets = (w.sets ?? []).filter((s) => exerciseKey(s) === key && isWorkingSet(s));
    if (sets.length) return { date: w.date, sets };
  }
  return null;
}

/**
 * Zielvorgabe für die nächste Einheit (Double Progression):
 *  - Alle geplanten Sätze haben das obere Ende des Wdh.-Bereichs erreicht -> Gewicht + Steigerung, Wdh. wieder unten.
 *  - Sonst gleiches Gewicht, eine Wiederholung mehr als beim schwächsten Satz (innerhalb des Bereichs).
 *  - Keine Historie -> Gewicht selbst wählen (ca. 2 Wdh. Reserve).
 * @returns {{ kind: 'new'|'progress'|'repeat'|'reference', weight?: number, reps?: number, distance?: number, time?: number, note: string }}
 */
export function suggestTarget(px, workouts) {
  const last = lastPerformance(px.exerciseId, workouts);
  const type = px.trackingType ?? 'WeightReps';

  if (type === 'DistanceTime') {
    const atDistance = last?.sets.filter((s) => s.distance === px.distance && s.time > 0) ?? [];
    const best = atDistance.length ? Math.min(...atDistance.map((s) => s.time)) : null;
    return {
      kind: best ? 'reference' : 'new',
      distance: px.distance ?? last?.sets[0]?.distance ?? null,
      time: best ?? null,
      note: best ? `Last best ${best} s over ${px.distance} m` : 'Run at full speed, full rest between reps',
    };
  }

  if (type === 'Duration') {
    const lastMin = last ? Math.min(...last.sets.map((s) => s.time ?? 0)) : 0;
    const allHit = last && last.sets.length >= px.sets && lastMin >= (px.time ?? 0);
    const time = allHit ? Math.max(px.time ?? 0, lastMin) + 5 : px.time ?? lastMin;
    return { kind: allHit ? 'progress' : last ? 'repeat' : 'new', time, note: allHit ? '+5 s - all holds completed last time' : `Hold ${time} s` };
  }

  const min = px.repsMin ?? px.repsMax ?? 8;
  const max = px.repsMax ?? px.repsMin ?? 8;
  const step = px.progressionStep ?? 2.5;
  if (!last) {
    return step > 0
      ? { kind: 'new', weight: null, reps: max, note: `Pick a weight for ${max} reps with ~2 reps in reserve` }
      : { kind: 'new', weight: 0, reps: min, note: `${min}-${max} reps per set` };
  }

  const topWeight = Math.max(...last.sets.map((s) => s.weight ?? 0));
  const topSets = last.sets.filter((s) => (s.weight ?? 0) === topWeight);
  const weakest = Math.min(...topSets.map((s) => s.reps ?? 0));
  const allHitTop = topSets.length >= px.sets && weakest >= max;

  if (allHitTop && step > 0) {
    return { kind: 'progress', weight: roundTo(topWeight + step, 0.25), reps: min, note: `+${step} kg - you hit ${max} reps on all sets` };
  }
  if (allHitTop) {
    return { kind: 'progress', weight: topWeight, reps: max, note: 'Top of the range reached - add load or a harder variation' };
  }
  const reps = Math.min(max, Math.max(min, weakest + 1));
  return { kind: 'repeat', weight: topWeight, reps, note: `Same weight, aim for ${reps} reps (range ${min}-${max})` };
}

/** Kurzform einer Vorgabe: "4 × 5-8 · RPE 8 · 2:00 rest" */
export function prescriptionText(px) {
  const parts = [];
  if (px.trackingType === 'DistanceTime') parts.push(`${px.sets} × ${px.distance} m`);
  else if (px.trackingType === 'Duration') parts.push(`${px.sets} × ${px.time} s`);
  else parts.push(`${px.sets} × ${px.repsMin === px.repsMax || px.repsMax == null ? px.repsMin ?? px.repsMax : `${px.repsMin}-${px.repsMax}`}`);
  if (px.targetRpe) parts.push(`RPE ${px.targetRpe}`);
  if (px.restSeconds) parts.push(`${Math.floor(px.restSeconds / 60)}:${String(px.restSeconds % 60).padStart(2, '0')} rest`);
  return parts.join(' · ');
}

/** Wie viele Arbeitssätze einer Vorgabe in der laufenden Session schon erledigt sind. */
export function setsDone(exerciseId, sessionSets) {
  return (sessionSets ?? []).filter((s) => s.exerciseId === exerciseId && isWorkingSet(s)).length;
}

/**
 * Belastungssteuerung nach dem Acute:Chronic Workload Ratio (Gabbett).
 * acute = Last der letzten 7 Tage, chronic = Durchschnitt pro Woche der letzten 28 Tage.
 * Zonen: < 0.8 niedrig, 0.8-1.3 optimal ("sweet spot"), 1.3-1.5 erhöht, > 1.5 hohes Verletzungsrisiko.
 */
export function loadStatus(workouts, now = new Date()) {
  const t = now.getTime();
  const inRange = (w, days) => {
    const d = new Date(w.date).getTime();
    return d <= t && d > t - days * DAY_MS;
  };
  const last28 = (workouts ?? []).filter((w) => inRange(w, 28));
  const withLoad = last28.filter((w) => sessionLoad(w) > 0);
  const acute = (workouts ?? []).filter((w) => inRange(w, 7)).reduce((sum, w) => sum + sessionLoad(w), 0);
  const chronic = withLoad.reduce((sum, w) => sum + sessionLoad(w), 0) / 4;

  const weeksWithData = new Set(withLoad.map((w) => Math.floor((t - new Date(w.date).getTime()) / (7 * DAY_MS)))).size;
  const enoughData = weeksWithData >= 3 && chronic > 0;
  const ratio = enoughData ? Math.round((acute / chronic) * 100) / 100 : null;

  let zone = 'unknown';
  if (ratio !== null) zone = ratio < 0.8 ? 'low' : ratio <= 1.3 ? 'optimal' : ratio <= 1.5 ? 'high' : 'danger';

  return {
    acute: Math.round(acute),
    chronic: Math.round(chronic),
    ratio,
    zone,
    enoughData,
    coverage: { withRpe: withLoad.length, total: last28.length },
  };
}

export const ZONE_INFO = Object.freeze({
  unknown: { label: 'Not enough data', tone: 'slate', advice: 'Rate your sessions (session RPE) for 3+ weeks to unlock load tracking.' },
  low: { label: 'Low', tone: 'blue', advice: 'Load is below your usual level - fine for a deload, otherwise build up gradually.' },
  optimal: { label: 'Sweet spot', tone: 'green', advice: 'Load matches what your body is used to. Keep it steady.' },
  high: { label: 'Elevated', tone: 'orange', advice: 'Load rises quickly. Plan an easier day and sleep well.' },
  danger: { label: 'Spike', tone: 'red', advice: 'Load spike vs. the last 4 weeks - higher injury risk. Reduce volume or intensity.' },
});

/** Leeres Programm für den Editor. */
export const emptyProgramDraft = () => ({
  id: null,
  name: '',
  goal: 'Strength',
  weeks: 8,
  days: [{ id: null, name: 'Day A', notes: '', exercises: [] }],
});

/** Programm (API) -> bearbeitbare Kopie für den Editor. */
export function toDraft(program) {
  return {
    id: program.id,
    name: program.name,
    goal: program.goal,
    weeks: program.weeks,
    days: program.days.map((d) => ({
      id: d.id,
      name: d.name,
      notes: d.notes ?? '',
      exercises: d.exercises.map((x) => ({
        exerciseId: x.exerciseId, sets: x.sets, repsMin: x.repsMin, repsMax: x.repsMax, distance: x.distance,
        time: x.time, targetRpe: x.targetRpe, restSeconds: x.restSeconds, progressionStep: x.progressionStep,
      })),
    })),
  };
}

/** Editor-Entwurf -> API-Payload; Felder passend zum Tracking-Typ der Übung. */
export function draftToPayload(draft, exercisesById) {
  const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
  return {
    name: draft.name.trim(),
    goal: draft.goal,
    weeks: Number(draft.weeks) || 1,
    days: draft.days.map((d) => ({
      id: d.id ?? null,
      name: d.name.trim(),
      notes: d.notes?.trim() || null,
      exercises: d.exercises.filter((x) => x.exerciseId).map((x) => {
        const type = exercisesById.get(Number(x.exerciseId))?.trackingType ?? 'WeightReps';
        return {
          exerciseId: Number(x.exerciseId),
          sets: num(x.sets) ?? 3,
          repsMin: type === 'WeightReps' ? num(x.repsMin) ?? num(x.repsMax) ?? 8 : null,
          repsMax: type === 'WeightReps' ? num(x.repsMax) ?? num(x.repsMin) ?? 8 : null,
          distance: type === 'DistanceTime' ? num(x.distance) ?? 20 : null,
          time: type === 'Duration' ? num(x.time) ?? 30 : null,
          targetRpe: num(x.targetRpe),
          restSeconds: num(x.restSeconds),
          progressionStep: type === 'WeightReps' ? num(x.progressionStep) ?? 2.5 : null,
        };
      }),
    })),
  };
}
