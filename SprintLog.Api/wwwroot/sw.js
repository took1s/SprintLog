// SprintLog Service Worker
// - App-Shell wird beim Installieren vorgeladen -> App startet komplett offline.
// - Navigation: Network-first (max. 3 s), danach Cache.
// - Statische Dateien: Stale-while-revalidate (sofort aus dem Cache, im Hintergrund aktualisieren).
// - /api/* wird nicht angefasst - Offline-Daten verwaltet die App selbst (localStorage + Sync-Queue).
// Bei jeder Änderung an der App VERSION erhöhen, damit alte Caches entfernt werden.

const VERSION = 'v3.3.0';
const CACHE = `sprintlog-${VERSION}`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/app.css',
  '/js/main.js',
  '/js/api.js',
  '/js/storage.js',
  '/js/sync.js',
  '/js/analytics.js',
  '/js/format.js',
  '/js/charts.js',
  '/js/feedback.js',
  '/js/export.js',
  '/js/figure.js',
  '/js/program.js',
  '/vendor/vue.esm-browser.prod.js',
  '/vendor/chart.umd.js',
  '/vendor/inter-latin-wght-normal.woff2',
  '/vendor/inter-latin-ext-wght-normal.woff2',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  // Kein skipWaiting() hier: die App fragt den Nutzer, bevor die neue Version übernommen wird.
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sprintlog-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([fetch(request), timeout(3000)]);
    if (response.ok) cache.put('/index.html', response.clone());
    return response;
  } catch {
    return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
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
