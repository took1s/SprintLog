/// <reference lib="webworker" />
// SprintLog Service Worker
// - App-Shell wird beim Installieren vorgeladen -> App startet komplett offline.
// - Navigation: Network-first (max. 3 s), danach Cache.
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

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function networkFirst(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([fetch(request), timeout(3000)]);
    if (response.ok) void cache.put('/index.html', response.clone());
    return response;
  } catch {
    return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
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
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, event));
});

export {};
