// Service Worker: App-Gerüst und Logo offline (Cache zuerst), Daten frisch (Netz zuerst, Cache als Rückfall)
const VERSION = "dash-1f0349f8b6";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/theme-init.js", "js/main.js", "js/config.js", "js/supa.js", "js/cal.js", "js/util.js", "js/store.js", "js/data.js", "js/bwl.js", "js/todos.js", "js/ui.js", "js/charts.js",
  "js/views/shared.js", "js/views/heute.js", "js/views/studium.js", "js/views/capo.js", "js/views/kalender.js", "js/views/mails.js",
  "assets/capo-logo.png", "assets/capo-mask@2x.png",
  "assets/fonts/Switzer-Light.woff2", "assets/fonts/Switzer-Regular.woff2", "assets/fonts/Switzer-Medium.woff2",
  "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/favicon.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Fremde Server (Supabase, Wetter) nicht anfassen: den letzten Stand hält die App selbst
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Eigene Daten (bwl.json): Netz zuerst, Cache als Rückfall
  if (url.pathname.includes("/data/")) {
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(url.pathname, copy)); }
      return r;
    }).catch(() => caches.match(url.pathname)));
    return;
  }
  // App-Gerüst: Cache zuerst, im Hintergrund erneuern
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
