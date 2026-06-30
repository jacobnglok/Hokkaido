/* service-worker.js
   PWA cache for Hokkaido Trip Planner
*/

const CACHE_VERSION = "v1.0.0";
const STATIC_CACHE = `trip-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `trip-runtime-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./agenda.html",
  "./budget.html",
  "./flight.html",
  "./styles.css",
  "./common.js",
  "./home.js",
  "./agenda.js",
  "./budget.js",
  "./flight.js",
  "./manifest.json"
  // Add icons/screenshots here if you want to precache them too
  // "./icons/icon-192.png",
  // "./icons/icon-512.png"
];

// Install: precache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Navigation requests: network-first (fresh pages), fallback to cache
// - Same-origin assets: stale-while-revalidate
// - Cross-origin GET: cache-first with runtime cache fallback to network
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // HTML navigation
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || caches.match("./index.html");
        })
    );
    return;
  }

  // Same-origin static files (stale-while-revalidate)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }

  // Cross-origin requests (cache-first)
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
    )
  );
});

// Optional: allow page to trigger immediate SW update
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
