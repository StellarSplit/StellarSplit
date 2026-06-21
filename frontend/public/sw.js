/**
 * @type {ServiceWorkerGlobalScope}
 */
const swSelf = self;

const CACHE_NAME = "stellarsplit-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  OFFLINE_URL,
  "/manifest.json",
  "/stellarsplit-logo.png",
];

// ── Installation Phase ──
// Warm cache pools with critical core application shell items
swSelf.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => swSelf.skipWaiting())
  );
});

// ── Activation Phase ──
// Flush legacy or expired transaction cache stores cleanly
swSelf.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => swSelf.clients.claim())
  );
});

// ── Interception & Caching Infrastructure Engine ──
// Employs a hybrid strategy combining Network-First and Cache-First pipelines
swSelf.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Exclude cross-origin pipelines, analytics streams, or runtime wallet calls
  if (request.method !== "GET" || !request.url.startsWith(swSelf.location.origin)) {
    return;
  }

  // Strategy 1: HTML Navigations -> Network-First with /offline.html layout fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.open(CACHE_NAME).then((cache) => {
          return cache.match(request).then((response) => {
            return response || cache.match(OFFLINE_URL);
          });
        });
      })
    );
    return;
  }

  // Strategy 2: Static Distribution Chunks (JS, CSS, Media, JSON) -> Cache-First with runtime caching
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== "basic"
          ) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        });
      })
    );
    return;
  }

  // Strategy 3: Dynamic Data API Queries / Custom Handlers -> Network-First Pipeline
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});

// ── Interactive Lifecycle Messages ──
// Intercept messages issued by frontend triggers to bypass lifecycle waiting blocks
swSelf.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    swSelf.skipWaiting();
  }
});