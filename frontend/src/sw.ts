/// <reference lib="webworker" />
// SprintLog Service Worker
// - App-Shell wird beim Installieren vorgeladen -> App startet komplett offline.
// - Navigation: App-Shell sofort aus dem Cache (kein Warten auf den Server - Render Free schläft nach 15 min ein).
//   Neue Versionen kommen über einen neuen sw.js; die App zeigt dann "Neue Version verfügbar".
// - Statische Dateien: Stale-while-revalidate (sofort aus dem Cache, im Hintergrund aktualisieren).
// - /api/* wird nicht angefasst - Offline-Daten verwaltet die App selbst (localStorage + Sync-Queue).
//
// Liste und Version werden beim Build eingesetzt (frontend/build/service-worker.ts):
// __BUILD_VERSION__ = Hash über alle Dateinamen (mit Content-Hash) -> jede Änderung erzeugt einen neuen Cache.

// Modul (export {} am Ende) -> `self` darf hier als ServiceWorkerGlobalScope deklariert werden.
declare const self: ServiceWorkerGlobalScope;
declare const __PRECACHE_MANIFEST__: string[];
declare const __BUILD_VERSION__: string;

const CACHE = `sprintlog-${__BUILD_VERSION__}`;
const APP_SHELL: string[] = __PRECACHE_MANIFEST__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  // Kein skipWaiting() hier: die App fragt den Nutzer, bevor die neue Version übernommen wird.
});

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sprintlog-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/**
 * App-Shell zuerst: index.html dieser Version kommt aus dem Precache, damit Shell und gehashte Assets immer
 * zusammenpassen. Netzwerk nur, wenn (noch) nichts im Cache liegt - z. B. beim allerersten Aufruf.
 */
async function appShell(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  const cached = (await cache.match('/')) || (await cache.match('/index.html'));
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch {
    return Response.error();
  }
}

async function staleWhileRevalidate(request: Request, event: FetchEvent): Promise<Response> {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(update);
    return cached;
  }
  return (await update) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/swagger') || url.pathname === '/health') return;

  if (request.mode === 'navigate') {
    event.respondWith(appShell(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, event));
});

export {};
