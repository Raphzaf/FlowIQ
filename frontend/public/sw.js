const CACHE_NAME = "flowiq-v1";
const PRECACHE_URLS = ["/", "/static/js/main.chunk.js", "/static/css/main.chunk.css"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => null),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const SENSITIVE_KEYS = ["credential", "credentials", "password", "secret", "token", "bank"];

const isApiRequest = (url) => url.pathname.startsWith("/api/");

const hasSensitiveBody = async (response) => {
  try {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return false;
    }
    const body = await response.clone().text();
    const lowerBody = body.toLowerCase();
    return SENSITIVE_KEYS.some((key) => lowerBody.includes(key));
  } catch {
    return true;
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const isSensitive = await hasSensitiveBody(networkResponse);
            if (!isSensitive) {
              await cache.put(request, networkResponse.clone());
            }
          }
          return networkResponse;
        } catch {
          const cached = await cache.match(request);
          if (cached) {
            return cached;
          }
          return Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
          }
          return networkResponse;
        })
        .catch(() => caches.match("/"));
    }),
  );
});