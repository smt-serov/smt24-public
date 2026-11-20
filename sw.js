const CACHE_NAME = 'smt-schedule-v2';

const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Кэшируем основные ресурсы без падения, если какого-то файла нет
      await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Precache item failed:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Игнорируем внешние запросы к VK API и статистике
  if (!url.protocol.startsWith('http')) return;
  if (url.hostname.includes('vk.com') || url.hostname.includes('vk.ru') || url.hostname.includes('mail.ru')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Сначала пробуем получить свежую версию из сети
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200) {
          // Кэшируем полученный ответ (js, css, картинки, html)
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        // 2. Если сеть недоступна (офлайн) — берем из кэша
        const cached = await cache.match(event.request);
        if (cached) {
          return cached;
        }

        // 3. Для навигации отдаём кэшированный index.html
        if (event.request.mode === 'navigate') {
          const fallback = await cache.match('./index.html') || await cache.match('index.html');
          if (fallback) {
            return fallback;
          }
        }

        throw err;
      }
    })
  );
});
