// Offline cache. Bump VERSION on every deploy so clients pick up new code.
const VERSION = "sfaw-v2";
const ASSETS = [
  "./", "./index.html", "./strings.js", "./logic.js", "./icon.svg", "./manifest.webmanifest",
  "./js/main.js", "./js/game.js", "./js/ui.js", "./js/art.js", "./js/audio.js",
  "./js/input.js", "./js/save.js", "./js/data.js", "./js/particles.js", "./js/rng.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first so updates land immediately; cache is the offline fallback.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
