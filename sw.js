// ============================================================
// ROYAL RANGERS BAYELSA — Service Worker
// Enables offline access & "installable" PWA behavior
// ============================================================

const CACHE_VERSION = "rr-bayelsa-v2"; // bump this number whenever you redeploy major changes
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/login.html",
  "/register.html",
  "/dashboard.html",
  "/profile.html",
  "/excos.html",
  "/activities.html",
  "/manuals.html",
  "/courses.html",
  "/verify.html",
  "/offline.html",
  "/manifest.json",
  "/assets/css/main.css",
  "/assets/js/firebase-config.js",
  "/assets/js/auth.js",
  "/assets/images/icon-192.png",
  "/assets/images/icon-512.png"
];

// ── Install: pre-cache core pages/assets ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn("Skip caching:", url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// ── Activate: clear old caches from previous versions ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ──
// - Firebase/Firestore/API calls: always go to network (never cache live data)
// - Static assets (HTML/CSS/JS/images): cache-first, falling back to network
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept Firebase, Google APIs, or Paystack — these must always be live
  if (
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebasestorage.googleapis.com") ||
    url.hostname.includes("paystack.co") ||
    url.hostname.includes("gstatic.com") ||
    event.request.method !== "GET"
  ) {
    return; // let the browser handle it normally
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Cache successful same-origin responses for next time
          if (response.ok && url.origin === location.origin) {
            const responseClone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback — show branded offline page for navigations,
          // otherwise just fail silently for background/asset requests
          if (event.request.mode === "navigate") {
            return caches.match("/offline.html");
          }
        });
    })
  );
});
