// Delta-Sync der Historie: einmal alles laden, danach nur Änderungen (neu, bearbeitet, gelöscht).
// Reine Funktionen + ein Lader, der eine api-Instanz bekommt -> unit-getestet (frontend/tests/history.test.js).

const byDateDesc = (a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id;

/** Sortiert die Historie wie die API (neueste zuerst, bei gleichem Datum höhere ID zuerst). */
export const sortHistory = (workouts) => [...workouts].sort(byDateDesc);

/**
 * Wendet Änderungen auf den lokalen Cache an: gelöschte IDs entfernen, geänderte/neue Einheiten ersetzen bzw. hinzufügen.
 * Idempotent - dieselben Änderungen zweimal anzuwenden ergibt dasselbe Ergebnis (wichtig wegen der Überlappung im Token).
 */
export function mergeChanges(history, { workouts = [], deletedIds = [] }) {
  const byId = new Map((history ?? []).map((w) => [w.id, w]));
  for (const id of deletedIds) byId.delete(id);
  for (const w of workouts) byId.set(w.id, w);
  return sortHistory(byId.values());
}

/**
 * Holt alle Änderungen seit `since` (oder alles, wenn `since` fehlt) - Seite für Seite.
 * @returns {Promise<{ workouts: object[], deletedIds: number[], token: string }>} token = `since` für den nächsten Sync
 */
export async function fetchChanges(api, since = null, { pageSize = 200, maxPages = 100 } = {}) {
  const workouts = [];
  const deletedIds = [];
  let cursor = null;
  let token = null;
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({ limit: String(pageSize) });
    if (since) params.set('since', since);
    if (cursor) params.set('cursor', cursor);
    const res = await api.get(`/api/workouts/changes?${params}`);
    token ??= res.syncToken; // Token der ERSTEN Seite: alles, was danach passiert, holt der nächste Sync
    workouts.push(...res.workouts);
    deletedIds.push(...res.deletedIds);
    cursor = res.nextCursor;
    if (!cursor) return { workouts, deletedIds, token };
  }
  throw new Error('History sync did not finish (too many pages).');
}
