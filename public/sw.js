// Minimal pass-through service worker - exists purely to satisfy Chrome's
// installability requirement, NOT to enable real offline caching.
//
// This app is entirely server-rendered, auth-gated, and data-driven. Caching
// pages or API responses could show stale attendance/schedule data to a coach,
// which is worse than no offline support. So this worker:
//   - intercepts navigation requests and always goes to the network,
//   - never caches anything itself,
//   - lets everything else (images, static assets) pass straight through.
const CACHE_NAME = "touchline-shell-v1";
const APP_SHELL = ["/"];

self.addEventListener("install", (event) => {
  // Skip waiting so the new worker activates immediately rather than waiting
  // for all existing tabs to close.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Same-origin navigation requests only. We return a network-first strategy:
  // try the server; on failure fall back to the cached shell so a coach on a
  // flaky connection isn't shown a blank page. Nothing else is cached.
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the HTML shell in the background so a later offline
          // navigation has something to show. The shell re-renders server-side
          // on every real load, so this cache is only ever a fallback.
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Everything else: straight passthrough, never intercepted, never cached.
  return;
});
