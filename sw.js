// The build script replaces this cache name with a unique value for every deployment.
const CACHE_NAME = 'shinian-app-shell-v1';
const APP_VERSION = "1.0.6";
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
    console.info('[SW激活] 当前版本', APP_VERSION);
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: 'VERSION_UPDATE', version: APP_VERSION });
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'GET_VERSION') {
    console.info('[收到版本查询]', APP_VERSION);
    event.source?.postMessage({ type: 'VERSION_UPDATE', version: APP_VERSION });
    console.info('[已回复版本]', APP_VERSION);
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

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



