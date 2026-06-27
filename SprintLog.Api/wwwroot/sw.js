const CACHE_NAME = 'sprintlog-cache-v1';

// Список файлов, которые нужны для работы без интернета
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/vue.global.js'
];

// Установка: кэшируем базовые файлы
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Активация: удаляем старые версии кэша, если мы обновили приложение
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        ))
    );
    self.clients.claim();
});

// Перехват запросов (Network-First стратегия для статики)
self.addEventListener('fetch', event => {
    const req = event.request;

    // Мы не кэшируем запросы к базе данных (API). 
    // За офлайн-сохранение тренировок у нас уже отвечает Vue и localStorage.
    if (req.url.includes('/api/')) {
        return;
    }

    // Для HTML/CSS/JS пытаемся получить свежую версию из интернета.
    // Если интернета нет (catch) - отдаем из кэша.
    event.respondWith(
        fetch(req).catch(() => caches.match(req))
    );
});