// Offline support. The app's own files always come fresh from the internet when online
// (bypassing the browser's 10-minute cache), and the saved copy is only used offline.
// Fonts and libraries are saved the first time they load. Calls to AI services are never saved.
const CACHE = "iec-v3";
const SHELL = ["./", "index.html", "app.js", "ai.js", "text.js", "pdfqa.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname === "api.anthropic.com" || url.hostname === "claude.ai" || url.hostname.endsWith("languagetool.org")) return;
  const sameOrigin = url.origin === self.location.origin;
  const cacheable = sameOrigin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === "cdn.jsdelivr.net";
  if (!cacheable) return;
  if (sameOrigin) {
    e.respondWith(fetch(e.request, { cache: "no-cache" })
      .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
  } else {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })));
  }
});
