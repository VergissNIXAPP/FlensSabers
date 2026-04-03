const CACHE_NAME = "flenssabers-trainer-pwa-v2";
const PRECACHE_URLS = [
  "./trainer.html",
  "./trainer.js",
  "./styles.css",
  "./remote-config.js",
  "./live-data.js",
  "./trainer.webmanifest",
  "./icons/trainer-favicon-64.png",
  "./icons/trainer-app-180.png",
  "./icons/trainer-app-192.png",
  "./icons/trainer-app-512.png",
  "./icons/trainer-app-maskable-192.png",
  "./icons/trainer-app-maskable-512.png",
  "./images/logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put("./trainer.html", fresh.clone());
        return fresh;
      } catch (error) {
        return (await caches.match(request)) || (await caches.match("./trainer.html"));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch (error) {
      return caches.match("./trainer.html");
    }
  })());
});
