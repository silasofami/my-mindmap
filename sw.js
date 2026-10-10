// v1.0.5 test after fix later bug

const APP_VERSION = '1.0.2';
const CACHE_VERSION = 'mindmap-v1.0.2';
const CACHE_NAME = `shinian-app-shell-${CACHE_VERSION}`;
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
    const existingCaches = await caches.keys();
    const isFirstInstall = !existingCaches.some(key => APP_CACHE_PREFIXES.some(prefix => key.startsWith(prefix)));
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // First install should control the app immediately. Updates wait until the user accepts.
    if (isFirstInstall) await self.skipWaiting();
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

self.addEventListener('message', event => {
  const message = event.data || {};
  if (message.type === 'GET_APP_VERSION') {
    event.ports?.[0]?.postMessage({ appVersion: APP_VERSION, cacheVersion: CACHE_VERSION });
  } else if (message.type === 'ACTIVATE_UPDATE') {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Never intercept Supabase APIs, CDN libraries, or other cross-origin traffic.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  event.respondWith(caches.match(request, { ignoreSearch: true }).then(cached => cached || fetch(request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});
