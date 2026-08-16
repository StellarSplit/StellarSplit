importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

const { registerRoute, setCatchHandler } = workbox.routing;
const { NetworkFirst, CacheFirst, StaleWhileRevalidate } = workbox.strategies;
const { BackgroundSyncPlugin } = workbox.backgroundSync;
const { ExpirationPlugin } = workbox.expiration;

const CACHE_NAME = 'stellarsplit-v1';
const STATIC_CACHE = `${CACHE_NAME}-static`;
const OFFLINE_URL = '/offline.html';

// Precache the app shell + offline fallback. self.__WB_MANIFEST is only
// populated when this file is processed by a build step (injectManifest);
// the explicit fallback list below covers dev / plain-static serving too.
workbox.precaching.precacheAndRoute([
  ...(self.__WB_MANIFEST || []),
  { url: '/', revision: CACHE_NAME },
  { url: '/index.html', revision: CACHE_NAME },
  { url: '/manifest.json', revision: CACHE_NAME },
  { url: OFFLINE_URL, revision: CACHE_NAME },
]);

// Cache-first for static assets: JS/CSS chunks (including lazy-loaded
// route chunks like analytics/dashboard) and images.
registerRoute(
  ({ request, url }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    /\.(js|css|png|jpe?g|webp|svg|gif)$/.test(url.pathname),
  new CacheFirst({
    cacheName: STATIC_CACHE,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// Network-first for API calls, falling back to cache when offline.
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/splits'),
  new NetworkFirst({
    cacheName: 'splits-cache',
  })
);

// Network-first for navigations, falling back to cached page, then to the
// offline page if nothing cached matches (e.g. first-ever offline visit
// to a lazy-loaded route like /analytics or /dashboard).
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: STATIC_CACHE,
  })
);

// Lets the app's "Update Available" banner (applyServiceWorkerUpdate in
// sw-register.ts) activate a waiting worker immediately instead of waiting
// for all tabs to close.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

setCatchHandler(async ({ event }) => {
  if (event.request.mode === 'navigate') {
    const cached = await caches.match(OFFLINE_URL);
    return cached || Response.error();
  }
  return Response.error();
});

// Background Sync Queue
const bgSyncPlugin = new BackgroundSyncPlugin('paymentsQueue', {
  maxRetentionTime: 24 * 60
});

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/payments'),
  new NetworkFirst({
    plugins: [bgSyncPlugin]
  }),
  'POST'
);

// Push Notification Listener
self.addEventListener('push', (event) => {
  const data = event.data.json();

  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icons/icon-192.png'
  });
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
