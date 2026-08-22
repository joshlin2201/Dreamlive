// DreamLIVE offline shell. Imported audio remains in IndexedDB and is never
// copied into the application cache.
const CACHE_NAME = 'dreamlive-shell-v5';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/asset-manifest.json',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/Dreamlive.png',
  '/fonts/poppins-local.css',
  '/fonts/poppins-400-latin.woff2',
  '/fonts/poppins-500-latin.woff2',
  '/fonts/poppins-600-latin.woff2',
  '/fonts/poppins-700-latin.woff2',
  '/fonts/poppins-900-latin.woff2',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(CORE_ASSETS);
      const manifest = await fetch('/asset-manifest.json').then(response => response.json());
      await cache.addAll(manifest.entrypoints.map(path => `/${path.replace(/^\.\//, '')}`));
    })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names
        .filter(name => name !== CACHE_NAME)
        .map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
