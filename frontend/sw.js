// Chessdirbek Service Worker — enables PWA install (Add to Dock)
// Network-first strategy: always fetch from server, fall back to cache

const CACHE_NAME = 'chessdirbek-v9';

// Precache critical files for offline play
const PRECACHE_FILES = [
  '/vendor/stockfish/stockfish-18-lite-single.js',
  '/vendor/stockfish/stockfish-18-lite-single.wasm'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_FILES).catch(err => {
        // Continue even if precaching fails
        console.warn('Precaching failed for some files:', err);
      });
    })
  );
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Network-first: try server, fall back to cache for offline resilience
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for offline fallback
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
