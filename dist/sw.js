/* Service Worker für die Holzbaurechner-App.
   build.js setzt Version und Dateiliste ein und legt die Datei als /sw.js ab.
   Seiten: erst Netz (max. 3 s), sonst gespeicherte Fassung. Dateien unter /assets/: aus dem Speicher. */
const VERSION = '6d9ca14973';
const PRECACHE = [
  "/",
  "/adventskalender-rechner/",
  "/baugenehmigung/",
  "/carport-rechner/",
  "/datenschutz/",
  "/gartenzaun-rechner/",
  "/gluehweinhuette-rechner/",
  "/hochbeet-rechner/",
  "/holz-weihnachtsbaum-rechner/",
  "/holzpreise/",
  "/holzstern-rechner/",
  "/holzterrasse-rechner/",
  "/impressum/",
  "/krippenstall-rechner/",
  "/palettenbett-rechner/",
  "/terrassenueberdachung-rechner/",
  "/tisch-rechner/",
  "/unterkonstruktion-rechner/",
  "/weihnachtsprojekte/",
  "/manifest.webmanifest",
  "/assets/app.js?v=5bbbf6045d",
  "/assets/baugenehmigung.js?v=0fdd6b17fd",
  "/assets/rechner.js?v=95aee2dfea",
  "/assets/style.css?v=fba0335ddd",
  "/assets/umrechner.js?v=e76a54c311",
  "/assets/fonts/barlow-400.woff2",
  "/assets/fonts/barlow-600.woff2",
  "/assets/fonts/barlow-condensed-600.woff2",
  "/assets/fonts/barlow-condensed-700.woff2",
  "/assets/favicon.svg",
  "/assets/app/icon-192.png",
  "/assets/app/icon-512.png",
  "/assets/app/apple-touch-icon.png"
];
const CACHE = 'hbr-' + VERSION;
const NETZ_TIMEOUT = 3000;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('hbr-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Werbung, Cookie-Banner usw. nicht anfassen

  if (req.mode === 'navigate') {
    event.respondWith(seite(event));
  } else if (url.pathname.startsWith('/assets/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(datei(req));
  }
});

// Seite: frische Fassung aus dem Netz, bei schlechtem oder fehlendem Netz die gespeicherte
async function seite(event) {
  const req = event.request;
  const cache = await caches.open(CACHE);
  const netz = fetch(req).then(res => {
    if (res.ok && res.type === 'basic' && !res.redirected) cache.put(new URL(req.url).pathname, res.clone());
    return res;
  });
  event.waitUntil(netz.catch(() => {}));

  const gespeichert = () => cache.match(req, { ignoreSearch: true });
  const timeout = new Promise(resolve => setTimeout(resolve, NETZ_TIMEOUT));
  try {
    const res = await Promise.race([netz, timeout.then(gespeichert)]);
    if (res) return res;
    return await netz;
  } catch (e) {
    return (await gespeichert()) || (await cache.match('/')) || Response.error();
  }
}

// Datei: aus dem Speicher, sonst Netz (und merken)
async function datei(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') cache.put(req, res.clone());
  return res;
}
