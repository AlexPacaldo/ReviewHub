const CACHE_VERSION = "review-hub-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg"
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_VERSION);
  await cache.addAll(APP_SHELL);

  const indexResponse = await fetch("./index.html", { cache: "no-store" });
  const indexHtml = await indexResponse.clone().text();
  await cache.put("./index.html", indexResponse);

  const assetUrls = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((url) => url.includes("/assets/"))
    .map((url) => new URL(url, self.registration.scope).toString());

  await Promise.all(
    assetUrls.map(async (url) => {
      try {
        await cache.add(url);
      } catch {
        // Non-critical assets should not block the app shell from installing.
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        if (response.ok && new URL(request.url).origin === self.location.origin) {
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;

        if (request.mode === "navigate") {
          return caches.match("./index.html");
        }

        return Response.error();
      })
  );
});
