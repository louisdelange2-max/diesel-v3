const CACHE_NAME = "diesel-v3-cache-v1.9-script-url";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );

    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(clients.map((client) => client.navigate(client.url)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put("./index.html", clone).catch(() => {});
          });
          return response;
        })
        .catch(async () => {
          return (await caches.match("./index.html")) || Response.error();
        })
    );
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);

    const networkFetch = fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          cache.put(event.request, response.clone()).catch(() => {});
        }
        return response;
      })
      .catch(() => null);

    if (cached) {
      networkFetch.catch(() => null);
      return cached;
    }

    const networkResponse = await networkFetch;
    if (networkResponse) return networkResponse;

    return (await caches.match("./index.html")) || Response.error();
  })());
});
