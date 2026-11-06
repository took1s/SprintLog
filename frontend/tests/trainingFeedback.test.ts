import { describe, expect, it } from 'vitest';
import { computeRecords, detectPRs, exerciseKey, exerciseSeries, metricsFor, metricValue, setVolume, summarizeWorkout } from '@/lib/analytics';
import { applyWorkoutOps, gymKey, isGymDependent, liveSessionText, liveSetText, type EditableSession } from '@/lib/liveWorkout';
import { cardioText, describeSet, parseDuration } from '@/lib/format';
import { toPayload } from '@/lib/sync';
import { exerciseTrends } from '@/lib/progress';
import { previousSets } from '@/lib/workout';
import type { Exercise, QueueEntry, Workout, WorkoutSet } from '@/types';

const at = (d: number) => new Date(2026, 10, d, 18).toISOString();
const assisted = (date: string, weight: number, reps: number, gym: string | null = null): Workout =>
  ({ date, gym, workoutType: 'Gym', sets: [{ exerciseId: 111, exerciseName: 'Assisted Pull-up Machine', trackingType: 'WeightReps', isAssisted: true, weight, reps }] } as Workout);

describe('Unterstützte Maschine (Gravitron): weniger Hilfe ist besser', () => {
  const ws = [assisted(at(1), 40, 8), assisted(at(3), 35, 8), assisted(at(5), 35, 10), assisted(at(6), 45, 12), assisted(at(7), 30, 6)];

  it('Rekord = geringste Hilfe bei mindestens gleich vielen Wdh., kein "Max-Gewicht"', () => {
    const r = computeRecords(ws).get('id:111')!;
    expect(r.isAssisted).toBe(true);
    expect(r.maxWeight).toBeNull();
    expect(r.maxE1RM).toBeNull();
    expect(r.minAssist).toMatchObject({ value: 35, reps: 10 }); // 30 kg x6 sind weniger Wdh. -> zählt nicht
    expect(setVolume(ws[0]!.sets[0])).toBe(0); // das Gewicht hilft, es wird nicht bewegt
  });

  it('Rekord-Abzeichen nur, wenn die Hilfe sinkt - mehr Gewicht ist kein Rekord', () => {
    const { events } = detectPRs(ws);
    expect(events.map((e) => `${e.field}:${e.value}`)).toEqual(['minAssist:35', 'minAssist:35']);
    expect(events.some((e) => e.field === 'maxWeight')).toBe(false);
  });

  it('Verlauf: Hilfe (weniger = besser), 0 kg Hilfe ist ein echter Wert', () => {
    const metrics = metricsFor('WeightReps', false, true);
    expect(metrics[0]).toMatchObject({ key: 'minAssist', lowerIsBetter: true });
    const series = exerciseSeries([...ws, assisted(at(9), 0, 5)], 'id:111', 'minAssist').map((p) => p.value);
    expect(series).toEqual([40, 35, 35, 45, 30, 0]);
    expect(metricValue([], 'minAssist')).toBe(-1);
    const [trend] = exerciseTrends(computeRecords(ws).values(), ws, new Date(2026, 10, 10));
    expect(trend!.metric.key).toBe('minAssist');
  });
});

describe('Einseitig und Ausdauergerät', () => {
  const plank: WorkoutSet = { exerciseId: 48, trackingType: 'Duration', perSide: true, time: 45 };
  const split: WorkoutSet = { exerciseId: 33, trackingType: 'WeightReps', perSide: true, weight: 20, reps: 10 };
  const bike: WorkoutSet = { exerciseId: 84, trackingType: 'Cardio', time: 1200, distance: 8400, level: 8, power: 165, heartRate: 142 };

  it('pro Seite: Volumen und Haltezeit zählen beide Seiten', () => {
    expect(setVolume(split)).toBe(400);
    expect(summarizeWorkout({ sets: [plank] }).durationWork).toBe(90);
    expect(describeSet(plank, 'Duration')).toContain('45');
  });

  it('Ausdauer: Minuten, km, Ø Tempo und zeitgewichtete Ø Leistung', () => {
    expect(summarizeWorkout({ sets: [bike] }).cardioMinutes).toBe(20);
    expect(metricsFor('Cardio').map((m) => m.key)).toEqual(['cardioMinutes', 'cardioKm', 'avgSpeed', 'avgPower']);
    expect(metricValue([bike], 'cardioMinutes')).toBe(20);
    expect(metricValue([bike], 'cardioKm')).toBe(8.4);
    expect(metricValue([bike], 'avgSpeed')).toBe(25.2);
    expect(metricValue([bike, { ...bike, time: 120, power: 300 }], 'avgPower')).toBe(177); // 20 min @165 + 2 min @300
    const r = computeRecords([{ date: at(1), workoutType: 'Gym', sets: [bike] } as Workout]).get('id:84')!;
    expect(r.longest?.value).toBe(1200);
    expect(r.maxDistance?.value).toBe(8400);
    expect(r.maxPower?.value).toBe(165);
  });

  it('Anzeige und Eingabe der Dauer', () => {
    expect(cardioText(bike)).toMatch(/^20:00 · 8[.,]4 .+ · L8 · 165 .+ · 142 /);
    expect(cardioText(bike, false)).not.toContain('142');
    expect(parseDuration('20')).toBe(1200);
    expect(parseDuration('20,5')).toBe(1230);
    expect(parseDuration('12:30')).toBe(750);
    expect(parseDuration('1:05:00')).toBe(3900);
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('')).toBeNull();
  });
});

describe('Studios', () => {
  const machine = { name: 'Lat Pulldown', category: 'Gym', trackingType: 'WeightReps' } as Exercise;

  it('Maschinen, Kabel, unterstützte und Ausdauergeräte hängen vom Studio ab, Hanteln nicht', () => {
    expect(isGymDependent(machine)).toBe(true);
    expect(isGymDependent({ ...machine, name: 'Cable Crossover' })).toBe(true);
    expect(isGymDependent({ ...machine, name: 'Bench Press' })).toBe(false);
    expect(isGymDependent({ ...machine, name: 'Gravitron', isCustom: true })).toBe(true);
    expect(isGymDependent({ ...machine, name: 'Cycling (Stationary)', trackingType: 'Cardio' })).toBe(true);
    expect(isGymDependent({ ...machine, name: 'Leg Press', category: 'Football' })).toBe(false);
    expect(gymKey('  Top  Fit ')).toBe('top fit');
    expect(gymKey(null, 'Orange Gym')).toBe('orange gym'); // ohne Angabe = Hauptstudio
  });

  it('Rekorde pro Studio: 6. November im anderen Studio ist kein falscher Rekord', () => {
    const lat = (d: number, weight: number, gym: string | null): Workout =>
      ({ date: at(d), gym, workoutType: 'Gym', sets: [{ exerciseId: 44, trackingType: 'WeightReps', weight, reps: 8 }] } as Workout);
    const ws = [lat(1, 60, null), lat(3, 62.5, 'Orange Gym'), lat(6, 80, 'TopFit')];
    const keyOf = (s: WorkoutSet, w: Workout) => `${exerciseKey(s)}@${gymKey(w.gym, 'Orange Gym')}`;
    const recs = computeRecords(ws, keyOf);
    expect(recs.get('id:44@orange gym')?.maxWeight?.value).toBe(62.5);
    expect(recs.get('id:44@topfit')?.maxWeight?.value).toBe(80);
    expect(detectPRs(ws, keyOf).events.filter((e) => e.field === 'maxWeight').map((e) => e.value)).toEqual([62.5]); // 80 kg im anderen Studio: erstes Mal dort, kein Rekord
    // "letztes Mal" an der Maschine: aus demselben Studio, sonst irgendeins
    expect(previousSets(ws, 44, null, (w) => gymKey(w.gym, 'Orange Gym') === 'orange gym')[0]?.weight).toBe(62.5);
    expect(previousSets(ws, 44, null, (w) => gymKey(w.gym) === 'nowhere')[0]?.weight).toBe(80);
  });

  it('Payload: Studio, Notizen und Ausdauerwerte (nur gesetzte)', () => {
    const entry = {
      clientId: 'c1', date: at(6), workoutType: 'Gym', status: 'pending', attempts: 0, error: null, gym: ' TopFit ',
      exerciseNotes: [{ exerciseId: 44, skipped: true, reason: 'equipment', note: ' besetzt ' }],
      sets: [{ exerciseId: 84, time: 1200, distance: 8400, power: 165 }, { exerciseId: 1, weight: 80, reps: 5 }],
    } as QueueEntry;
    const p = toPayload(entry);
    expect(p.gym).toBe('TopFit');
    expect(p.exerciseNotes).toEqual([{ exerciseId: 44, note: 'besetzt', skipped: true, reason: 'equipment' }]);
    expect(p.sets[0]).toMatchObject({ power: 165 });
    expect(p.sets[0]).not.toHaveProperty('heartRate');
    expect(p.sets[1]).not.toHaveProperty('level');
  });
});

describe('KI im Training', () => {
  const catalog = new Map<number, Exercise>([
    [1, { id: 1, name: 'Bench Press', category: 'Gym', muscleGroup: 'Chest', trackingType: 'WeightReps' }],
    [44, { id: 44, name: 'Lat Pulldown', category: 'Gym', muscleGroup: 'Back', trackingType: 'WeightReps' }],
    [111, { id: 111, name: 'Assisted Pull-up Machine', category: 'Gym', muscleGroup: 'Back', trackingType: 'WeightReps', isAssisted: true }],
  ]);
  const base = (): EditableSession => ({
    sets: [
      { exerciseId: 1, weight: 60, reps: 8, isWarmup: true },
      { exerciseId: 1, weight: 80, reps: 5 },
      { exerciseId: 1, weight: 80, reps: 5 },
    ],
    order: [1, 44],
    done: [],
    plan: { targets: [{ exerciseId: 1, sets: 4, exerciseName: 'Bench Press' }, { exerciseId: 44, sets: 3, exerciseName: 'Lat Pulldown' }] },
  });

  it('Beschreibung: Reihenfolge, Sätze kompakt, Vorgaben, Notizen, Studio', () => {
    const text = liveSessionText({
      startedAt: new Date(2026, 10, 6, 18, 0).toISOString(), gym: 'TopFit', planDayName: 'Push', order: [1, 44, 111],
      sets: [...base().sets, { exerciseId: 111, weight: 25, reps: 8 }] as never, done: [111],
      notes: { 44: { exerciseId: 44, skipped: true, reason: 'equipment', note: 'besetzt' } },
      targets: new Map([[1, { sets: 4, repsMin: 5, repsMax: 5, targetRpe: 8 }]]),
    }, (id) => catalog.get(id), new Date(2026, 10, 6, 18, 25));
    const json = JSON.parse(text);
    expect(json).toMatchObject({ gym: 'TopFit', planDay: 'Push', minutesSinceStart: 25 });
    expect(json.exercises.map((e: { id: number }) => e.id)).toEqual([1, 44, 111]);
    expect(json.exercises[0]).toMatchObject({ sets: ['warmup 60x8', '80x5', '80x5'], plan: { sets: 4, repsMin: 5, targetRpe: 8 }, done: false });
    expect(json.exercises[1]).toMatchObject({ skipped: 'equipment', note: 'besetzt' });
    expect(json.exercises[2]).toMatchObject({ assisted: true, sets: ['assist 25kg x8'], done: true });
    expect(liveSetText({ time: 45 }, { trackingType: 'Duration', perSide: true })).toBe('45s/side');
  });

  it('Sehr lange Einheit: gekürzt, aber gültiges JSON', () => {
    const sets = Array.from({ length: 300 }, () => ({ exerciseId: 1, weight: 80, reps: 5 }));
    const text = liveSessionText({ startedAt: null, gym: null, order: [1], sets, done: [], notes: {}, targets: new Map() }, (id) => catalog.get(id), new Date(), 800);
    expect(text.length).toBeLessThanOrEqual(800);
    expect(JSON.parse(text).exercises[0].sets[0]).toBe('298 earlier sets');
  });

  it('Tauschen: Original mit Sätzen bleibt (fertig), Ersatz übernimmt den Rest der Vorgabe', () => {
    const { session, touched } = applyWorkoutOps(base(), [{ op: 'replace', exerciseId: 1, withExerciseId: 111, weight: 30, reps: 8 }]);
    expect(session.order).toEqual([1, 111, 44]);
    expect(session.done).toContain(1);
    expect(session.sets).toHaveLength(3); // nichts Geloggtes geht verloren
    expect(session.plan!.targets.find((t) => t.exerciseId === 1)!.sets).toBe(2);
    expect(session.plan!.targets.find((t) => t.exerciseId === 111)).toMatchObject({ sets: 2, replacedFrom: 'Bench Press' });
    expect(session.templates![111]).toEqual([{ weight: 30, reps: 8, time: null, distance: null }, { weight: 30, reps: 8, time: null, distance: null }]);
    expect(touched).toEqual(expect.arrayContaining([1, 111]));
  });

  it('Tauschen ohne Sätze ersetzt den Block an derselben Stelle; Entfernen ohne Sätze nimmt ihn raus', () => {
    const swapped = applyWorkoutOps(base(), [{ op: 'replace', exerciseId: 44, withExerciseId: 111, note: 'Gerät besetzt' }]).session;
    expect(swapped.order).toEqual([1, 111]);
    expect(swapped.hints![111]).toBe('Gerät besetzt');
    expect(swapped.plan!.targets.map((t) => t.exerciseId)).toEqual([1, 111]);

    const removed = applyWorkoutOps(base(), [{ op: 'remove', exerciseId: 44 }, { op: 'remove', exerciseId: 1 }]).session;
    expect(removed.order).toEqual([1]); // Bankdrücken hat Sätze -> bleibt, wird abgeschlossen
    expect(removed.done).toEqual([1]);
    expect(removed.plan!.targets.map((t) => t.exerciseId)).toEqual([1]);
  });

  it('Anpassen: neue Vorgaben für die restlichen Sätze, Satznummern bleiben; Hinzufügen hängt an', () => {
    const { session } = applyWorkoutOps({ ...base(), done: [1] }, [
      { op: 'adjust', exerciseId: 1, sets: 2, weight: 75, reps: 6 },
      { op: 'add', exerciseId: 111, sets: 3, reps: 10, weight: 20 },
      { op: 'add', exerciseId: 1 }, // schon drin: keine Dopplung
    ]);
    expect(session.done).toEqual([]);
    const t = session.templates![1]!;
    expect(t.slice(0, 3).map((x) => x.weight)).toEqual([60, 80, 80]);
    expect(session.templates![111]).toHaveLength(3);
    expect(session.plan!.targets.find((x) => x.exerciseId === 1)!.sets).toBeGreaterThanOrEqual(2);
    expect(session.order).toEqual([1, 44, 111]);
    expect(applyWorkoutOps(base(), [{ op: 'adjust', exerciseId: 1, sets: 1, reps: 3 }]).session.templates![1]!.at(-1)).toMatchObject({ weight: 80, reps: 3 });
  });

  it('Original bleibt unverändert (Rückgängig braucht den alten Stand)', () => {
    const before = base();
    const copy = JSON.stringify(before);
    applyWorkoutOps(before, [{ op: 'remove', exerciseId: 44 }]);
    expect(JSON.stringify(before)).toBe(copy);
  });
});
