// Baut die statische Website nach /dist. Aufruf: node build.js  (keine Abhängigkeiten nötig)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const cfg = JSON.parse(fs.readFileSync('site.config.json', 'utf8'));
const prices = JSON.parse(fs.readFileSync('src/data/holzpreise.json', 'utf8'));
const layout = fs.readFileSync('src/layout.html', 'utf8');
const bauo = JSON.parse(fs.readFileSync('src/data/bauordnungen.json', 'utf8'));
const OUT = 'dist';
const site = cfg.siteUrl.replace(/\/$/, '');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync('src/assets', path.join(OUT, 'assets'), { recursive: true });
if (fs.existsSync('src/_redirects')) fs.copyFileSync('src/_redirects', path.join(OUT, '_redirects'));
fs.copyFileSync('src/manifest.webmanifest', path.join(OUT, 'manifest.webmanifest'));

// CSS/JS mit ?v=<hash> einbinden, damit Browser und App nach einem Update sicher die neue Fassung laden
const hash = buf => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
const versioned = {};
for (const f of fs.readdirSync('src/assets').filter(f => /\.(css|js)$/.test(f)))
  versioned[`/assets/${f}`] = `/assets/${f}?v=${hash(fs.readFileSync(path.join('src/assets', f)))}`;
const withVersions = html => Object.entries(versioned).reduce((s, [a, b]) => s.split(`"${a}"`).join(`"${b}"`), html);

const fill = (tpl, vars) => Object.entries(vars).reduce((s, [k, v]) => s.split(`{{${k}}}`).join(v), tpl);
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const strip = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const priceTable = `<div class="pricebox"><table>
<thead><tr><th>Holzart</th><th>Typischer Einsatz</th><th class="num">Preis pro m³</th></tr></thead>
<tbody>${Object.values(prices.hoelzer).map(h =>
  `<tr><td class="name">${h.label}</td><td>${h.einsatz}</td><td class="num">${h.preis.toLocaleString('de-DE')} €</td></tr>`).join('')}</tbody>
</table></div>`;

// Liste der Bauordnungen (vollständig im HTML, damit Google alles lesen kann; JS filtert nur)
const bauoHtml = Object.entries(bauo.laender).map(([code, land]) =>
  `<section class="bo-land" data-land="${code}" aria-label="${land.label}">
  <h2>${land.label}</h2>
  <p class="bo-intro">${land.begriffe}</p>
  <p class="bo-intro">${land.behoerde}</p>
  ${land.eintraege.map(e => `<article class="bo-card" id="${e.id}" data-land="${code}">
    <h3>${e.name}</h3>
    <p class="bo-gesetz">${e.gesetz} <span>(${e.kurz})</span></p>
    <dl class="bo-par">${e.paragraphen.map(([nr, t]) => `<dt>${nr}</dt><dd>${t}</dd>`).join('')}</dl>
    ${e.hinweis ? `<p class="bo-hinweis">${e.hinweis}</p>` : ''}
    <p class="bo-links"><a class="btn ghost" href="${e.link}" target="_blank" rel="noopener">Gesetzestext öffnen</a>${e.extra ? ` <a href="${e.extra[1]}" target="_blank" rel="noopener">${e.extra[0]}</a>` : ''}</p>
  </article>`).join('\n  ')}
</section>`).join('\n');

const urls = [];
const pagePaths = [];
for (const file of fs.readdirSync('src/pages').filter(f => f.endsWith('.html'))) {
  const raw = fs.readFileSync(path.join('src/pages', file), 'utf8');
  const m = raw.match(/^<!--meta([\s\S]*?)-->/);
  if (!m) throw new Error(`Meta-Block fehlt in ${file}`);
  const meta = JSON.parse(m[1]);
  let content = raw.slice(m[0].length);
  content = fill(content, { BAUORDNUNGEN: bauoHtml, BAUO_STAND: bauo.stand, HOLZPREIS_TABELLE: priceTable, PREIS_STAND: prices.stand, PREIS_HINWEIS: prices.hinweis });

  const url = `${site}/${meta.slug ? meta.slug + '/' : ''}`;
  const ld = [];
  if (!meta.slug) ld.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.siteName, url });
  if (meta.rechner) ld.push({ '@context': 'https://schema.org', '@type': 'WebApplication', name: meta.h1 || meta.title,
    url, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Alle', offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } });
  const faqs = [...content.matchAll(/<details class="faq"><summary>([\s\S]*?)<\/summary><div>([\s\S]*?)<\/div><\/details>/g)];
  if (faqs.length) ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({ '@type': 'Question', name: strip(f[1]), acceptedAnswer: { '@type': 'Answer', text: strip(f[2]) } })) });

  const html = fill(layout, {
    robots: meta.noindex ? '<meta name="robots" content="noindex">' : '',
    title: esc(meta.title), description: esc(meta.description), canonical: url,
    jsonld: ld.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n'),
    siteName: cfg.siteName, year: String(new Date().getFullYear()),
    prices_json: JSON.stringify(prices), content
  });
  pagePaths.push(`/${meta.slug ? meta.slug + '/' : ''}`);
  const dir = path.join(OUT, meta.slug || '');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), withVersions(html));
  if (!meta.noindex) urls.push(url);
  console.log('✓', meta.slug || '(start)');
}

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
// Service Worker für die App: alle Seiten und Dateien, die zum Rechnen ohne Netz nötig sind
const precache = [
  ...pagePaths.sort(),
  '/manifest.webmanifest',
  ...Object.values(versioned),
  ...fs.readdirSync('src/assets/fonts').map(f => `/assets/fonts/${f}`),
  '/assets/favicon.svg', '/assets/app/icon-192.png', '/assets/app/icon-512.png', '/assets/app/apple-touch-icon.png'
];
const fileOf = u => path.join(OUT, u.split('?')[0], u.endsWith('/') ? 'index.html' : '');
const swVersion = hash(precache.map(u => u + fs.readFileSync(fileOf(u)).toString('base64')).join(''));
fs.writeFileSync(path.join(OUT, 'sw.js'), fs.readFileSync('src/sw.js', 'utf8')
  .replace('__VERSION__', swVersion).replace('__PRECACHE__', JSON.stringify(precache, null, 2)));
console.log(`✓ App: sw.js (Version ${swVersion}, ${precache.length} Dateien offline)`);
console.log(`Fertig: ${urls.length} Seiten in /${OUT}`);
