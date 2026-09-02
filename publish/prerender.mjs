#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Task #84 — pre-render every view to a real, indexable HTML file.
//
// The site is one client-rendered file. A crawler strips everything after '#',
// so hash routes could never be separate resources: the whole site was ONE URL
// and one <title>. This walks each canonical path in a headless browser, waits
// for the board to settle, and writes the rendered DOM to <route>/index.html
// with that view's own title / description / canonical / OG tags. The same
// inline script then boots the app over the static markup for real visitors.
//
//   node publish/prerender.mjs              # → prerendered/ + sitemap.xml
//   node publish/prerender.mjs --keep       # leave the temp server running
//
// Needs `npm i puppeteer`. Run AFTER export-graffold.mjs so Work/journal content
// is current — the crawler snapshots whatever content/*.json holds at run time.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import puppeteer from 'puppeteer';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const OUT = join(REPO, 'prerendered');
const ORIGIN = 'https://www.dorandesign.studio';
const PORT = 8412;

// Per-route <head>. Description is what shows in a search result, so each one names
// the format a buyer actually searches for rather than repeating the studio tagline.
const ROUTES = [
  { path: '/',                  title: 'Doran Design Studio — Product Communication for Manufacturers',
    desc: 'Spec sheets, manuals, labels and product pages for manufacturers. One versioned content graph → every format and language you ship in, for people and AI.' },
  { path: '/about/',            title: 'About — Doran Design Studio',
    desc: 'The documents and artwork your products ship with: user guides, tech specs, labels, packaging, instructional content and industrial design for manufacturers.' },
  { path: '/pricing/',          title: 'Pricing — Doran Design Studio',
    desc: 'Fixed per-format pricing for product documentation: user manuals, quick-start guides, tech specs, technical illustration, 3D renders and packaging. Quoted before work starts.' },
  { path: '/pdf-to-web/',       title: 'PDF to Web — Doran Design Studio',
    desc: 'Turn a legacy PDF archive into structured, searchable, AI-answerable web content — without losing the engineering accuracy of the originals.' },
  { path: '/product-graph/',    title: 'The Product Graph — how we structure product documentation — Doran Design Studio',
    desc: 'Audit, structure, render, maintain. How we model a manufacturer’s whole product system so every document generates from one source of facts.' },
  { path: '/user-guides-and-manuals/', title: 'User Guides and Manuals for Manufacturers — Doran Design Studio',
    desc: 'We write user guides, user manuals, quick-start guides and installation instructions for manufacturers — to IEC/IEEE 82079-1, ISO 7010 and ANSI Z535. Four pages to a hundred, localized including Arabic.' },
  { path: '/journal/',          title: 'Journal — Doran Design Studio',
    desc: 'Notes on product documentation, structured content and the systems behind them — written by the studio that builds them.' },
  { path: '/work/',             title: 'Work — Client deliverables, versioned — Doran Design Studio',
    desc: 'User guides, setup guides, technical illustration, 3D renders and wiring diagrams built for manufacturers — every asset versioned in Graffold.' },
  { path: '/icons/',            title: 'Icon generator — Doran Design Studio',
    desc: 'A soft-body icon generator, dependency-free. The same word always makes the same icon, so any product or document can carry a unique mark with no asset to manage.',
    image: '/share-card-icons.png',
    imageAlt: 'Four soft-body shapes in red, yellow, green and blue on the studio’s dot grid — one generated icon.' },
  { path: '/contact/',          title: 'Contact — Doran Design Studio',
    desc: 'Tell us about your product documentation. NDA-ready — your source files, specs and previews stay yours.' },
];

// Journal entries come from the manifest, so a new article is picked up automatically.
try {
  const mf = JSON.parse(readFileSync(join(REPO, 'content/manifest.json'), 'utf8'));
  for (const e of (mf.entries || [])) {
    if (!e.file || e.external || e.status === 'draft') continue;   // external essays live on someone else's domain
    ROUTES.push({ path: `/journal/${e.slug}/`,
      title: `${e.title} — Doran Design Studio`,
      desc: (e.dek || '').slice(0, 300) });
  }
} catch { console.warn('! no content/manifest.json — journal entries skipped'); }

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Rewrite the shared <head> to this route's own metadata.
function retag(html, r) {
  const img = ORIGIN + (r.image || '/share-card.png');
  const set = (re, val) => { html = html.replace(re, val); };
  set(/<title>[\s\S]*?<\/title>/, `<title>${esc(r.title)}</title>`);
  set(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(r.desc)}">`);
  set(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${ORIGIN}${r.path}">`);
  set(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(r.title)}">`);
  set(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(r.desc)}">`);
  set(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${ORIGIN}${r.path}">`);
  set(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${img}">`);
  set(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(r.title)}">`);
  set(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(r.desc)}">`);
  set(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${img}">`);
  if (r.imageAlt) {
    set(/<meta property="og:image:alt" content="[^"]*">/, `<meta property="og:image:alt" content="${esc(r.imageAlt)}">`);
    set(/<meta name="twitter:image:alt" content="[^"]*">/, `<meta name="twitter:image:alt" content="${esc(r.imageAlt)}">`);
  }
  return html;
}

// Static server over the repo, so the crawler sees exactly what nginx will serve.
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.json':'application/json',
  '.md':'text/markdown', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2', '.xml':'application/xml' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let f = join(REPO, p === '/' ? 'grid-system.html' : p);
  if (!existsSync(f) || f.endsWith('/')) f = join(REPO, 'grid-system.html');   // SPA fallback, same as nginx
  try {
    const ext = '.' + f.split('.').pop();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(readFileSync(f));
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(PORT, r));

rmSync(OUT, { recursive: true, force: true });
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

const done = [];
for (const r of ROUTES) {
  await page.goto(`http://localhost:${PORT}${r.path}`, { waitUntil: 'networkidle0', timeout: 45000 });
  // Settle properly rather than guessing a delay: Work and the journal hydrate from content/*.json
  // AFTER first paint (the Graffold snapshot is lazy — it is only fetched when a Graffold surface opens),
  // so a fixed wait snapshotted an empty board. Poll until both the card count and the rendered text
  // stop changing for three consecutive ticks.
  await page.waitForFunction(() => {
    const sig = document.querySelectorAll('#grid .block').length + ':' + (document.body.innerText || '').length;
    window.__s = (window.__sig === sig) ? (window.__s || 0) + 1 : 0;
    window.__sig = sig;
    return window.__s >= 3;
  }, { timeout: 30000, polling: 300 }).catch(() => console.warn(`  ! ${r.path} did not settle — snapshotting anyway`));
  const stats = await page.evaluate(() => ({
    blocks: document.querySelectorAll('#grid .block').length,
    h1: (document.querySelector('h1') || {}).textContent || '',
    text: (document.body.innerText || '').replace(/\s+/g, ' ').trim().length,
  }));
  // Strip the mounted Lottie/graph SVG before capture. It is decorative, carries no text a crawler
  // can use, and baking it into the markup took the home page from ~490KB to 1.8MB. The app re-mounts
  // it on load, so a real visitor sees no difference.
  await page.evaluate(() => {
    document.querySelectorAll('#grid .lottie svg, #grid .complottie svg, #grid .lottie canvas, #grid .complottie canvas')
      .forEach(el => el.remove());
  });
  let html = await page.content();
  html = retag(html, r);
  const dir = join(OUT, r.path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  done.push({ ...r, ...stats, bytes: Buffer.byteLength(html) });
  console.log(`  ${r.path.padEnd(28)} ${String(stats.blocks).padStart(3)} cards · ${String(stats.text).padStart(5)} chars · ${(Buffer.byteLength(html)/1024).toFixed(0)}KB`);
}
await browser.close();
server.close();

// A sitemap that finally lists more than the front door.
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(REPO, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  done.map(r => `  <url>\n    <loc>${ORIGIN}${r.path}</loc>\n    <lastmod>${today}</lastmod>\n` +
                `    <priority>${r.path === '/' ? '1.0' : r.path.startsWith('/journal/') && r.path !== '/journal/' ? '0.6' : '0.8'}</priority>\n  </url>`).join('\n') +
  `\n</urlset>\n`);

console.log(`\n✓ ${done.length} page(s) → prerendered/`);
console.log(`✓ sitemap.xml — ${done.length} URLs (was 1)`);
const thin = done.filter(d => d.text < 400);
if (thin.length) console.log(`! thin content on: ${thin.map(d => d.path).join(', ')}`);
