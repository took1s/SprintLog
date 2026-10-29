// Delta-Sync der Historie: einmal alles laden, danach nur Änderungen (neu, bearbeitet, gelöscht).
// Reine Funktionen + ein Lader, der eine api-Instanz bekommt -> unit-getestet (tests/history.test.ts).

import type { Workout, WorkoutChanges } from '../types';

type Dated = Pick<Workout, 'date'> & { id?: number | null };
const byDateDesc = (a: Dated, b: Dated) => new Date(b.date).getTime() - new Date(a.date).getTime() || (b.id ?? 0) - (a.id ?? 0);

/** Sortiert die Historie wie die API (neueste zuerst, bei gleichem Datum höhere ID zuerst). */
export const sortHistory = <T extends Dated>(workouts: Iterable<T>): T[] => [...workouts].sort(byDateDesc);

/**
 * Wendet Änderungen auf den lokalen Cache an: gelöschte IDs entfernen, geänderte/neue Einheiten ersetzen bzw. hinzufügen.
 * Idempotent - dieselben Änderungen zweimal anzuwenden ergibt dasselbe Ergebnis (wichtig wegen der Überlappung im Token).
 */
export function mergeChanges<T extends Dated & { id?: number | null }>(
  history: readonly T[] | null | undefined,
  { workouts = [], deletedIds = [] }: { workouts?: readonly T[]; deletedIds?: readonly number[] },
): T[] {
  const byId = new Map((history ?? []).map((w) => [w.id, w]));
  for (const id of deletedIds) byId.delete(id);
  for (const w of workouts) byId.set(w.id, w);
  return sortHistory(byId.values());
}

export interface FetchedChanges { workouts: Workout[]; deletedIds: number[]; token: string }

/** Holt alle Änderungen seit `since` (oder alles, wenn `since` fehlt) - Seite für Seite. token = `since` für den nächsten Sync. */
export async function fetchChanges(
  api: { get(path: string): Promise<unknown> },
  since: string | null = null,
  { pageSize = 200, maxPages = 100 }: { pageSize?: number; maxPages?: number } = {},
): Promise<FetchedChanges> {
  const workouts: Workout[] = [];
  const deletedIds: number[] = [];
  let cursor: string | null = null;
  let token: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({ limit: String(pageSize) });
    if (since) params.set('since', since);
    if (cursor) params.set('cursor', cursor);
    const res = (await api.get(`/api/workouts/changes?${params}`)) as WorkoutChanges;
    token ??= res.syncToken; // Token der ERSTEN Seite: alles, was danach passiert, holt der nächste Sync
    workouts.push(...res.workouts);
    deletedIds.push(...res.deletedIds);
    cursor = res.nextCursor;
    if (!cursor) return { workouts, deletedIds, token };
  }
  throw new Error('History sync did not finish (too many pages).');
}
