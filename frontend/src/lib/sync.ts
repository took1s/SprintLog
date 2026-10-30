// Offline-Warteschlange für Einheiten.
//
// Einträge: op "create" (Standard, POST) oder "update" (PUT auf eine bestehende Einheit, workoutId).
//
// Ablauf: Einheit wird IMMER zuerst lokal in die Queue geschrieben (mit eigener clientId),
// danach wird synchronisiert. Der Server erkennt dieselbe clientId wieder (idempotent) -
// dadurch entstehen auch bei abgebrochenen Verbindungen oder doppelten Versuchen keine Duplikate.

import type { QueueEntry, QueueStatusValue, Workout, WorkoutSet } from '../types';

export const QueueStatus = Object.freeze({
  Pending: 'pending',   // wartet auf Verbindung
  Failed: 'failed',     // vom Server abgelehnt (z. B. Validierung) - braucht Nutzer-Entscheidung
} as const satisfies Record<string, QueueStatusValue>);

export interface WorkoutPayload {
  workoutType: string;
  clientId: string;
  date: string;
  durationSeconds: number | null;
  sessionRpe: number | null;
  quality?: number | null;
  notes: string | null;
  programDayId: number | null;
  match?: { goals?: number | null; assists?: number | null; opponent?: string | null } | null;
  sets: {
    exerciseId: number | null | undefined;
    weight: number | null;
    reps: number | null;
    distance: number | null;
    time: number | null;
    rpe: number | null;
    note?: string | null;
    isWarmup: boolean;
  }[];
}

/** Baut den API-Payload aus einem Queue-Eintrag. */
export function toPayload(entry: QueueEntry): WorkoutPayload {
  return {
    workoutType: entry.workoutType,
    clientId: entry.clientId,
    date: entry.date,
    durationSeconds: entry.durationSeconds ?? null,
    sessionRpe: entry.sessionRpe ?? null,
    quality: entry.quality ?? null,
    notes: entry.notes ?? null,
    programDayId: entry.programDayId ?? null,
    match: entry.match ?? null,
    sets: entry.sets.map((s) => ({
      exerciseId: s.exerciseId,
      weight: s.weight ?? null,
      reps: s.reps ?? null,
      distance: s.distance ?? null,
      time: s.time ?? null,
      rpe: s.rpe ?? null,
      isWarmup: !!s.isWarmup,
      note: s.note ?? null,
    })),
  };
}

export const isUpdate = (entry: Pick<QueueEntry, 'op' | 'workoutId'> | null | undefined): boolean =>
  entry?.op === 'update' && entry.workoutId != null;

interface LegacyEntry { id?: number; workoutType?: string; status?: string; sets?: WorkoutSet[] }

/** Wandelt v2-Queue-Einträge ({ id, workoutType, sets, status }) in das neue Format um. */
export function migrateLegacyQueue(legacy: LegacyEntry[] | null | undefined, newClientId: () => string): QueueEntry[] {
  return (legacy ?? [])
    .filter((e): e is LegacyEntry & { sets: WorkoutSet[] } => !!e && e.status !== 'synced' && Array.isArray(e.sets) && e.sets.length > 0)
    .map((e) => ({
      clientId: newClientId(),
      date: new Date(typeof e.id === 'number' ? e.id : Date.now()).toISOString(),
      durationSeconds: null,
      workoutType: e.workoutType || 'Gym',
      sets: e.sets.map((s) => ({ ...s, exerciseName: s.exerciseName ?? s.name })),
      status: QueueStatus.Pending,
      attempts: 0,
      error: null,
    }));
}

interface SendError { isNetwork?: boolean; isAuth?: boolean; isRetryable?: boolean; message?: string }

export interface SyncResult { queue: QueueEntry[]; synced: number; stoppedBy: null | 'network' | 'auth' | 'server' }

/**
 * Synchronisiert alle offenen Einträge nacheinander.
 * @param queue aktuelle Queue (wird nicht verändert)
 * @param send schickt einen Eintrag an die API (wirft ApiError)
 */
export async function syncQueue(queue: readonly QueueEntry[], send: (payload: WorkoutPayload, entry: QueueEntry) => Promise<unknown>): Promise<SyncResult> {
  const remaining: QueueEntry[] = [];
  let synced = 0;
  let stoppedBy: SyncResult['stoppedBy'] = null;

  for (const entry of queue) {
    // Nach einem Abbruch: Rest unverändert behalten (Reihenfolge bleibt erhalten).
    if (stoppedBy || entry.status === QueueStatus.Failed) {
      remaining.push(entry);
      continue;
    }

    try {
      await send(toPayload(entry), entry);
      synced += 1;
    } catch (caught) {
      const error = caught as SendError | null;
      if (error?.isNetwork) {
        stoppedBy = 'network';
        remaining.push(entry);
      } else if (error?.isAuth) {
        stoppedBy = 'auth';
        remaining.push(entry);
      } else if (error?.isRetryable) {
        stoppedBy = 'server';
        remaining.push({ ...entry, attempts: (entry.attempts ?? 0) + 1, error: error.message ?? null });
      } else {
        // 4xx (z. B. Validierung): Wiederholen bringt nichts -> markieren, Rest weiter synchronisieren.
        remaining.push({ ...entry, status: QueueStatus.Failed, attempts: (entry.attempts ?? 0) + 1, error: error?.message ?? 'Rejected by server' });
      }
    }
  }

  return { queue: remaining, synced, stoppedBy };
}

/** Queue-Einträge im Format der Server-Historie (für Anzeige und Auswertungen). */
export function queueAsWorkouts(queue: readonly QueueEntry[] | null | undefined): Workout[] {
  return (queue ?? []).map((e) => ({
    id: isUpdate(e) ? e.workoutId : null,
    clientId: e.clientId,
    date: e.date,
    workoutType: e.workoutType,
    durationSeconds: e.durationSeconds ?? null,
    sessionRpe: e.sessionRpe ?? null,
    quality: e.quality ?? null,
    notes: e.notes ?? null,
    op: e.op ?? 'create',
    programDayId: e.programDayId ?? null,
    match: e.match ?? null,
    pending: true,
    status: e.status,
    error: e.error ?? null,
    sets: e.sets.map((s, i) => ({
      exerciseId: s.exerciseId,
      exerciseName: s.exerciseName ?? s.name,
      trackingType: s.trackingType,
      muscleGroup: s.muscleGroup,
      category: s.category,
      setNumber: i + 1,
      weight: s.weight ?? null,
      reps: s.reps ?? null,
      distance: s.distance ?? null,
      time: s.time ?? null,
      rpe: s.rpe ?? null,
      isWarmup: !!s.isWarmup,
    })),
  }));
}
