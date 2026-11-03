/* Memory Match — cache-first service worker for full offline play. */

const VERSION = "v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./manifest.json",
  "./faces/faces.json",
  "./fonts/atkinson-700.woff2",
  "./fonts/nunito-800.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon-64.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // Individual puts so one missing file can't fail the whole install.
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));

      // Precache every face listed in the library so day-one offline play
      // shows real art, not the fallback deck. The importer bumps VERSION
      // when faces change, which re-triggers this install.
      try {
        const res = await fetch("./faces/faces.json", { cache: "no-cache" });
        if (res.ok) {
          const data = await res.json();
          const files = (data.faces || []).map((f) => `./faces/${f.file}`);
          await Promise.allSettled(files.map((url) => cache.add(url)));
        }
      } catch {
        // offline install or malformed manifest — shell still works
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) {
    return; // same-origin GET only; cross-origin (fonts) handled by browser cache
  }

  // Navigations: cache-first, fall back to network, then to the shell page.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const cache = await caches.open(VERSION);
          const cached = await cache.match("./index.html");
          if (cached) return cached;
          return await fetch(request);
        } catch {
          return caches.match("./index.html");
        }
      })()
    );
    return;
  }

  // Everything else: stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })()
  );
});