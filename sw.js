const CACHE = "clay-shell-v6";
const ROOT = new URL("./", self.location).href;
const FILES = [
  "",
  "index.html",
  "styles.css",
  "config.js",
  "js/app.js",
  "js/model.js",
  "js/canvas.js",
  "js/design.js",
  "js/api.js",
  "assets/logo.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "manifest.webmanifest",
];
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.addAll(FILES.map((p) => new Request(ROOT + p, { cache: "reload" }))),
      ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((r) => {
        if (r.ok && FILES.some((p) => ROOT + p === u.href)) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() =>
        caches
          .match(e.request)
          .then(
            (r) =>
              r ||
              (e.request.mode === "navigate"
                ? caches.match(ROOT + "index.html")
                : Response.error()),
          ),
      ),
  );
});
