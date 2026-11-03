const CACHE_NAME = "gigaphone-finance-v16-dashboard-note-top";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js?v=20261103-finalize",
  "./manifest.json",
  "./icon-192.png",
  "./assets/account-logos/cash.svg",
  "./assets/account-logos/seabank.svg",
  "./assets/account-logos/bri.svg",
  "./assets/account-logos/mandiri.svg",
  "./assets/account-logos/bca.svg",
  "./assets/account-logos/default.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
