// ─────────────────────────────────────────────────────────────────────────────
// build-explore.mjs — generates the DDS "Explore" sample dataset.
// Invented exemplar products, each a full suite of connected, versioned assets,
// every preview rendered as a DDS-styled SVG (the design system rendering the work).
// Pure Node (no deps). Emits content/explore/assets/*.svg + content/explore-snapshot.json.
//   node publish/build-explore.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const ASSETS = join(REPO, 'content', 'explore', 'assets');

// ── palette ──────────────────────────────────────────────────────────────────
const INK = '#1F2937', INK2 = '#4B5563', MUTE = '#8A94A3', HAIR = '#E4E6EA', HAIR2 = '#EDEEF1';
const PAPER = '#FCFBF8', PAPER2 = '#F4F2EC', WHITE = '#FFFFFF';
const DOT = 'rgba(31,41,55,0.07)';

// ── products ─────────────────────────────────────────────────────────────────
// accent = mid; d/l = shaded faces; tint = wash; each has a form archetype + iconography.
const PRODUCTS = [
  {
    key: 'meridian', name: 'Meridian', code: 'MRD',
    category: 'Sub-surface irrigation control', sector: 'Water management',
    accent: '#0E93A8', deep: '#0A6E7E', lite: '#6FC9D6', tint: '#E4F3F5',
    unit: 'MRD-8', tagline: 'One controller. Every zone. Every language.',
    form: 'controller',   // wall-mount box + face panel
    icons: ['drop', 'valve', 'gauge', 'wifi', 'clock', 'leaf', 'bolt', 'shield', 'sun'],
    specs: [['Zones', '8 / 16 / 32'], ['Flow range', '0.1 – 40 gpm'], ['Ingress', 'IP68 valve · IP54 box'], ['Comms', 'LoRa · Wi-Fi · BLE'], ['Supply', '24 VAC / 9 VDC'], ['Temp', '−20 – 60 °C']],
    dims: '182 × 240 × 61 mm',
  },
  {
    key: 'lumen', name: 'Lumen', code: 'LMN',
    category: 'Architectural lighting system', sector: 'Built environment',
    accent: '#E0A020', deep: '#B27A0B', lite: '#F1CE7C', tint: '#FBF1DA',
    unit: 'LMN-T3', tagline: 'A family of light, one track.',
    form: 'spotlight',    // track head + cone
    icons: ['bulb', 'cone', 'track', 'dial', 'kelvin', 'lens', 'bolt', 'grid', 'sun'],
    specs: [['Output', '900 – 3200 lm'], ['CCT', '2700 – 4000 K'], ['CRI', '≥ 97 (Ra)'], ['Beam', '15° / 24° / 38°'], ['Dimming', 'DALI-2 · 0–10 V'], ['Driver', '350–700 mA CC']],
    dims: '⌀ 68 × 214 mm',
  },
  {
    key: 'strata', name: 'Strata', code: 'STR',
    category: 'Environmental sensor platform', sector: 'Industrial IoT',
    accent: '#1F9D6B', deep: '#147152', lite: '#84D6B4', tint: '#E2F3EA',
    unit: 'STR-N1', tagline: 'Sense the site. Map the system.',
    form: 'sensor',       // node cube + antenna + vents
    icons: ['node', 'wave', 'wifi', 'temp', 'particle', 'battery', 'bolt', 'cloud', 'shield'],
    specs: [['Channels', 'T · RH · CO₂ · PM'], ['Sample', '1 s – 15 min'], ['Radio', 'LoRaWAN 863–928'], ['Battery', '5 yr @ 5 min'], ['Ingress', 'IP66'], ['Mount', 'DIN · pole · mag']],
    dims: '96 × 96 × 34 mm',
  },
];

// ── hex utils ────────────────────────────────────────────────────────────────
const hx = h => h.replace('#', '').match(/../g).map(x => parseInt(x, 16));
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
const shade = (h, t) => t < 0 ? mix(h, '#000000', -t) : mix(h, '#ffffff', t);

// ── isometric projection ─────────────────────────────────────────────────────
// 2:1 dimetric. ground point (x,y) + height z → screen. s = unit scale.
const ISO = { s: 1, ox: 200, oy: 210 };
const iso = (x, y, z = 0) => [ISO.ox + (x - y) * 0.866 * ISO.s, ISO.oy + (x + y) * 0.5 * ISO.s - z * ISO.s];
const P = pts => pts.map(p => p.join(',')).join(' ');

// a box: footprint w×d centred on ground (gx,gy), height h, base colour c
function isoBox(gx, gy, w, d, h, c, o = {}) {
  const x0 = gx - w / 2, x1 = gx + w / 2, y0 = gy - d / 2, y1 = gy + d / 2;
  const top = [iso(x0, y0, h), iso(x1, y0, h), iso(x1, y1, h), iso(x0, y1, h)];
  const left = [iso(x0, y1, h), iso(x1, y1, h), iso(x1, y1, 0), iso(x0, y1, 0)];   // front-left face (+y)
  const right = [iso(x1, y0, h), iso(x1, y1, h), iso(x1, y1, 0), iso(x1, y0, 0)];  // front-right face (+x)
  const cT = o.top || shade(c, 0.18), cL = o.left || shade(c, -0.06), cR = o.right || shade(c, -0.24);
  const st = o.stroke === false ? '' : ` stroke="${shade(c, -0.34)}" stroke-width="${o.sw || 1}" stroke-linejoin="round"`;
  return `<polygon points="${P(left)}" fill="${cL}"${st}/><polygon points="${P(right)}" fill="${cR}"${st}/><polygon points="${P(top)}" fill="${cT}"${st}/>`;
}
// a cylinder (upright): centre ground (gx,gy), radius r, height h
function isoCyl(gx, gy, r, h, c, o = {}) {
  const k = 0.5, cx = ISO.ox + (gx - gy) * 0.866 * ISO.s;
  const byC = ISO.oy + (gx + gy) * 0.5 * ISO.s, tyC = byC - h * ISO.s;
  const rx = r * 0.866 * ISO.s * 1.0, ry = r * k * ISO.s;
  const cT = o.top || shade(c, 0.2), cS = o.side || shade(c, -0.12), stroke = shade(c, -0.34);
  const body = `<path d="M ${cx - rx} ${tyC} A ${rx} ${ry} 0 0 0 ${cx + rx} ${tyC} L ${cx + rx} ${byC} A ${rx} ${ry} 0 0 1 ${cx - rx} ${byC} Z" fill="${cS}" stroke="${stroke}" stroke-width="1"/>`;
  const top = `<ellipse cx="${cx}" cy="${tyC}" rx="${rx}" ry="${ry}" fill="${cT}" stroke="${stroke}" stroke-width="1"/>`;
  return body + top;
}
function isoShadow(gx, gy, w, d, blur = 6) {
  const c = iso(gx, gy, 0); const rx = w * 0.7 * ISO.s, ry = d * 0.42 * ISO.s;
  return `<ellipse cx="${c[0]}" cy="${c[1] + 6}" rx="${rx}" ry="${ry}" fill="rgba(20,28,44,0.16)" filter="url(#soft)"/>`;
}

// ── svg frame ────────────────────────────────────────────────────────────────
const VB = 400;
function dotField(op = 1) {   // subtle DDS dot-grid, clipped to the paper
  return `<rect x="0" y="0" width="${VB}" height="${VB}" fill="url(#dots)" opacity="${op}"/>`;
}
function frame(inner, o = {}) {
  const p = o.product;
  const footer = o.footer ? `
    <g font-family="ui-monospace,'SF Mono',Menlo,monospace" font-size="11" letter-spacing="0.06em">
      <text x="24" y="380" fill="${MUTE}" text-transform="uppercase">${o.footer.toUpperCase()}</text>
      ${o.tag ? `<text x="376" y="380" fill="${p ? p.accent : INK}" text-anchor="end" font-weight="600">${o.tag}</text>` : ''}
    </g>` : '';
  const bg = o.bg || PAPER;
  const grid = o.grid === false ? '' : dotField(o.gridOp ?? 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" width="${VB}" height="${VB}" font-family="-apple-system,'SF Pro Display','Inter',system-ui,sans-serif">
  <defs>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="${DOT}"/></pattern>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="card" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="rgba(20,28,44,0.14)"/></filter>
    ${o.defs || ''}
  </defs>
  <rect x="0" y="0" width="${VB}" height="${VB}" fill="${bg}"/>
  ${grid}
  ${inner}
  ${footer}
</svg>`;
}

// small text helpers
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" fill="${o.fill || INK}" font-size="${o.size || 13}" font-weight="${o.w || 400}"${o.mono ? ` font-family="ui-monospace,'SF Mono',Menlo,monospace"` : ''}${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.up ? ` style="text-transform:uppercase"` : ''}>${s}</text>`;
const rrect = (x, y, w, h, r, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${o.fill || 'none'}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : ''}${o.filter ? ` filter="${o.filter}"` : ''}/>`;
const eyebrow = (x, y, txt, p) => `${T(x, y, txt, { size: 10, w: 600, mono: true, ls: '0.12em', fill: p.accent, up: true })}`;

// ── the product form (shared by hero render + card + exploded) ────────────────
function productForm(p, stage = 2) {   // stage 0 wireframe · 1 flat · 2 shaded final
  ISO.s = 3.0; ISO.ox = 200; ISO.oy = 232;
  const a = p.accent, wire = stage === 0;
  const boxOpts = wire ? { top: 'none', left: 'none', right: 'none', stroke: false } : {};
  const strokeOnly = c => wire ? `stroke="${shade(a, -0.2)}" stroke-width="1.4" fill="none"` : '';
  let g = isoShadow(0, 0, 42, 42);
  if (p.form === 'controller') {
    // body
    g += wireOrBox(0, 0, 46, 30, 30, a, stage);
    // seam line around the top edge for a device read
    if (!wire) { const s0 = iso(-23, 15, 27), s1 = iso(23, 15, 27); g += `<line x1="${s0[0]}" y1="${s0[1]}" x2="${s1[0]}" y2="${s1[1]}" stroke="${shade(a, -0.28)}" stroke-width="1"/>`; }
    // display + status on the +y (front) face
    g += facePanel(p, stage);
  } else if (p.form === 'spotlight') {
    // mount base + arm + cylindrical head + cone
    g += wireOrBox(0, 10, 26, 26, 5, shade(a, -0.1), stage);       // base
    ISO.s = 3.0;
    g += isoCyl(0, -2, 7.5, 20, a, stage === 0 ? {} : {});          // head
    // lens ring
    const hc = iso(0, -2, 20);
    if (!wire) g += `<ellipse cx="${hc[0]}" cy="${hc[1]}" rx="${7.5 * 0.866 * ISO.s}" ry="${7.5 * 0.5 * ISO.s}" fill="${shade(a, 0.55)}" stroke="${shade(a, -0.3)}"/>`;
    // light cone (up)
    if (stage === 2) {
      const t0 = iso(0, -2, 21); const cw = 34;
      const l = iso(-cw, -2 - cw, 21 + 40), r = iso(cw, -2 + cw, 21 + 40);
      g += `<polygon points="${t0[0]},${t0[1]} ${l[0]},${l[1]} ${r[0]},${r[1]}" fill="${p.lite}" opacity="0.28"/>`;
    }
  } else {   // sensor
    g += wireOrBox(0, 0, 34, 34, 12, a, stage);
    // vent lines on top
    if (!wire) {
      for (let i = -2; i <= 2; i++) { const pA = iso(i * 5, -14, 12), pB = iso(i * 5, 14, 12); g += `<line x1="${pA[0]}" y1="${pA[1]}" x2="${pB[0]}" y2="${pB[1]}" stroke="${shade(a, -0.22)}" stroke-width="1.4"/>`; }
    }
    // antenna
    const b = iso(12, -12, 12), t = iso(12, -12, 30);
    g += `<line x1="${b[0]}" y1="${b[1]}" x2="${t[0]}" y2="${t[1]}" stroke="${shade(a, -0.28)}" stroke-width="2.4" stroke-linecap="round"/><circle cx="${t[0]}" cy="${t[1]}" r="3.4" fill="${stage === 0 ? 'none' : p.deep}" ${stage === 0 ? `stroke="${p.deep}"` : ''}/>`;
    // status LED
    if (stage === 2) { const led = iso(-10, 12, 12); g += `<circle cx="${led[0]}" cy="${led[1]}" r="2.6" fill="${p.lite}"/>`; }
  }
  return g;
}
function wireOrBox(gx, gy, w, d, h, c, stage) {
  if (stage === 0) {
    // wireframe: draw box edges only
    const x0 = gx - w / 2, x1 = gx + w / 2, y0 = gy - d / 2, y1 = gy + d / 2;
    const c000 = iso(x0, y0, 0), c100 = iso(x1, y0, 0), c110 = iso(x1, y1, 0), c010 = iso(x0, y1, 0);
    const c001 = iso(x0, y0, h), c101 = iso(x1, y0, h), c111 = iso(x1, y1, h), c011 = iso(x0, y1, h);
    const ln = (a, b) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${shade(c, -0.1)}" stroke-width="1.3" stroke-dasharray="${'0'}"/>`;
    return [ln(c001, c101), ln(c101, c111), ln(c111, c011), ln(c011, c001), ln(c000, c001), ln(c100, c101), ln(c110, c111), ln(c010, c011), ln(c100, c110), ln(c010, c110)].join('');
  }
  const flat = stage === 1;
  return isoBox(gx, gy, w, d, h, c, flat ? { top: shade(c, 0.12), left: c, right: shade(c, -0.12) } : {});
}
function facePanel(p, stage) {
  if (stage === 0) return '';
  const y = 15;   // +y front face
  const scr = [iso(-19, y, 24), iso(3, y, 24), iso(3, y, 9), iso(-19, y, 9)];
  let g = `<polygon points="${P(scr)}" fill="${shade(p.accent, 0.68)}" stroke="${shade(p.accent, -0.26)}" stroke-width="0.8"/>`;
  const l1a = iso(-16, y, 19), l1b = iso(-2, y, 19), l2a = iso(-16, y, 14.5), l2b = iso(-4, y, 14.5);
  g += `<line x1="${l1a[0]}" y1="${l1a[1]}" x2="${l1b[0]}" y2="${l1b[1]}" stroke="${p.deep}" stroke-width="1.6"/>`;
  g += `<line x1="${l2a[0]}" y1="${l2a[1]}" x2="${l2b[0]}" y2="${l2b[1]}" stroke="${shade(p.accent, 0.05)}" stroke-width="1.4"/>`;
  const dots = [11, 15, 19].map((dx, i) => { const d = iso(dx, y, 20); return `<circle cx="${d[0]}" cy="${d[1]}" r="2" fill="${[p.lite, shade(p.accent, 0.2), WHITE][i]}" stroke="${shade(p.accent, -0.2)}" stroke-width="0.5"/>`; });
  const dots2 = [-19, -15, -11].map((dx) => { const d = iso(dx, y, 5); return `<circle cx="${d[0]}" cy="${d[1]}" r="1.6" fill="${shade(p.accent, -0.1)}"/>`; });
  return g + dots.join('') + dots2.join('');
}

// exploded isometric — cover / body / base separated with leaders
function explodedView(p) {
  ISO.s = 2.7; ISO.ox = 205; ISO.oy = 236;
  const a = p.accent;
  let g = isoShadow(0, 0, 40, 40);
  const layers = [
    { z: 0, h: 8, c: shade(a, -0.16), lbl: '01 · base / mount' },
    { z: 22, h: 16, c: a, lbl: '02 · main body' },
    { z: 52, h: 8, c: shade(a, 0.3), lbl: '03 · fascia / cover' },
  ];
  layers.forEach(L => { g += isoBox(0, 0, 36, 28, L.h, L.c, {}); const t = iso(20, -14, L.z + L.h); g += `<line x1="${t[0]}" y1="${t[1]}" x2="${t[0] + 34}" y2="${t[1] - 6}" stroke="${MUTE}" stroke-width="1"/><circle cx="${t[0]}" cy="${t[1]}" r="2" fill="${a}"/>`; });
  // re-stack with vertical offset by drawing top-down
  ISO.s = 2.7;
  g = isoShadow(0, 0, 40, 40);
  const zs = [{ z: 0, h: 7, c: shade(a, -0.18), n: '03' }, { z: 24, h: 15, c: a, n: '02' }, { z: 52, h: 7, c: shade(a, 0.32), n: '01' }];
  // draw bottom→top so overlaps are correct
  zs.forEach(L => { g += drawFloatBox(0, 0, 34, 26, L.z, L.h, L.c); });
  // leader labels
  zs.forEach((L, i) => { const t = iso(17, -13, L.z + L.h); const lx = t[0] + 40, ly = t[1] - 8; g += `<line x1="${t[0]}" y1="${t[1]}" x2="${lx - 6}" y2="${ly + 4}" stroke="${HAIR}" stroke-width="1"/><circle cx="${t[0]}" cy="${t[1]}" r="2.4" fill="${a}"/>${T(lx, ly + 8, ['Fascia / display', 'Main body', 'Base / mount'][i], { size: 10.5, fill: INK2 })}<text x="${lx}" y="${ly - 4}" fill="${MUTE}" font-size="9" font-family="ui-monospace,monospace">${L.n}</text>`; });
  return frame(g, { product: p, footer: `${p.code} · exploded assembly`, tag: `${zs.length} PARTS` });
}
function drawFloatBox(gx, gy, w, d, z, h, c) {   // box floating at height z
  const x0 = gx - w / 2, x1 = gx + w / 2, y0 = gy - d / 2, y1 = gy + d / 2;
  const top = [iso(x0, y0, z + h), iso(x1, y0, z + h), iso(x1, y1, z + h), iso(x0, y1, z + h)];
  const left = [iso(x0, y1, z + h), iso(x1, y1, z + h), iso(x1, y1, z), iso(x0, y1, z)];
  const right = [iso(x1, y0, z + h), iso(x1, y1, z + h), iso(x1, y1, z), iso(x1, y0, z)];
  const st = ` stroke="${shade(c, -0.34)}" stroke-width="1" stroke-linejoin="round"`;
  return `<polygon points="${P(left)}" fill="${shade(c, -0.06)}"${st}/><polygon points="${P(right)}" fill="${shade(c, -0.22)}"${st}/><polygon points="${P(top)}" fill="${shade(c, 0.16)}"${st}/>`;
}

// install / user guide — numbered steps + a mini diagram
function userGuide(p) {
  const dx = 44, dw = 312, dy = 34, dh = 332;
  const steps = ['Mount the base and level', 'Connect zones 1–8 to the terminal', 'Pair over Wi-Fi · scan the QR', 'Set the schedule and run a test'];
  const rows = steps.map((s, i) => `<g transform="translate(${dx + 22},${dy + 150 + i * 40})"><circle cx="9" cy="-4" r="11" fill="${p.tint}" stroke="${p.accent}" stroke-width="1.3"/>${T(9, 0, String(i + 1), { size: 12, w: 700, anchor: 'middle', fill: p.deep })}${T(30, 0, s, { size: 12.5, fill: INK2 })}</g>`).join('');
  const diag = `<g transform="translate(${dx + 20},${dy + 44})">${rrect(0, 0, dw - 40, 64, 6, { fill: p.tint })}
     <clipPath id="gd-${p.key}"><rect x="1" y="1" width="${dw - 42}" height="62" rx="6"/></clipPath>
     <g clip-path="url(#gd-${p.key})">${(() => { ISO.s = 1.15; ISO.ox = 70; ISO.oy = 56; return productForm(p, 2).replace(/filter="url\(#soft\)"/g, ''); })()}</g>
     ${T(dw - 156, 24, 'Fig 1 — in the box', { size: 10, mono: true, fill: MUTE })}
     ${T(dw - 156, 42, p.unit + ' unit', { size: 11, fill: INK2 })}
     ${T(dw - 156, 57, '+ mount + QR card', { size: 11, fill: INK2 })}</g>`;
  const doc = `${rrect(dx, dy, dw, dh, 8, { fill: WHITE, stroke: HAIR, sw: 1, filter: 'url(#card)' })}
    <rect x="${dx}" y="${dy}" width="6" height="${dh}" rx="3" fill="${p.accent}"/>
    ${eyebrow(dx + 22, dy + 30, `${p.code} · Quick-start guide`, p)}
    ${T(dx + 22, dy + 26 + 6, '', {})}
    ${diag}
    ${rows}`;
  return frame(doc, { product: p, grid: true, gridOp: 0.5, footer: `${p.code} · user guide`, tag: '4 STEPS' });
}

// wiring / setup illustration — schematic of the product system
function wiring(p) {
  const a = p.accent;
  const nodes = p.form === 'controller'
    ? [{ x: 200, y: 120, r: 30, l: 'CTRL', big: 1 }, { x: 90, y: 250, r: 20, l: 'V1' }, { x: 160, y: 300, r: 20, l: 'V2' }, { x: 240, y: 300, r: 20, l: 'V3' }, { x: 315, y: 250, r: 20, l: 'SENS' }]
    : p.form === 'spotlight'
      ? [{ x: 200, y: 110, r: 26, l: 'PSU', big: 1 }, { x: 90, y: 240, r: 20, l: 'T1' }, { x: 160, y: 300, r: 20, l: 'H1' }, { x: 240, y: 300, r: 20, l: 'H2' }, { x: 315, y: 240, r: 20, l: 'H3' }]
      : [{ x: 200, y: 120, r: 28, l: 'GW', big: 1 }, { x: 95, y: 250, r: 20, l: 'N1' }, { x: 165, y: 300, r: 20, l: 'N2' }, { x: 245, y: 300, r: 20, l: 'N3' }, { x: 310, y: 250, r: 20, l: 'N4' }];
  const hub = nodes[0];
  let g = '';
  nodes.slice(1).forEach(n => { g += `<path d="M${hub.x} ${hub.y + hub.r} C ${hub.x} ${(hub.y + n.y) / 2}, ${n.x} ${(hub.y + n.y) / 2}, ${n.x} ${n.y - n.r}" fill="none" stroke="${p.lite}" stroke-width="2"/>`; });
  nodes.slice(1).forEach(n => { const mx = (hub.x + n.x) / 2, my = (hub.y + n.y) / 2 + 6; g += `<circle cx="${mx}" cy="${my}" r="2.2" fill="${a}"/>`; });
  nodes.forEach(n => {
    g += `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${n.big ? a : WHITE}" stroke="${n.big ? shade(a, -0.2) : a}" stroke-width="${n.big ? 1.5 : 1.8}"/>`;
    g += T(n.x, n.y + 4, n.l, { size: n.big ? 13 : 10.5, w: 700, anchor: 'middle', mono: true, fill: n.big ? WHITE : p.deep });
  });
  return frame(g, { product: p, footer: `${p.code} · setup schematic`, tag: 'WIRING' });
}

// hero video — scene + play + scrubber
function videoThumb(p) {
  ISO.s = 2.0; ISO.ox = 200; ISO.oy = 190;
  const scene = `<rect x="40" y="46" width="320" height="240" rx="10" fill="${p.tint}"/>${dotField(0.5)}<g>${productForm(p, 2)}</g><rect x="40" y="46" width="320" height="240" rx="10" fill="none" stroke="${HAIR}"/>`;
  const play = `<circle cx="200" cy="166" r="34" fill="rgba(255,255,255,0.86)" filter="url(#card)"/><path d="M190 150 l26 16 l-26 16 Z" fill="${p.deep}"/>`;
  const bar = `<rect x="40" y="300" width="320" height="4" rx="2" fill="${HAIR}"/><rect x="40" y="300" width="120" height="4" rx="2" fill="${p.accent}"/><circle cx="160" cy="302" r="5" fill="${p.accent}"/>`;
  const meta = `${T(40, 336, `${p.name} — 60s product film`, { size: 13, w: 600 })}${T(360, 336, '00:24 / 01:00', { size: 11, mono: true, fill: MUTE, anchor: 'end' })}`;
  return frame(`${scene}${play}${bar}${meta}`, { product: p, grid: false, footer: `${p.code} · hero video`, tag: 'MP4 · 4K' });
}

// install animation — keyframe strip + motion arc
function animationThumb(p) {
  const fx = 40, fy = 70, fw = 96, gap = 12;
  let g = '';
  [0, 1, 2].forEach(i => {
    const x = fx + i * (fw + gap);
    g += rrect(x, fy, fw, 96, 8, { fill: WHITE, stroke: HAIR, sw: 1 });
    ISO.s = 1.15; ISO.ox = x + fw / 2; ISO.oy = fy + 74;
    g += `<g opacity="${0.5 + i * 0.25}">${drawFloatBox(0, 0, 30, 24, i * 6, 14, p.accent)}</g>`;
    g += T(x + 8, fy + 88, 'F' + (i + 1) * 12, { size: 8.5, mono: true, fill: MUTE });
  });
  // motion arc across the frames
  g += `<path d="M${fx + 20} ${fy + 150} Q ${200} ${fy + 110}, ${fx + 3 * fw + 2 * gap - 20} ${fy + 150}" fill="none" stroke="${p.accent}" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round"/>`;
  // ease curve
  g += `<g transform="translate(40,240)">${rrect(0, 0, 130, 84, 8, { fill: WHITE, stroke: HAIR })}${T(12, 20, 'ease', { size: 10, mono: true, fill: MUTE })}<path d="M12 72 C 40 72, 50 20, 118 20" fill="none" stroke="${p.accent}" stroke-width="2"/><circle cx="12" cy="72" r="3" fill="${p.accent}"/><circle cx="118" cy="20" r="3" fill="${p.accent}"/></g>`;
  g += `<g transform="translate(190,240)">${T(0, 20, 'Install sequence', { size: 13, w: 600 })}${T(0, 44, '12 s · loop · Lottie + MP4', { size: 11, fill: INK2, mono: true })}${T(0, 66, 'Onboarding · web · in-app', { size: 11, fill: MUTE })}</g>`;
  return frame(g, { product: p, footer: `${p.code} · install animation`, tag: 'LOTTIE' });
}

// localization set — the guide rendered across locales (ties to translation work)
function localizationSet(p) {
  const locs = [{ f: 'EN', s: 'Set the schedule', d: 'ltr' }, { f: 'DE', s: 'Zeitplan festlegen', d: 'ltr' }, { f: 'AR', s: 'اضبط الجدول', d: 'rtl' }, { f: 'ZH', s: '设置计划', d: 'ltr' }, { f: 'ES', s: 'Definir el programa', d: 'ltr' }, { f: 'FR', s: 'Définir le programme', d: 'ltr' }];
  const cx = 44, cy = 74, cw = 148, ch = 92, gx = 16, gy = 16;
  let g = '';
  locs.forEach((L, i) => {
    const x = cx + (i % 2) * (cw + gx), y = cy + ((i / 2) | 0) * (ch + gy);
    const anchor = L.d === 'rtl' ? 'end' : 'start', tx = L.d === 'rtl' ? x + cw - 14 : x + 14;
    g += rrect(x, y, cw, ch, 7, { fill: WHITE, stroke: HAIR, sw: 1 });
    g += `<rect x="${x}" y="${y}" width="${cw}" height="4" rx="2" fill="${p.accent}"/>`;
    g += `<g transform="translate(${x + 14},${y + 24})">${rrect(0, -12, 20, 14, 2, { fill: p.tint, stroke: p.accent, sw: 0.8 })}${T(10, -1, L.f, { size: 8.5, w: 700, anchor: 'middle', mono: true, fill: p.deep })}</g>`;
    g += T(tx, y + 52, L.s, { size: 13, w: 600, fill: INK, anchor });
    g += `<line x1="${x + 14}" y1="${y + 68}" x2="${x + cw - 14}" y2="${y + 68}" stroke="${HAIR2}"/><line x1="${x + 14}" y1="${y + 78}" x2="${x + cw - 40}" y2="${y + 78}" stroke="${HAIR2}"/>`;
  });
  return frame(g, { product: p, footer: `${p.code} · localization`, tag: `${locs.length} LOCALES` });
}

// ── GENRES ───────────────────────────────────────────────────────────────────
// hero render — clean product on a plinth
function heroRender(p, stage = 2) {
  return frame(productForm(p, stage), { product: p, footer: `${p.code} · industrial design`, tag: stage === 0 ? 'v1' : 'RENDER' });
}
// product hub card — render + name + category + counts (baked chrome)
function productCard(p, counts) {
  ISO.s = 2.4; ISO.ox = 200; ISO.oy = 150;
  const form = productForm(p, 2);
  const inner = `
  <g>${form}</g>
  <line x1="24" y1="250" x2="376" y2="250" stroke="${HAIR}"/>
  ${eyebrow(24, 284, `${p.sector} · ${p.code}`, p)}
  ${T(24, 314, p.name, { size: 34, w: 700, fill: INK })}
  ${T(24, 340, p.category, { size: 14, fill: INK2 })}
  <g font-family="ui-monospace,'SF Mono',Menlo,monospace" font-size="11.5" letter-spacing="0.04em">
    <text x="24" y="372" fill="${MUTE}">${counts.assets} ASSETS · ${counts.versions} VERSIONS</text>
    <text x="376" y="372" fill="${p.accent}" text-anchor="end" font-weight="600">EXPLORE →</text>
  </g>`;
  return frame(inner, { product: p, grid: true, gridOp: 0.7 });
}
// icon set — 3×3 grid of line glyphs
function iconSet(p) {
  const gx0 = 78, gy0 = 96, step = 82;
  let cells = '';
  p.icons.forEach((name, i) => {
    const cx = gx0 + (i % 3) * step, cy = gy0 + ((i / 3) | 0) * step;
    cells += `<g transform="translate(${cx},${cy})">${rrect(-30, -30, 60, 60, 12, { fill: WHITE, stroke: HAIR, sw: 1 })}<g transform="translate(-14,-14) scale(1.16)" stroke="${p.accent}" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round">${glyph(name)}</g></g>`;
  });
  return frame(`${cells}`, { product: p, footer: `${p.code} · icon system`, tag: `${p.icons.length} GLYPHS` });
}
function glyph(n) {   // 24×24 line glyphs
  const G = {
    drop: `<path d="M12 3 C7 10 6 13 6 16 a6 6 0 0 0 12 0 C18 13 17 10 12 3 Z"/>`,
    valve: `<circle cx="12" cy="12" r="4"/><path d="M12 8V3M12 21v-5M8 12H3M21 12h-5"/>`,
    gauge: `<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 13l4-3"/><circle cx="12" cy="13" r="1.4" fill="currentColor" stroke="none"/>`,
    wifi: `<path d="M4 9a12 12 0 0 1 16 0M7 12.5a7 7 0 0 1 10 0M10 16a2.5 2.5 0 0 1 4 0"/><circle cx="12" cy="19" r="0.8" fill="currentColor" stroke="none"/>`,
    clock: `<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>`,
    leaf: `<path d="M20 4C9 4 4 10 4 18c8 0 14-4 16-14ZM4 20C8 14 12 12 18 10"/>`,
    bolt: `<path d="M13 3 5 13h5l-1 8 8-11h-5l1-7Z"/>`,
    shield: `<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/><path d="M9 12l2 2 4-4"/>`,
    sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>`,
    bulb: `<path d="M9 18h6M10 21h4M8 13a5 5 0 1 1 8 0c-1 1.5-1.5 2-1.5 4h-5c0-2-.5-2.5-1.5-4Z"/>`,
    cone: `<path d="M12 3 5 20h14L12 3Z"/><path d="M8.5 13h7"/>`,
    track: `<path d="M3 7h18M6 7v10M12 7v10M18 7v10"/>`,
    dial: `<circle cx="12" cy="12" r="8"/><path d="M12 12l4-2"/><path d="M12 4v2M20 12h-2"/>`,
    kelvin: `<path d="M7 5v14M7 12l7-7M7 12l7 7"/>`,
    lens: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>`,
    grid: `<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>`,
    node: `<rect x="5" y="5" width="14" height="14" rx="2"/><circle cx="12" cy="12" r="2.5"/>`,
    wave: `<path d="M3 12c2-5 4-5 6 0s4 5 6 0 4-5 6 0"/>`,
    temp: `<path d="M12 4a2 2 0 0 0-2 2v8a3.5 3.5 0 1 0 4 0V6a2 2 0 0 0-2-2Z"/><path d="M12 14V8"/>`,
    particle: `<circle cx="7" cy="8" r="1.6"/><circle cx="16" cy="7" r="1.6"/><circle cx="12" cy="14" r="1.6"/><circle cx="17" cy="16" r="1.6"/><circle cx="8" cy="17" r="1.6"/>`,
    battery: `<rect x="4" y="8" width="15" height="8" rx="1.5"/><path d="M21 10.5v3"/><path d="M7 12h6"/>`,
    cloud: `<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1A3.5 3.5 0 0 1 17 18H7Z"/>`,
  };
  return G[n] || `<rect x="5" y="5" width="14" height="14" rx="3"/>`;
}
// tech spec sheet — flat doc + spec table
function specSheet(p, stage = 2) {
  const dx = 60, dw = 280, dy = 40, dh = 320;
  const rows = p.specs.map((r, i) => {
    const ry = dy + 116 + i * 30;
    return `<line x1="${dx + 20}" y1="${ry + 10}" x2="${dx + dw - 20}" y2="${ry + 10}" stroke="${HAIR2}"/>
      ${T(dx + 20, ry, r[0], { size: 11.5, fill: INK2 })}
      ${T(dx + dw - 20, ry, r[1], { size: 11.5, fill: INK, w: 600, mono: true, anchor: 'end' })}`;
  }).join('');
  const doc = `
    ${rrect(dx, dy, dw, dh, 8, { fill: WHITE, stroke: HAIR, sw: 1, filter: 'url(#card)' })}
    <rect x="${dx}" y="${dy}" width="${dw}" height="6" rx="3" fill="${p.accent}"/>
    ${eyebrow(dx + 20, dy + 34, `${p.code} · Technical spec`, p)}
    ${T(dx + 20, dy + 62, p.name, { size: 22, w: 700 })}
    ${T(dx + 20, dy + 82, p.unit + ' · ' + p.dims, { size: 10.5, fill: MUTE, mono: true })}
    ${stage === 0 ? '' : rows}
    <g opacity="${stage === 0 ? 0.35 : 1}">
      ${T(dx + 20, dy + dh - 20, 'IEC/IEEE 82079-1', { size: 9, mono: true, fill: MUTE, up: true, ls: '0.08em' })}
      <circle cx="${dx + dw - 30}" cy="${dy + dh - 24}" r="9" fill="none" stroke="${p.accent}" stroke-width="1.5"/><path d="M${dx + dw - 34} ${dy + dh - 24} l3 3 l5 -6" fill="none" stroke="${p.accent}" stroke-width="1.5"/>
    </g>`;
  return frame(doc, { product: p, grid: true, gridOp: 0.5, footer: `${p.code} · spec sheet`, tag: stage === 0 ? 'v1 DRAFT' : 'IFU' });
}
// regional product label — barcode, ratings, certs, region tag
function label(p, region = { code: 'EU', flag: '🇪🇺', line: 'Conforms to EU directives' }, stage = 2) {
  const lx = 84, lw = 232, ly = 66, lh = 268;
  const bars = Array.from({ length: 38 }, (_, i) => `<rect x="${lx + 22 + i * 5}" y="${ly + lh - 54}" width="${(i * 7) % 3 + 1.4}" height="34" fill="${INK}"/>`).join('');
  const certs = ['CE', 'UKCA', 'FCC', 'RoHS'].map((c, i) => `<g transform="translate(${lx + 22 + i * 50},${ly + 96})">${rrect(0, 0, 42, 24, 4, { stroke: INK2, sw: 1 })}${T(21, 16, c, { size: 10, w: 700, anchor: 'middle', mono: true, fill: INK2 })}</g>`).join('');
  const doc = `
    ${rrect(lx, ly, lw, lh, 6, { fill: WHITE, stroke: HAIR, sw: 1, filter: 'url(#card)' })}
    <rect x="${lx}" y="${ly}" width="${lw}" height="30" fill="${p.accent}"/>
    ${T(lx + 14, ly + 20, p.name + ' ' + p.unit, { size: 13, w: 700, fill: WHITE })}
    ${T(lx + lw - 12, ly + 20, region.code, { size: 11, w: 700, mono: true, fill: WHITE, anchor: 'end' })}
    ${T(lx + 14, ly + 54, region.line, { size: 10.5, fill: INK2 })}
    ${T(lx + 14, ly + 72, 'Model ' + p.code + ' · 24 VAC · IP66', { size: 9.5, mono: true, fill: MUTE })}
    ${stage === 0 ? '' : certs}
    ${stage === 0 ? '' : bars}
    ${T(lx + 14, ly + lh - 12, '0000 ' + p.code + ' ' + region.code + ' 001', { size: 9.5, mono: true, fill: INK, ls: '0.14em' })}`;
  return frame(doc, { product: p, grid: true, gridOp: 0.5, footer: `${p.code} · compliance label`, tag: region.code });
}
// packaging — isometric retail box
function packaging(p, stage = 2) {
  ISO.s = 3.4; ISO.ox = 200; ISO.oy = 250;
  let g = isoShadow(0, 0, 40, 40, 8);
  g += wireOrBox(0, 0, 34, 26, 40, shade(p.accent, 0.04), stage);
  if (stage !== 0) {
    // brand panel on +y face
    const a = iso(-14, 13, 34), b = iso(9, 13, 34), c = iso(9, 13, 8), d = iso(-14, 13, 8);
    g += `<polygon points="${P([a, b, c, d])}" fill="${shade(p.accent, 0.5)}" opacity="0.9"/>`;
    const nm = iso(-2, 13, 24);
    g += `<text x="${nm[0]}" y="${nm[1]}" fill="${WHITE}" font-size="15" font-weight="700" text-anchor="middle" transform="skewX(-30) translate(${nm[1] * 0.577},0)">${p.name}</text>`;
    // accent stripe on top
    const t1 = iso(-17, -6, 40), t2 = iso(17, -6, 40), t3 = iso(17, 0, 40), t4 = iso(-17, 0, 40);
    g += `<polygon points="${P([t1, t2, t3, t4])}" fill="${p.accent}"/>`;
  }
  return frame(g, { product: p, grid: true, gridOp: 0.7, footer: `${p.code} · retail packaging`, tag: 'DIELINE' });
}

// ── emit (first batch — to expand) ───────────────────────────────────────────
if (existsSync(ASSETS)) for (const f of readdirSync(ASSETS)) if (f.endsWith('.svg')) rmSync(join(ASSETS, f));
mkdirSync(ASSETS, { recursive: true });
const written = [];
const put = (name, svg) => { writeFileSync(join(ASSETS, name), svg); written.push(name); };

const REGIONS = {
  meridian: { code: 'EU', flag: '🇪🇺', line: 'Conforms to EU directives' },
  lumen: { code: 'US', flag: '🇺🇸', line: 'UL listed · Title 24 ready' },
  strata: { code: 'APAC', flag: '🌏', line: 'RCM · PSE · KC marked' },
};

for (const p of PRODUCTS) {
  put(`${p.key}-render.svg`, heroRender(p, 2));
  put(`${p.key}-render-v1.svg`, heroRender(p, 0));
  put(`${p.key}-exploded.svg`, explodedView(p));
  put(`${p.key}-icons.svg`, iconSet(p));
  put(`${p.key}-spec.svg`, specSheet(p, 2));
  put(`${p.key}-spec-v1.svg`, specSheet(p, 0));
  put(`${p.key}-guide.svg`, userGuide(p));
  put(`${p.key}-label.svg`, label(p, REGIONS[p.key], 2));
  put(`${p.key}-label-v1.svg`, label(p, REGIONS[p.key], 0));
  put(`${p.key}-pack.svg`, packaging(p, 2));
  put(`${p.key}-wiring.svg`, wiring(p));
  put(`${p.key}-video.svg`, videoThumb(p));
  put(`${p.key}-anim.svg`, animationThumb(p));
  put(`${p.key}-localize.svg`, localizationSet(p));
}

// ── dataset: content/explore-snapshot.json (graffold asset schema) ───────────
const PREV = f => `content/explore/assets/${f}`;
const T0 = Date.UTC(2025, 8, 1), DAY = 86400000;
let uid = 0; const U = () => 'ex-' + (++uid);
const link = a => ({ id: a.id, name: a.name, fileName: a.fileName, preview: a.preview, relation: 'CONTAINS_ASSET' });

function makeTree(prefix, early, final, profile, links) {
  const n = (gen, tOff, status, prev, kids = [], lf = [], lbl) => ({
    uuid: U(), label: lbl || `${prefix} v${gen}`, generation: String(gen),
    timeStamp: T0 + tOff * DAY, status, preview: PREV(prev),
    iterationFileName: `I_${prefix}_v${gen}`.replace(/[^\w.]+/g, '') + '.svg', linkedFiles: lf, children: kids,
  });
  if (profile === 'fork') return n('1', 4, ['superseded'], early, [
    n('2', 40, ['superseded'], early, [
      n('3', 120, ['currentAsset'], final, [
        n('3.1', 150, [], final, [], [], 'EU variant'),
        n('3.2', 168, ['currentWorkingFile'], final, [], links, 'US variant'),
        n('3.3', 176, [], final, [], [], 'APAC variant'),
      ], links)])]);
  if (profile === 'branch') return n('1', 2, ['superseded'], early, [
    n('2', 46, ['superseded'], early, [
      n('2.1', 60, ['superseded'], final, [], [], 'alt direction'),
      n('3', 132, ['currentAsset'], final, [
        n('3.1', 176, ['currentWorkingFile'], final, [], links)], links)])]);
  return n('1', 6, ['superseded'], early, [
    n('2', 52, ['superseded'], early, [
      n('3', 128, ['currentAsset'], final, [
        n('3.1', 178, ['currentWorkingFile'], final, [], links)], links)])]);
}
const countTree = t => 1 + (t.children || []).reduce((s, c) => s + countTree(c), 0);
const maxTime = t => Math.max(t.timeStamp, ...(t.children || []).map(maxTime));

const SUITE = [
  { slot: 'render', name: 'Hero Render — Industrial Design', type: 'Industrial design', prof: 'linear', links: ['exploded', 'icons'], early: 'render-v1', final: 'render' },
  { slot: 'exploded', name: 'Exploded Assembly', type: 'Industrial design', prof: 'linear', links: ['render'], final: 'exploded' },
  { slot: 'icons', name: 'Icon System', type: 'Icon set', prof: 'branch', links: [], final: 'icons' },
  { slot: 'spec', name: 'Technical Spec Sheet', type: 'Document', prof: 'branch', links: ['icons', 'render'], early: 'spec-v1', final: 'spec' },
  { slot: 'guide', name: 'Quick-Start Guide', type: 'Document', prof: 'branch', links: ['wiring', 'render', 'video', 'localize'], final: 'guide' },
  { slot: 'pack', name: 'Retail Packaging', type: 'Packaging', prof: 'linear', links: ['label', 'render'], final: 'pack' },
  { slot: 'label', name: 'Compliance Label', type: 'Label', prof: 'fork', links: ['localize'], early: 'label-v1', final: 'label' },
  { slot: 'wiring', name: 'Setup Schematic', type: 'Illustration', prof: 'linear', links: ['render'], final: 'wiring' },
  { slot: 'video', name: 'Hero Video', type: 'Video', prof: 'linear', links: ['render'], final: 'video' },
  { slot: 'anim', name: 'Install Animation', type: 'Animation', prof: 'linear', links: ['guide'], final: 'anim' },
  { slot: 'localize', name: 'Localization Set', type: 'Localization', prof: 'linear', links: ['guide', 'label'], final: 'localize' },
];

const assets = [];
for (const p of PRODUCTS) {
  const suite = SUITE.map(s => ({
    id: U(), name: `${p.name} · ${s.name}`, fileName: `${p.key}-${s.slot}`,
    preview: PREV(`${p.key}-${s.final}.svg`), project: p.name, contentType: s.type,
    authoringSoftware: '', _s: s,
    _early: s.early ? `${p.key}-${s.early}.svg` : `${p.key}-${s.final}.svg`, _final: `${p.key}-${s.final}.svg`,
  }));
  const byslot = Object.fromEntries(suite.map(a => [a._s.slot, a]));
  suite.forEach(a => {
    const links = a._s.links.map(sl => byslot[sl]).filter(Boolean);
    const t = makeTree(`${p.code}-${a._s.slot}`, a._early, a._final, a._s.prof, links.map(l => l.fileName));
    a.tree = t; a.iterationCount = countTree(t); a.latestIterationTime = maxTime(t);
    a.linkedAssets = links.map(link);
    a.notes = `${a._s.name} for the ${p.name} ${p.category.toLowerCase()} — versioned in Graffold, linked to the assets it is built from.`;
    delete a._s; delete a._early; delete a._final;
    assets.push(a);
  });
  const versions = suite.reduce((s, a) => s + a.iterationCount, 0);
  put(`${p.key}-card.svg`, productCard(p, { assets: SUITE.length, versions }));   // bake real counts
  const hub = {
    id: U(), name: p.name, fileName: `${p.key}-system`, preview: PREV(`${p.key}-card.svg`),
    project: p.name, contentType: 'Product system', authoringSoftware: '',
    notes: `${p.name} — ${p.category}. ${p.tagline}  A complete communication suite: ${SUITE.length} connected, versioned deliverables (${versions} versions) mapped to one product system.`,
    linkedAssets: suite.map(link),
  };
  const ht = makeTree(`${p.code}-system`, `${p.key}-card.svg`, `${p.key}-card.svg`, 'branch', suite.slice(0, 4).map(a => a.fileName));
  hub.tree = ht; hub.iterationCount = countTree(ht); hub.latestIterationTime = maxTime(ht);
  assets.unshift(hub);
}

writeFileSync(join(REPO, 'content', 'explore-snapshot.json'),
  JSON.stringify({ company: { label: 'Doran Design Studio', generatedNote: 'Explore — invented exemplar product suites (not client work). Generated by publish/build-explore.mjs.' }, sample: true, assets }, null, 2) + '\n');

// contact sheet for review
const sheet = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#E9E7E3;font-family:-apple-system,system-ui,sans-serif">
<div style="padding:28px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px;max-width:1400px;margin:0 auto">
${written.map(n => `<figure style="margin:0"><div style="background:#fff;border:1px solid #e0ded9;border-radius:10px;overflow:hidden"><img src="assets/${n}" style="width:100%;display:block"></div><figcaption style="font:11px ui-monospace,monospace;color:#6b7280;margin-top:6px">${n}</figcaption></figure>`).join('\n')}
</div></body>`;
writeFileSync(join(REPO, 'content', 'explore', '_contactsheet.html'), sheet);

console.log('wrote', written.length, 'svgs +', assets.length, 'assets →', PRODUCTS.length, 'products');
