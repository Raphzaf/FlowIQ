// FlowIQ Service Worker — cache-first app shell, network-first for API calls.
// To bust the cache, increment the version string below and redeploy.
const CACHE_NAME = 'flowiq-shell-v1';

// Static assets that make up the app shell.
// Adjust or extend this list if new top-level assets are added.
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
  '/icons/icon-512.svg',
];

// ── Install ──────────────────────────────────────────────────────────────────
// Pre-cache the app shell so it is available immediately on first visit.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  // Activate the new SW as soon as installation finishes (don't wait for
  // existing tabs to close).
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
// Remove caches from previous versions so stale assets don't linger.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  // Take control of all open clients without a page reload.
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept GET requests from the same origin.
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Network-first for API calls — never serve stale data.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        // Offline and no network: return a terse JSON error so the UI can
        // display a friendly message instead of a generic network failure.
        new Response(
          JSON.stringify({ error: 'offline' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );
    return;
  }

  // Cache-first for everything else (static assets / app shell).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request)
        .then((networkResponse) => {
          // Cache successful responses for future offline use.
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback: serve index.html so the SPA router can handle
          // the navigation (e.g. display an offline-aware component).
          if (request.headers.get('Accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
          // For non-HTML assets that are not cached, let the error propagate.
        });
    }),
  );
});
