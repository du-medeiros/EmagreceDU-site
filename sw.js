/* EmagreceDU · service worker
 * - App (HTML, JS, ícones): rede primeiro, cópia local se estiver offline.
 * - Fontes e bibliotecas externas: cópia local primeiro, atualiza em segundo plano.
 * - APIs (Gemini, Open Food Facts): nunca guardadas.
 */
const VERSION = "emagrecedu-v1.11.1";
const SHELL = ["./", "./index.html", "./app.css", "./app.js", "./config.js", "./i18n.js", "./i18n/en.js", "./i18n/es.js", "./support.js", "./drive.js", "./platform.js", "./features.js", "./vendor/jspdf.umd.min.js", "./vendor/qrcode.js", "./vendor/theme.js", "./consulta.html", "./vendor/fonts/bricolage-grotesque-latin-wght-normal.woff2", "./vendor/fonts/dm-sans-latin-400-normal.woff2", "./vendor/fonts/dm-sans-latin-500-normal.woff2", "./vendor/fonts/dm-sans-latin-600-normal.woff2", "./manifest.webmanifest", "./manual.html", "./privacidade.html",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });

const API = /generativelanguage\.googleapis\.com|openfoodfacts\.org/;
const CDN = /fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com/;

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || API.test(req.url) || req.url.startsWith("blob:")) return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
    );
  } else if (CDN.test(req.url)) {
    e.respondWith(
      caches.open(VERSION).then((c) => c.match(req).then((hit) => {
        const net = fetch(req).then((res) => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
  }
});
