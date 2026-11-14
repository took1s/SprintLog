// Offline-first-Sync für Listen mit Client-Id (Routinen, geplante Einheiten): Änderungen liegen sofort lokal (pending)
// und werden per idempotentem PUT/DELETE nachgereicht. Nie parallel senden: schnelles Abhaken soll nicht doppelt senden.
import { isApiError, type Api } from './api';

export interface ClientSynced {
  clientId: string;
  updatedAt: string;
  /** Nur lokal: noch nicht synchronisiert. */
  pending?: 'put' | 'delete';
}

export interface ClientSyncOptions<T extends ClientSynced> {
  /** z. B. "/api/routines" */
  path: string;
  items(): T[];
  setItems(items: T[]): void;
  persist(): void;
  api(): Api;
  /** Was per PUT gesendet wird (ohne lokale Felder). */
  body(item: T): unknown;
  /** Server lehnt dauerhaft ab (400/409): Eintrag verwerfen und melden. */
  onRejected(item: T, error: unknown): void;
}

export const isNetworkError = (e: unknown): boolean => isApiError(e) && e.isNetwork;

export function createClientSync<T extends ClientSynced>(o: ClientSyncOptions<T>) {
  let running: Promise<void> | null = null;

  async function run(): Promise<void> {
    for (const item of o.items().filter((x) => x.pending)) {
      const sent = item.updatedAt;
      try {
        if (item.pending === 'delete') {
          await o.api().del(`${o.path}/${item.clientId}`);
          o.setItems(o.items().filter((x) => x.clientId !== item.clientId || x.pending !== 'delete'));
        } else {
          await o.api().put(`${o.path}/${item.clientId}`, o.body(item));
          // Inzwischen erneut geändert (z. B. Haken während des Sendens)? Dann bleibt der Eintrag ausstehend
          o.setItems(o.items().map((x) => (x.clientId === item.clientId && x.updatedAt === sent ? { ...x, pending: undefined } : x)));
        }
      } catch (e) {
        if (isNetworkError(e)) break;
        // Dauerhaft abgelehnt: lokal behalten wäre ewiges Wiederholen
        o.setItems(o.items().filter((x) => x.clientId !== item.clientId));
        o.onRejected(item, e);
      }
    }
    o.persist();
  }

  /** Ausstehende Änderungen senden; läuft schon ein Durchgang, wird danach noch einmal geprüft. */
  function push(): Promise<void> {
    if (running) return running.then(() => (o.items().some((x) => x.pending) ? push() : undefined));
    const p = run().finally(() => { if (running === p) running = null; });
    running = p;
    return p;
  }

  /**
   * Laden: lokalen Stand lesen, Ausstehendes senden, dann den Server-Stand übernehmen (ausstehende lokale Einträge gewinnen).
   * @returns false, wenn nur der lokale Stand gilt (offline oder Fehler)
   */
  async function pull(): Promise<boolean> {
    try {
      await push();
      const fresh = await o.api().get<T[]>(o.path);
      const pending = o.items().filter((x) => x.pending);
      o.setItems([...pending, ...fresh.filter((f) => !pending.some((p) => p.clientId === f.clientId))]);
      o.persist();
      return true;
    } catch (e) {
      if (!isNetworkError(e)) console.warn(`[sync ${o.path}]`, e);
      return false;
    }
  }

  return { push, pull };
}

/** Client-Id wie vom Server erwartet: ^[A-Za-z0-9_-]{8,64}$. */
export function newClientId(prefix: string): string {
  const raw = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${raw.replace(/[^A-Za-z0-9]/g, '').slice(0, 24)}`;
}
