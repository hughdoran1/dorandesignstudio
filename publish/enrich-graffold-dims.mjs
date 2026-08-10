#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Enrich content/graffold-snapshot.json with each preview's pixel dimensions (pw/ph),
// so the Gallery can size every asset to its REAL aspect on the half-cell grid instead
// of forcing squares. Reads only the image HEADER over HTTP (a tiny range request) — no
// Neo4j, no full download. Idempotent: re-run any time; already-measured assets are skipped
// unless --force. The dims live in the committed snapshot, so the site needs no runtime probing.
//
//   node publish/enrich-graffold-dims.mjs            # measure any asset missing pw/ph
//   node publish/enrich-graffold-dims.mjs --force    # re-measure everything
//   node publish/enrich-graffold-dims.mjs --dry-run  # report, write nothing
//
// Handles PNG / JPEG / GIF / WebP headers (all current previews are PNG). An asset whose
// header can't be read keeps no dims — the site falls back to a per-type default aspect.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SNAP = join(REPO, 'content', 'graffold-snapshot.json');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const FORCE = argv.includes('--force');
const CONCURRENCY = 8;

// cdnBase: previews may be rewritten to a CDN in the snapshot; both forms are fetchable.
let cdnBase = '';
try { cdnBase = (JSON.parse(readFileSync(join(HERE, 'publish.config.json'), 'utf8')).cdnBase) || ''; } catch {}
const resolveUrl = u => u;   // snapshot already carries absolute preview URLs

// ── Header parsers → [w, h] or null ──────────────────────────────────────────
function pngSize(b) {
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50) return null;   // ‰PNG
  return [b.readUInt32BE(16), b.readUInt32BE(20)];                    // IHDR width, height
}
function gifSize(b) {
  if (b.length < 10 || b[0] !== 0x47 || b[1] !== 0x49) return null;   // GIF
  return [b.readUInt16LE(6), b.readUInt16LE(8)];
}
function webpSize(b) {
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fmt = b.toString('ascii', 12, 16);
  if (fmt === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (fmt === 'VP8L') { const n = b.readUInt32LE(21); return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1]; }
  if (fmt === 'VP8X') return [1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16))];
  return null;
}
function jpegSize(b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;    // SOI
  let p = 2;
  while (p + 9 < b.length) {
    if (b[p] !== 0xff) { p++; continue; }
    const marker = b[p + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [b.readUInt16BE(p + 7), b.readUInt16BE(p + 5)];
    p += 2 + b.readUInt16BE(p + 2);
  }
  return null;
}
const parseSize = b => pngSize(b) || jpegSize(b) || gifSize(b) || webpSize(b);

async function measure(url) {
  const headers = { Range: 'bytes=0-65535' };
  let res;
  try { res = await fetch(url, { headers }); }
  catch (e) { return { err: e.message }; }
  if (!res.ok && res.status !== 206) return { err: 'HTTP ' + res.status };
  const buf = Buffer.from(await res.arrayBuffer());
  const wh = parseSize(buf);
  return wh ? { w: wh[0], h: wh[1] } : { err: 'unrecognised header (' + buf.length + 'B)' };
}

// ── Walk the snapshot; collect every distinct preview URL that needs a size ───
const snap = JSON.parse(readFileSync(SNAP, 'utf8'));
const assets = snap.assets || [];
const todo = assets.filter(a => a && a.preview && (FORCE || !(a.pw > 0 && a.ph > 0)));
console.log(`${assets.length} assets · ${todo.length} to measure${FORCE ? ' (force)' : ''}`);

let ok = 0, fail = 0, done = 0;
async function worker(queue) {
  for (;;) {
    const a = queue.shift(); if (!a) return;
    const r = await measure(resolveUrl(a.preview));
    done++;
    if (r.w) { a.pw = r.w; a.ph = r.h; ok++; }
    else { fail++; if (fail <= 8) console.warn(`  ✗ ${a.fileName}: ${r.err}`); }
    if (done % 20 === 0) console.log(`  … ${done}/${todo.length}`);
  }
}
const queue = todo.slice();
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker(queue)));

// Aspect histogram so the sizing algo can be sanity-checked against real data.
const withDims = assets.filter(a => a.pw > 0 && a.ph > 0);
const bucket = { 'portrait(<0.8)': 0, 'squarish(0.8–1.25)': 0, 'landscape(>1.25)': 0 };
withDims.forEach(a => { const r = a.pw / a.ph; bucket[r < 0.8 ? 'portrait(<0.8)' : r > 1.25 ? 'landscape(>1.25)' : 'squarish(0.8–1.25)']++; });
console.log(`✓ measured ${ok} · failed ${fail} · total with dims ${withDims.length}`);
console.log('  aspect spread:', JSON.stringify(bucket));

if (DRY) { console.log('(dry-run — nothing written)'); }
else { writeFileSync(SNAP, JSON.stringify(snap, null, 2) + '\n'); console.log(`✓ wrote ${SNAP}`); }
