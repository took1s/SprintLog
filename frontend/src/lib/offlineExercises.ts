// Eigene Übungen ohne Netz anlegen (Gym-WLAN mit Login-Seite, Funkloch im Keller).
// Die Übung bekommt eine negative, lokale ID und ist sofort benutzbar. Beim nächsten Sync wird sie angelegt;
// danach werden alle Verweise (Einheit, Warteschlange, Favoriten) auf die echte ID umgeschrieben -
// BEVOR Einheiten mit dieser Übung an den Server gehen.

import type { Exercise, QueueEntry, WorkoutSet } from '../types';

export const isLocalExerciseId = (id: number | null | undefined): boolean => typeof id === 'number' && id < 0;

/** Neue lokale ID (negativ, eindeutig genug für ein Gerät). */
export function localExerciseId(existing: readonly { id: number }[], now = Date.now()): number {
  let id = -Math.max(1, now % 1_000_000_000);
  while (existing.some((e) => e.id === id)) id -= 1;
  return id;
}

type IdMap = ReadonlyMap<number, number>;
const map1 = (m: IdMap, id: number) => m.get(id) ?? id;

export function remapSets<T extends Pick<WorkoutSet, 'exerciseId'>>(sets: readonly T[], m: IdMap): T[] {
  return sets.map((s) => (s.exerciseId != null && m.has(s.exerciseId) ? { ...s, exerciseId: map1(m, s.exerciseId) } : s));
}

export function remapQueue(queue: readonly QueueEntry[], m: IdMap): QueueEntry[] {
  return queue.map((q) => (q.sets.some((s) => s.exerciseId != null && m.has(s.exerciseId)) ? { ...q, sets: remapSets(q.sets, m) } : q));
}

export function remapIds(ids: readonly number[] | undefined, m: IdMap): number[] | undefined {
  return ids?.map((id) => map1(m, id));
}

export function remapKeys<V>(rec: Record<number, V> | undefined, m: IdMap): Record<number, V> | undefined {
  if (!rec) return rec;
  return Object.fromEntries(Object.entries(rec).map(([k, v]) => [map1(m, Number(k)), v]));
}

/** Enthält die Warteschlange noch lokale Übungen? Dann darf sie (noch) nicht gesendet werden. */
export const queueHasLocalExercises = (queue: readonly QueueEntry[]): boolean =>
  queue.some((q) => q.sets.some((s) => isLocalExerciseId(s.exerciseId)));

/** Server-Liste + noch nicht synchronisierte lokale Übungen. */
export function mergeExercises(server: readonly Exercise[], local: readonly Exercise[]): Exercise[] {
  return [...server, ...local.filter((l) => isLocalExerciseId(l.id))];
}
