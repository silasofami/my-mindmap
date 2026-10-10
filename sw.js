// The build script replaces this cache name with a unique value for every deployment.
const CACHE_NAME = 'shinian-app-shell-v1';
const APP_CACHE_PREFIXES = ['shinian-app-shell-', 'mindmap-app-shell-'];
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/supabase-public-config.js',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => APP_CACHE_PREFIXES.some(prefix => key.startsWith(prefix)) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Match pathname only so cache-busting query strings do not affect the bypass.
  if (url.pathname === '/version.json') {
    console.info('[sw] version.json直接透传网络', request.url);
    event.respondWith(fetch(request));
    return;
  }

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  // Prefer current deployed assets while online; use the app shell cache only offline.
  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw new Error(`Offline resource unavailable: ${url.pathname}`);
  }));
});

// test v1.0.7 test polling update



