/*!
 * DDS Icon Engine — soft-body generative icons (dependency-free)
 * Doran Design Studio · renders deterministic blob icons to a <canvas>.
 *
 * Usage:
 *   const icon = DDSIcon.create(canvasEl, { seed: 'Project Apollo', shapes: 3,
 *                  scheme: 'mono', color: 'var(--color-blue)', background: 'transparent' });
 *   icon.update({ scheme: 'colorful' });   // re-render with new options
 *   icon.randomize();                       // new random seed
 *   const png = icon.toDataURL(512);        // export
 *
 * Colours accept hex, rgb(), CSS custom properties (var(--color-blue)) and
 * named CSS colours — resolved against the canvas's place in the document,
 * so the icon inherits your design tokens.
 */
(function (global) {
  'use strict';

  /* ---------------- tuning (matches the standalone generator) ------------- */
  var PARAMS = { radius: 66, spread: 10, springK: 0.5, collision: 0.55, damping: 0.98, growSpd: 0.01, startPct: 20, gap: 2, grav: 0.0005 };
  var FRAME = 360;                          // fixed logical canvas size — physics is tuned here
  var SHAPES = ['circle', 'star5', 'triangle', 'pill', 'doughnut'];
  var ACCENTS = ['#3366FF', '#aa7add', '#e946c3', '#ff4c4c', '#ff9500', '#ffd119', '#35c4c0', '#00bc35'];
  var NEUTRALS = ['#FFFFFF', '#FAFAFA', '#F5F5F5', '#E5E5E5', '#D4D4D4', '#A3A3A3', '#737373', '#525252', '#404040', '#262626', '#171717', '#000000'];

  /* ---------------- math aliases ------------------------------------------ */
  var TWO_PI = Math.PI * 2, sqrt = Math.sqrt, cos = Math.cos, sin = Math.sin, atan2 = Math.atan2,
      abs = Math.abs, min = Math.min, max = Math.max, floor = Math.floor, round = Math.round, ceil = Math.ceil;
  function constrain(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ---------------- seeded RNG (deterministic per seed string) ------------ */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashSeed(str) {
    str = String(str); var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function pick(rng, a) { return a[floor(rng() * a.length)]; }
  function shuffle(rng, src) { var a = src.slice(); for (var i = a.length - 1; i > 0; i--) { var j = floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---------------- colour helpers ---------------------------------------- */
  function parseColor(c) {
    if (!c) return null;
    if (c[0] === '#') { var h = c.slice(1); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }; }
    var m = c.match(/rgba?\(([^)]+)\)/); if (m) { var p = m[1].split(','); return { r: +p[0], g: +p[1], b: +p[2] }; }
    return null;
  }
  function luminance(c) { var p = parseColor(c); return p ? (p.r * 299 + p.g * 587 + p.b * 114) / 1000 : 128; }
  function hasContrast(fg, bg) { return abs(luminance(fg) - luminance(bg)) > 60; }

  // Resolve var(--token) / named CSS colours to a concrete rgb() string,
  // computed against the element's actual place in the document.
  function resolveColor(value, el) {
    if (typeof value !== 'string') return value;
    if (value === 'transparent' || value[0] === '#' || value.indexOf('rgb') === 0) return value;
    try {
      var probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;width:0;height:0;display:block;color:' + value;
      (el && el.parentNode ? el.parentNode : document.body).appendChild(probe);
      var col = getComputedStyle(probe).color;
      probe.parentNode.removeChild(probe);
      return col || value;
    } catch (e) { return value; }
  }

  function schemeColors(rng, scheme, count, base, bgCol) {
    var c = [], i;
    function safeNeutrals() { return NEUTRALS.filter(function (n) { return hasContrast(n, bgCol); }); }
    switch (scheme) {
      case 'pop': {
        var mids = ['#E5E5E5', '#D4D4D4', '#A3A3A3', '#737373', '#525252'].filter(function (n) { return hasContrast(n, bgCol); });
        var popN = mids.length ? mids : safeNeutrals(); if (!popN.length) popN = ['#A3A3A3'];
        var acc = pick(rng, ACCENTS), ai = floor(rng() * count);
        for (i = 0; i < count; i++) c.push(i === ai ? acc : pick(rng, popN));
        break;
      }
      case 'neutral': { var sn = safeNeutrals(); if (!sn.length) sn = ['#ffffff']; for (i = 0; i < count; i++) c.push(pick(rng, sn)); break; }
      case 'colorful': { var s = shuffle(rng, ACCENTS); for (i = 0; i < count; i++) c.push(s[i % s.length]); break; }
      case 'mono': default: { for (i = 0; i < count; i++) c.push(base); break; }
    }
    return c;
  }

  /* ---------------- tiny vector ------------------------------------------- */
  function Vec(x, y) { this.x = x; this.y = y; }
  Vec.prototype.add = function (v) { this.x += v.x; this.y += v.y; return this; };
  Vec.prototype.mult = function (s) { this.x *= s; this.y *= s; return this; };
  Vec.prototype.mag = function () { return sqrt(this.x * this.x + this.y * this.y); };
  Vec.prototype.dist = function (v) { var dx = this.x - v.x, dy = this.y - v.y; return sqrt(dx * dx + dy * dy); };
  function createVector(x, y) { return new Vec(x, y); }

  /* ---------------- particle / spring (verbatim soft-body) ---------------- */
  function Pt(x, y, id) { this.pos = createVector(x, y); this.vel = createVector(0, 0); this.id = id; this.r = 3; }
  Pt.prototype.push = function (fx, fy) { this.vel.x += fx; this.vel.y += fy; };
  Pt.prototype.step = function (damp) { this.vel.mult(damp); var s = this.vel.mag(); if (s > 4) this.vel.mult(4 / s); this.pos.add(this.vel); };
  Pt.prototype.collide = function (neighbors, str) {
    for (var k = 0; k < neighbors.length; k++) {
      var o = neighbors[k]; if (o === this || o.id === this.id) continue;
      var dx = o.pos.x - this.pos.x, dy = o.pos.y - this.pos.y, d = sqrt(dx * dx + dy * dy);
      var minD = this.r + o.r + PARAMS.gap;
      if (d < minD && d > 0.1) { var f = (minD - d) * str / d; this.push(-dx * f, -dy * f); o.push(dx * f, dy * f); }
    }
  };
  Pt.prototype.walls = function (w, h) {
    var m = 8;
    if (this.pos.x < m) { this.pos.x = m; this.vel.x = abs(this.vel.x) * 0.3; }
    if (this.pos.x > w - m) { this.pos.x = w - m; this.vel.x = -abs(this.vel.x) * 0.3; }
    if (this.pos.y < m) { this.pos.y = m; this.vel.y = abs(this.vel.y) * 0.3; }
    if (this.pos.y > h - m) { this.pos.y = h - m; this.vel.y = -abs(this.vel.y) * 0.3; }
  };

  function Sp(a, b, k, d, reach) { this.a = a; this.b = b; this.fullRest = a.pos.dist(b.pos); this.rest = this.fullRest; this.k = k; this.d = d; this._reach = reach || 1; }
  Sp.prototype.update = function () {
    var dx = this.b.pos.x - this.a.pos.x, dy = this.b.pos.y - this.a.pos.y, dist = sqrt(dx * dx + dy * dy) || 0.001;
    var f = this.k * (dist - this.rest) / dist;
    this.a.push(dx * f, dy * f); this.b.push(-dx * f, -dy * f);
    var dvx = (this.a.vel.x - this.b.vel.x) * this.d, dvy = (this.a.vel.y - this.b.vel.y) * this.d;
    this.a.push(-dvx, -dvy); this.b.push(dvx, dvy);
  };

  /* ---------------- blob (SDF boundary → soft-body ring) ------------------ */
  function Blob(cx, cy, radius, type, rot, id, startPct) {
    this.particles = []; this.springs = []; this.outer = []; this.type = type;
    var N = 40, M = 20, outer = [], inner = [], i;
    for (i = 0; i < N; i++) {
      var a = (i / N) * TWO_PI, bR = this.boundary(type, a) * radius;
      var p = new Pt(cx + cos(a + rot) * bR * startPct, cy + sin(a + rot) * bR * startPct, id);
      outer.push(p); this.particles.push(p);
    }
    this.outer = outer;
    var centerInside = this.sdf(type, 0, 0) < 0;
    for (i = 0; i < M; i++) {
      var ai = (i / M) * TWO_PI, br;
      if (centerInside) br = this.boundary(type, ai) * radius * 0.5;
      else br = this.innerBoundary(type, ai) * radius;
      var pi = new Pt(cx + cos(ai + rot) * br * startPct, cy + sin(ai + rot) * br * startPct, id);
      inner.push(pi); this.particles.push(pi);
    }
    this.innerRing = inner; this.isRing = !centerInside;
    var center = new Pt(cx, cy, id);
    if (centerInside) this.particles.push(center);
    var r;
    for (r = 1; r <= 4; r++) for (i = 0; i < N; i++) this.springs.push(new Sp(outer[i], outer[(i + r) % N], 0.5 / r, 0.08, r));
    for (r = 1; r <= 3; r++) for (i = 0; i < M; i++) this.springs.push(new Sp(inner[i], inner[(i + r) % M], 0.4 / r, 0.08, r));
    for (i = 0; i < M; i++) { var j = round((i / M) * N) % N; var offs = [0, 1, -1]; for (var o = 0; o < 3; o++) this.springs.push(new Sp(inner[i], outer[(j + offs[o] + N) % N], 0.4, 0.08, 1)); }
    if (centerInside) for (i = 0; i < inner.length; i++) this.springs.push(new Sp(center, inner[i], 0.3, 0.08, 1));
    for (i = 0; i < this.springs.length; i++) { var s = this.springs[i]; s.fullRest = s.fullRest / max(0.1, startPct); s.rest = s.fullRest * startPct; }
  }
  Blob.prototype.boundary = function (type, angle) {
    var dx = cos(angle), dy = sin(angle), foundInside = false, t;
    for (t = 0.05; t <= 1.5; t += 0.05) { if (this.sdf(type, dx * t, dy * t) < 0) { foundInside = true; break; } }
    if (!foundInside) return 0.5;
    var lo = 0.01, hi = 1.5;
    while (this.sdf(type, dx * hi, dy * hi) < 0 && hi < 3) hi += 0.5;
    for (t = hi - 0.05; t > 0; t -= 0.05) { if (this.sdf(type, dx * t, dy * t) < 0) { lo = t; break; } }
    for (var i = 0; i < 15; i++) { var mid = (lo + hi) / 2; if (this.sdf(type, dx * mid, dy * mid) < 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };
  Blob.prototype.innerBoundary = function (type, angle) {
    var dx = cos(angle), dy = sin(angle), lo = 0.01, hi = 1.5, t;
    for (t = 0.05; t < 1.5; t += 0.02) { if (this.sdf(type, dx * t, dy * t) < 0) { hi = t; break; } }
    lo = max(0.01, hi - 0.1);
    for (var i = 0; i < 15; i++) { var mid = (lo + hi) / 2; if (this.sdf(type, dx * mid, dy * mid) > 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };
  Blob.prototype.sdf = function (t, x, y) {
    switch (t) {
      case 'circle': return sqrt(x * x + y * y) - 1;
      case 'star5': return sqrt(x * x + y * y) - (0.45 + (cos(5 * atan2(y, x)) * 0.5 + 0.5) * 0.55);
      case 'triangle': {
        var r = 1.7, v0x = 0, v0y = -0.9, v1x = 0.78, v1y = 0.45, v2x = -0.78, v2y = 0.45;
        var d0 = sqrt((x - v0x) * (x - v0x) + (y - v0y) * (y - v0y)) - r;
        var d1 = sqrt((x - v1x) * (x - v1x) + (y - v1y) * (y - v1y)) - r;
        var d2 = sqrt((x - v2x) * (x - v2x) + (y - v2y) * (y - v2y)) - r;
        return max(d0, max(d1, d2));
      }
      case 'pill': { var cyy = constrain(y, -0.6, 0.6); return sqrt(x * x + (y - cyy) * (y - cyy)) - 0.4; }
      case 'doughnut': return abs(sqrt(x * x + y * y) - 0.65) - 0.28;
      case 'blob': { var b1 = sqrt((x - 0.45) * (x - 0.45) + y * y) - 0.4, b2 = sqrt((x + 0.45) * (x + 0.45) + y * y) - 0.4, k = 0.4, hh = max(k - abs(b1 - b2), 0) / k; return min(b1, b2) - hh * hh * hh * k * (1.0 / 6.0); }
      default: return sqrt(x * x + y * y) - 1;
    }
  };

  /* ---------------- spatial grid (broad-phase) ---------------------------- */
  function SpatialGrid(w, h, cs) {
    this.cs = cs; this.cols = ceil(w / cs); this.rows = ceil(h / cs);
    this.cells = [];
    for (var x = 0; x < this.cols; x++) { var col = []; for (var y = 0; y < this.rows; y++) col.push([]); this.cells.push(col); }
  }
  SpatialGrid.prototype.clear = function () { for (var x = 0; x < this.cols; x++) for (var y = 0; y < this.rows; y++) this.cells[x][y].length = 0; };
  SpatialGrid.prototype.addParticle = function (p) { var cx = constrain(floor(p.pos.x / this.cs), 0, this.cols - 1), cy = constrain(floor(p.pos.y / this.cs), 0, this.rows - 1); this.cells[cx][cy].push(p); };
  SpatialGrid.prototype.getNeighbors = function (p) {
    var cx = floor(p.pos.x / this.cs), cy = floor(p.pos.y / this.cs), r = [];
    for (var x = max(0, cx - 1); x <= min(this.cols - 1, cx + 1); x++) for (var y = max(0, cy - 1); y <= min(this.rows - 1, cy + 1); y++) { var cell = this.cells[x][y]; for (var i = 0; i < cell.length; i++) r.push(cell[i]); }
    return r;
  };

  /* ---------------- generation + simulation ------------------------------- */
  function buildBlobs(rng, count) {
    var blobs = [], types = shuffle(rng, SHAPES), startPct = PARAMS.startPct / 100, baseRadius = PARAMS.radius, i;
    count = min(count, 6);
    var sizes = [];
    if (count > 1) {
      // one slightly larger anchor + others, but kept in a tight band so no
      // shape reads as jarringly tiny next to the rest.
      sizes.push(baseRadius * (0.9 + rng() * 0.12));        // anchor 0.90–1.02
      for (i = 1; i < count; i++) sizes.push(baseRadius * (0.66 + rng() * 0.22)); // others 0.66–0.88
      for (i = sizes.length - 1; i > 0; i--) { var j = floor(rng() * (i + 1)); var t = sizes[i]; sizes[i] = sizes[j]; sizes[j] = t; }
    } else { for (i = 0; i < count; i++) sizes.push(baseRadius + (rng() * 16 - 8)); }
    for (i = 0; i < count; i++) {
      var angle = (i / count) * TWO_PI + (rng() * 0.6 - 0.3);
      var spread = FRAME * (PARAMS.spread / 100);
      var cx = FRAME / 2 + cos(angle) * spread, cy = FRAME / 2 + sin(angle) * spread;
      blobs.push(new Blob(cx, cy, sizes[i], types[i % types.length], rng() * TWO_PI, i, startPct));
    }
    return blobs;
  }
  function stepPhysics(blobs, grid, growT) {
    var growSpd = PARAMS.growSpd, springK = PARAMS.springK, collStr = PARAMS.collision, damp = PARAMS.damping, startPct = PARAMS.startPct / 100, grav = PARAMS.grav, cx = FRAME / 2, cy = FRAME / 2, b, bl, i;
    for (var step = 0; step < 4; step++) {
      if (growT < 1) growT = min(1, growT + growSpd);
      var scale = startPct + (1 - startPct) * growT;
      for (b = 0; b < blobs.length; b++) { bl = blobs[b]; for (i = 0; i < bl.springs.length; i++) bl.springs[i].rest = bl.springs[i].fullRest * scale; }
      for (b = 0; b < blobs.length; b++) { bl = blobs[b]; for (i = 0; i < bl.particles.length; i++) { var pt = bl.particles[i]; pt.push((cx - pt.pos.x) * grav, (cy - pt.pos.y) * grav); } }
      for (b = 0; b < blobs.length; b++) { bl = blobs[b]; for (i = 0; i < bl.springs.length; i++) { var sp = bl.springs[i]; sp.k = springK / sp._reach; sp.update(); } }
      grid.clear();
      for (b = 0; b < blobs.length; b++) { bl = blobs[b]; for (i = 0; i < bl.particles.length; i++) grid.addParticle(bl.particles[i]); }
      for (b = 0; b < blobs.length; b++) { bl = blobs[b]; for (i = 0; i < bl.particles.length; i++) { var p = bl.particles[i]; p.collide(grid.getNeighbors(p), collStr); p.walls(FRAME, FRAME); p.step(damp); } }
    }
    return growT;
  }
  function totalVel(blobs) { var v = 0, b, i; for (b = 0; b < blobs.length; b++) { var bl = blobs[b]; for (i = 0; i < bl.particles.length; i++) v += abs(bl.particles[i].vel.x) + abs(bl.particles[i].vel.y); } return v; }

  /* ---------------- rendering --------------------------------------------- */
  function traceRing(ctx, ring, reverse) {
    var n = ring.length, i, p0, p1, p2, p3;
    if (!reverse) {
      for (i = 0; i < n; i++) { p0 = ring[(i - 1 + n) % n]; p1 = ring[i]; p2 = ring[(i + 1) % n]; p3 = ring[(i + 2) % n]; if (i === 0) ctx.moveTo(p1.pos.x, p1.pos.y); ctx.bezierCurveTo(p1.pos.x + (p2.pos.x - p0.pos.x) / 6, p1.pos.y + (p2.pos.y - p0.pos.y) / 6, p2.pos.x - (p3.pos.x - p1.pos.x) / 6, p2.pos.y - (p3.pos.y - p1.pos.y) / 6, p2.pos.x, p2.pos.y); }
    } else {
      for (i = n - 1; i >= 0; i--) { p0 = ring[(i + 1) % n]; p1 = ring[i]; p2 = ring[(i - 1 + n) % n]; p3 = ring[(i - 2 + n) % n]; if (i === n - 1) ctx.moveTo(p1.pos.x, p1.pos.y); ctx.bezierCurveTo(p1.pos.x + (p2.pos.x - p0.pos.x) / 6, p1.pos.y + (p2.pos.y - p0.pos.y) / 6, p2.pos.x - (p3.pos.x - p1.pos.x) / 6, p2.pos.y - (p3.pos.y - p1.pos.y) / 6, p2.pos.x, p2.pos.y); }
    }
  }
  function drawBlob(ctx, blob, color, bgCol, transparent) {
    ctx.beginPath();
    traceRing(ctx, blob.outer, false); ctx.closePath();
    ctx.fillStyle = color;
    if (blob.isRing && blob.innerRing.length > 2) { traceRing(ctx, blob.innerRing, true); ctx.closePath(); ctx.fill('evenodd'); }
    else ctx.fill();
    if (PARAMS.gap > 0.5 && !transparent) { ctx.beginPath(); traceRing(ctx, blob.outer, false); ctx.closePath(); ctx.strokeStyle = bgCol; ctx.lineWidth = max(1, PARAMS.gap * 0.5); ctx.stroke(); }
  }
  function drawFrame(ctx, blobs, colors, bgCol, transparent, size, dpr) {
    var sc = dpr * size / FRAME;
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    ctx.clearRect(0, 0, FRAME, FRAME);
    if (!transparent) { ctx.fillStyle = bgCol; ctx.fillRect(0, 0, FRAME, FRAME); }
    for (var i = 0; i < blobs.length; i++) drawBlob(ctx, blobs[i], colors[i % colors.length] || '#fff', bgCol, transparent);
  }

  /* ---------------- instance ---------------------------------------------- */
  function Instance(canvas, options) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this._raf = 0; this.opts = {}; this.update(options || {}); }
  Instance.prototype._merge = function (o) {
    var p = this.opts, el = this.canvas;
    if ('seed' in o) p.seed = o.seed;
    if ('shapes' in o) p.shapes = constrain(o.shapes | 0, 1, 6);
    if ('scheme' in o) p.scheme = o.scheme;
    if ('color' in o) p.color = o.color;
    if ('colors' in o) p.colors = o.colors;   // explicit per-shape override
    if ('background' in o) p.background = o.background;
    if ('size' in o) p.size = o.size;
    if ('animate' in o) p.animate = o.animate;
    if (p.seed == null) p.seed = 'dds';
    if (p.shapes == null) p.shapes = 3;
    if (p.scheme == null) p.scheme = 'mono';
    if (p.color == null) p.color = '#3366FF';
    if (p.background == null) p.background = 'transparent';
    if (p.size == null) p.size = (+el.getAttribute('width')) || el.clientWidth || 256;
    if (p.animate == null) p.animate = true;
  };
  Instance.prototype.update = function (o) {
    this._merge(o || {});
    var p = this.opts, el = this.canvas;
    var transparent = (p.background === 'transparent');
    var bgCol = transparent ? (resolveColor('var(--canvas)', el) || '#E9E7E3') : resolveColor(p.background, el);
    var base = resolveColor(p.color, el);
    var rng = mulberry32(hashSeed(p.seed));
    this._blobs = buildBlobs(rng, p.shapes);
    if (p.colors && p.colors.length) {
      this._colors = [];
      for (var ci = 0; ci < p.shapes; ci++) this._colors.push(resolveColor(p.colors[ci % p.colors.length], el));
    } else {
      this._colors = schemeColors(rng, p.scheme, p.shapes, base, bgCol).map(function (c) { return resolveColor(c, el); });
    }
    this._bgCol = bgCol; this._transparent = transparent;
    var dpr = min(global.devicePixelRatio || 1, 2);
    this._dpr = dpr; this._size = p.size;
    el.width = p.size * dpr; el.height = p.size * dpr; el.style.width = p.size + 'px'; el.style.height = p.size + 'px';
    this._grid = new SpatialGrid(FRAME, FRAME, 15);
    this._growT = 0; this._stop();
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (p.animate && !reduce) this._loop();
    else { var guard = 0; while ((this._growT < 1 || totalVel(this._blobs) >= 0.5) && guard < 600) { this._growT = stepPhysics(this._blobs, this._grid, this._growT); guard++; } this._render(); }
    return this;
  };
  Instance.prototype._render = function () { drawFrame(this.ctx, this._blobs, this._colors, this._bgCol, this._transparent, this._size, this._dpr); };
  Instance.prototype.getShapes = function () { var out = [], n = this._blobs.length; for (var i = 0; i < n; i++) out.push({ type: this._blobs[i].type, color: this._colors[i % this._colors.length] }); return out; };
  // Recompute colours/background and repaint the CURRENT shapes — no rebuild, no re-animation.
  Instance.prototype.recolor = function (o) {
    if (!this._blobs) return this.update(o);
    this._merge(o || {});
    var p = this.opts, el = this.canvas;
    var transparent = (p.background === 'transparent');
    var bgCol = transparent ? (resolveColor('var(--canvas)', el) || '#E9E7E3') : resolveColor(p.background, el);
    var base = resolveColor(p.color, el);
    if (p.colors && p.colors.length) {
      this._colors = [];
      for (var ci = 0; ci < p.shapes; ci++) this._colors.push(resolveColor(p.colors[ci % p.colors.length], el));
    } else {
      var rng = mulberry32(hashSeed(p.seed));
      buildBlobs(rng, p.shapes);   // advance the RNG to the colour step (no physics, no animation)
      this._colors = schemeColors(rng, p.scheme, p.shapes, base, bgCol).map(function (c) { return resolveColor(c, el); });
    }
    this._bgCol = bgCol; this._transparent = transparent;
    this._render();
    return this;
  };
  Instance.prototype._loop = function () {
    var self = this;
    function frame() { self._growT = stepPhysics(self._blobs, self._grid, self._growT); self._render(); if (self._growT >= 1 && totalVel(self._blobs) < 0.5) { self._raf = 0; return; } self._raf = global.requestAnimationFrame(frame); }
    this._raf = global.requestAnimationFrame(frame);
  };
  Instance.prototype._stop = function () { if (this._raf) { global.cancelAnimationFrame(this._raf); this._raf = 0; } };
  Instance.prototype.randomize = function () { return this.update({ seed: Math.random().toString(36).slice(2, 10) }); };
  Instance.prototype.toDataURL = function (size) {
    var s = size || this._size, off = document.createElement('canvas'); off.width = s; off.height = s;
    var ctx = off.getContext('2d');
    var rng = mulberry32(hashSeed(this.opts.seed)), blobs = buildBlobs(rng, this.opts.shapes), grid = new SpatialGrid(FRAME, FRAME, 15), g = 0, guard = 0;
    while ((g < 1 || totalVel(blobs) >= 0.5) && guard < 600) { g = stepPhysics(blobs, grid, g); guard++; }
    drawFrame(ctx, blobs, this._colors, this._bgCol, this._transparent, s, 1);
    return off.toDataURL('image/png');
  };
  Instance.prototype.destroy = function () { this._stop(); };

  /* ---------------- public API -------------------------------------------- */
  function readAttrs(c) {
    return {
      seed: c.getAttribute('data-seed') || c.getAttribute('seed') || undefined,
      shapes: +c.getAttribute('data-shapes') || undefined,
      scheme: c.getAttribute('data-scheme') || undefined,
      color: c.getAttribute('data-color') || undefined,
      background: c.getAttribute('data-background') || undefined,
      size: +c.getAttribute('data-size') || undefined,
      animate: c.getAttribute('data-animate') !== 'false'
    };
  }
  var DDSIcon = {
    PARAMS: PARAMS, ACCENTS: ACCENTS,
    create: function (canvas, options) { return new Instance(canvas, options); },
    render: function (canvas, options) { var o = {}; for (var k in (options || {})) o[k] = options[k]; o.animate = false; return new Instance(canvas, o); },
    toDataURL: function (options) { var c = document.createElement('canvas'); var o = {}; for (var k in (options || {})) o[k] = options[k]; o.animate = false; var inst = new Instance(c, o); return inst.toDataURL((options && options.size) || 256); },
    auto: function (root) { var els = (root || document).querySelectorAll('canvas[data-dds-icon]'); for (var i = 0; i < els.length; i++) DDSIcon.create(els[i], readAttrs(els[i])); return DDSIcon; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DDSIcon;
  global.DDSIcon = DDSIcon;
})(typeof window !== 'undefined' ? window : this);
