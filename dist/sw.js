/* Service Worker für die Holzbaurechner-App.
   build.js setzt Version und Dateiliste ein und legt die Datei als /sw.js ab.
   Seiten: erst Netz (max. 3 s), sonst gespeicherte Fassung. Dateien unter /assets/: aus dem Speicher. */
const VERSION = '1094ea6e83';
const PRECACHE = [
  "/",
  "/adventskalender-rechner/",
  "/balkonkraftwerk-aufstaenderung-rechner/",
  "/baugenehmigung/",
  "/carport-rechner/",
  "/datenschutz/",
  "/en/",
  "/en/about/",
  "/en/carport-calculator/",
  "/en/contact/",
  "/en/deck-joist-calculator/",
  "/en/decking-calculator/",
  "/en/fence-calculator/",
  "/en/legal-notice/",
  "/en/pallet-bed-calculator/",
  "/en/patio-cover-calculator/",
  "/en/plug-in-solar-guide/",
  "/en/plug-in-solar-planner/",
  "/en/privacy/",
  "/en/raised-bed-calculator/",
  "/en/table-calculator/",
  "/en/wine-crate-calculator/",
  "/gartenzaun-rechner/",
  "/gluehweinhuette-rechner/",
  "/hochbeet-rechner/",
  "/holz-fuer-draussen/",
  "/holz-weihnachtsbaum-rechner/",
  "/holzpreise/",
  "/holzstern-rechner/",
  "/holzterrasse-rechner/",
  "/impressum/",
  "/kontakt/",
  "/krippenstall-rechner/",
  "/palettenbett-rechner/",
  "/terrassenueberdachung-rechner/",
  "/tisch-rechner/",
  "/ueber/",
  "/unterkonstruktion-rechner/",
  "/us/",
  "/us/about/",
  "/us/carport-calculator/",
  "/us/deck-calculator/",
  "/us/deck-joist-span-calculator/",
  "/us/deck-stair-calculator/",
  "/us/fence-calculator/",
  "/us/lumber-prices/",
  "/us/pallet-bed-calculator/",
  "/us/patio-cover-calculator/",
  "/us/pergola-calculator/",
  "/us/raised-bed-calculator/",
  "/us/table-calculator/",
  "/us/wine-crate-calculator/",
  "/weihnachtsprojekte/",
  "/weinkiste-rechner/",
  "/werben/",
  "/manifest.webmanifest",
  "/en/manifest.webmanifest",
  "/us/manifest.webmanifest",
  "/assets/ansicht3d.en.js?v=6c8ed296d2",
  "/assets/ansicht3d.js?v=9d68000450",
  "/assets/ansicht3d.us.js?v=ce76a14ab2",
  "/assets/app.en.js?v=89673920e6",
  "/assets/app.js?v=5bbbf6045d",
  "/assets/baugenehmigung.js?v=0fdd6b17fd",
  "/assets/rechner.en.js?v=1a54f8be69",
  "/assets/rechner.js?v=b236fccf76",
  "/assets/rechner.us.js?v=4e13f40468",
  "/assets/solarcheck.js?v=54f6074990",
  "/assets/style.css?v=7d2d3e736e",
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
  } else if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('/manifest.webmanifest')) {
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
    return (await gespeichert()) || (await cache.match((new URL(req.url).pathname.match(/^\/(en|us)\//) || ['/'])[0])) || Response.error();
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
