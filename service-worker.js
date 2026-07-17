/* ===== Service Worker — offline app shell ===== */
const CACHE = 'ccx-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//  - Currency APIs: network only (never cache stale rates; app.js handles offline via localStorage)
//  - App shell + fonts: cache-first, fall back to network and cache it
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isRateApi =
    url.hostname.includes('frankfurter') ||
    url.hostname.includes('er-api') ||
    (url.hostname.includes('jsdelivr') && url.pathname.includes('currency-api'));

  if (isRateApi) {
    event.respondWith(fetch(req).catch(() => new Response('{}', {
      status: 503, headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // cache same-origin assets and Google Fonts for offline
        const okToCache =
          res.ok && (url.origin === self.location.origin ||
                     url.hostname.includes('fonts.g'));
        if (okToCache) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
