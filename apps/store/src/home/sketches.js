/*
 * Maison N'Ait - five generative canvas sketches: rose, blossom, cedar, amber, oud.
 * Ported as is from the one-page site (src/sketches.js); only the wrapper changed: the
 * drawings are ES module exports instead of a window global.
 *
 * SKETCHES.<name>(ctx, w, h, t) draws one complete frame on a transparent background. Each
 * sketch is a pure function of (w, h, t): the random-looking data is seeded once at load, so
 * nothing flickers and every motion loops seamlessly.
 */

var TAU = Math.PI * 2, IVORY = '#F4EEDF';

// Two palettes. The dark theme keeps the original colours; the light theme maps them to gold and black.
var LIGHT = false;
var PAL_HEX = { '#D96B7A': '#C9A227', '#F4EEDE': '#8E6B12', '#161D5C': '#0B0B0C', '#E99A2B': '#C9A227', '#6F8A5B': '#C2A23A',
            '#E7D9B8': '#E9CE7E', '#FFC766': '#F1DC9B', '#FFE2A6': '#9A7412' };
var PAL_RGB = { '217,107,122': '201,162,39', '242,167,176': '233,206,126', '255,199,102': '241,220,155', '233,154,43': '201,162,39',
            '168,92,18': '142,107,18', '255,226,166': '255,244,214', '205,211,224': '247,242,230' };
function tone(v) { return LIGHT ? (PAL_HEX[v] || v) : v; }
function toneA(v) { return 'rgba(' + (LIGHT ? (PAL_RGB[v] || v) : v) + ','; }

// mulberry32: small seeded PRNG, used for static data only (never at draw time).
function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a, b, k) { return a + (b - a) * k; }

// 'rgba(r,g,b,' prefix of a hex colour, optionally mixed towards a second one.
function rgb(hex, hex2, k) {
  var a = parseInt(hex.slice(1), 16), b = hex2 ? parseInt(hex2.slice(1), 16) : a;
  return 'rgba(' + [16, 8, 0].map(function (s) {
    return Math.round(lerp((a >> s) & 255, (b >> s) & 255, k || 0));
  }).join(',') + ',';
}

// Thin line work: 1 px on a 240 px panel, up to 1.5 px on a 520 px one.
function lineW(m) { return Math.max(1, Math.min(1.5, m / 340)); }

// ---- 1. rose: concentric rings of overlapping teardrop petals ---------------
var ROSE_N = 8, ROSE_HW = 0.38, ROSE_RINGS = 5, roseRings = [], roseStray = [];
(function () {
  var rnd = mulberry32(11), i, k, tilt;
  for (i = 0; i < ROSE_RINGS; i++) {
    k = i / (ROSE_RINGS - 1);                      // 0 = outer ring, 1 = heart
    roseRings.push({
      k: k, tip: lerp(1, 0.29, k), rot: i * Math.PI / ROSE_N,   // half-petal offset
      dir: i % 2 ? -1 : 1, col: rgb('#F2A7B0', '#D96B7A', k), colL: rgb('#F1DC9B', '#C9A227', k)
    });
  }
  for (i = 0; i < 4; i++) {                        // detached petals, evenly spread
    tilt = rnd() * TAU;
    roseStray.push({
      a: 0.4 + 0.025 * rnd(), b: 0.35 + 0.03 * rnd(), tilt: tilt, ph: i * TAU / 4 - tilt + 0.5 * rnd(),
      spin: 0.1 + 0.08 * rnd(), len: 0.055 + 0.02 * rnd()
    });
  }
})();

// Teardrop petal along +x: narrow base at b, softly pointed tip at T, half-width hw.
function petal(ctx, b, T, hw) {
  var L = T - b, x1 = b + 0.2 * L, x2 = T - (0.1 + 0.75 * (hw / T - 0.36)) * L, y2 = 1.62 * hw;
  ctx.beginPath();
  ctx.moveTo(b, 0);
  ctx.bezierCurveTo(x1, hw, x2, y2, T, 0);
  ctx.bezierCurveTo(x2, -y2, x1, -hw, b, 0);
}

function rose(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  var m = Math.min(w, h), lw = lineW(m), breath = Math.sin(t * 0.8), R = m * 0.32 * (1 + 0.02 * breath);
  var i, j, q, T, b, hw, g, a, r, step, len;
  ctx.translate(w / 2, h / 2);
  ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.strokeStyle = tone('#F4EEDE');
  for (i = 0; i < ROSE_RINGS; i++) {               // outer ring first, heart last
    q = roseRings[i];
    T = R * q.tip * (1 + 0.03 * breath * (1 - q.k)); // outer rings open a little more
    b = T * 0.25; hw = T * ROSE_HW * (1 + 0.04 * breath);
    step = q.dir * TAU / ROSE_N;
    g = ctx.createRadialGradient(0, 0, T * 0.45, 0, 0, T);   // deep at the base, light at the tip
    g.addColorStop(0, toneA('217,107,122') + '0.92)'); g.addColorStop(1, (LIGHT ? q.colL : q.col) + '0.88)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.rotate(q.rot + q.dir * t * 0.02);          // neighbouring rings counter-rotate
    for (j = 0; j < ROSE_N; j++) { petal(ctx, b, T, hw); ctx.fill(); ctx.stroke(); ctx.rotate(step); }
    ctx.rotate(-step); petal(ctx, b, T + lw, hw + lw); ctx.clip();   // close the weave: the first
    ctx.rotate(step); petal(ctx, b, T, hw); ctx.fill(); ctx.stroke(); // petal overlaps the last one
    ctx.restore();
  }
  r = R * 0.13;                                    // heart: an ivory spiral on a deep rose disc
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = toneA('217,107,122') + '0.95)'; ctx.fill(); ctx.stroke();
  ctx.beginPath();
  for (j = 0; j <= 30; j++) {
    a = j * 0.42 + t * 0.02;
    ctx.lineTo(Math.cos(a) * r * j / 30, Math.sin(a) * r * j / 30);
  }
  ctx.stroke();
  ctx.fillStyle = toneA('242,167,176') + '0.72)';
  for (i = 0; i < roseStray.length; i++) {         // detached petals on slow elliptical orbits
    q = roseStray[i]; a = q.ph + 0.06 * t; len = q.len * m;
    ctx.save();
    ctx.rotate(q.tilt);
    ctx.translate(Math.cos(a) * q.a * m, Math.sin(a) * q.b * m);
    ctx.rotate(q.ph * 3 + q.spin * t);
    petal(ctx, -len / 2, len / 2, len * 0.36); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// ---- 2. blossom: scattered five-petal orange blossom ------------------------
var INDIGO = '#161D5C', AMBER = '#E99A2B', LEAF = '#6F8A5B';
var BLOSSOMS = [ // x, y, radius (units of min(w, h), origin at the centre), spin in rad/s
  [-0.10, -0.06, 0.170, 0.030], [0.23, -0.22, 0.118, -0.045], [0.17, 0.19, 0.132, 0.040],
  [-0.28, 0.22, 0.100, -0.055], [-0.30, -0.30, 0.078, 0.070], [0.04, -0.37, 0.062, -0.080],
  [0.38, 0.00, 0.060, 0.090], [-0.06, 0.36, 0.066, 0.075], [0.36, 0.37, 0.050, -0.095]
];
var LEAVES = [ // base x, y, direction (rad), length
  [-0.20, -0.02, 3.5, 0.25], [0.15, 0.25, 1.75, 0.20], [0.26, -0.26, -0.87, 0.20]
];
var pollen = [];
(function () {
  var rnd = mulberry32(23), i;
  for (i = 0; i < 14; i++) {
    pollen.push({ x: (rnd() - 0.5) * 0.84, v: 0.018 + 0.02 * rnd(), ph: rnd(), r: 0.004 + 0.004 * rnd(), sw: rnd() * TAU });
  }
})();

function blossom(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  var m = Math.min(w, h), lw = lineW(m), i, j, f, R, L, b, hw, x1, x2, p, k;
  ctx.translate(w / 2, h / 2);
  ctx.lineWidth = lw; ctx.lineJoin = 'round';
  for (i = 0; i < LEAVES.length; i++) {            // leaves sway gently behind the flowers
    f = LEAVES[i]; L = f[3] * m;
    ctx.save();
    ctx.translate(f[0] * m, f[1] * m);
    ctx.rotate(f[2] + 0.04 * Math.sin(t * 0.5 + i * 2));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(L * 0.45, L * 0.38, L, 0);
    ctx.quadraticCurveTo(L * 0.45, -L * 0.38, 0, 0);
    ctx.fillStyle = tone(LEAF); ctx.fill();
    ctx.moveTo(0, 0); ctx.lineTo(L * 0.9, 0);      // midrib
    ctx.strokeStyle = tone(INDIGO); ctx.globalAlpha = 0.55; ctx.stroke();
    ctx.restore();
  }
  for (i = 0; i < BLOSSOMS.length; i++) {
    f = BLOSSOMS[i]; R = f[2] * m; b = R * 0.1; L = R - b; hw = R * 0.26;
    x1 = b + 0.25 * L; x2 = R - 0.28 * L;
    ctx.save();
    ctx.translate(f[0] * m + 0.006 * m * Math.cos(t * 0.45 + i * 1.7),   // slight bob
      f[1] * m + 0.01 * m * Math.sin(t * 0.6 + i * 2.3));
    ctx.rotate(i * 1.3 + f[3] * t);
    ctx.beginPath();                               // five lens petals as one path
    for (j = 0; j < 5; j++) {
      ctx.moveTo(b, 0);
      ctx.bezierCurveTo(x1, hw * 1.3, x2, hw * 1.25, R, 0);
      ctx.bezierCurveTo(x2, -hw * 1.25, x1, -hw * 1.3, b, 0);
      ctx.rotate(TAU / 5);
    }
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.strokeStyle = tone(INDIGO); ctx.stroke();
    ctx.beginPath();                               // faint petal veins
    for (j = 0; j < 5; j++) { ctx.moveTo(R * 0.42, 0); ctx.lineTo(R * 0.74, 0); ctx.rotate(TAU / 5); }
    ctx.globalAlpha = 0.22; ctx.stroke();
    ctx.beginPath();                               // stamens: a dotted ring
    ctx.arc(0, 0, R * 0.29, 0, TAU);
    ctx.setLineDash([0.01, R * 0.29 * TAU / 10 - 0.01]);
    ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.4, R * 0.06);
    ctx.strokeStyle = tone(AMBER); ctx.globalAlpha = 1; ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = lw;
    ctx.beginPath();                               // amber centre
    ctx.arc(0, 0, R * 0.15, 0, TAU);
    ctx.fillStyle = tone(AMBER); ctx.fill();
    ctx.strokeStyle = tone(INDIGO); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = tone(AMBER);
  for (i = 0; i < pollen.length; i++) {            // pollen rises, faded in and out at the ends
    p = pollen[i]; k = (t * p.v + p.ph) % 1;
    ctx.globalAlpha = 0.85 * Math.sin(Math.PI * k);
    ctx.beginPath();
    ctx.arc((p.x + 0.012 * Math.sin(t * 0.5 + p.sw)) * m, (0.43 - 0.86 * k) * m, p.r * m, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ---- 3. cedar: growth rings of a trunk cross-section ------------------------
var WOOD = '#E7D9B8', GLOW = '#FFC766';
var CEDAR_K = 20, CEDAR_N = 16;                    // control points per ring; growth rings (index N = bark)
var cedarF = [], cedarX = [], cedarY = [], cedarA = [], cedarW = [], cedarCracks = [], pithX = 0, pithY = 0;
(function () {
  var rnd = mulberry32(5), ph = [], gaps = [], sum = 0, mx = 0, my = 0, max = 0;
  var i, k, f, th, r, psi, xs, ys, a, len, c, s, bend, wd;
  for (i = 0; i < 4; i++) ph.push(rnd() * TAU);
  for (i = 0; i < CEDAR_N - 1; i++) { gaps.push(0.55 + rnd()); sum += gaps[i]; }
  for (i = 0, f = 0.055; i <= CEDAR_N; i++) {      // irregular ring spacing, bark at 1
    cedarF.push(i < CEDAR_N ? f : 1);
    if (i < CEDAR_N - 1) f += gaps[i] / sum * 0.85;
  }
  for (i = 0; i <= CEDAR_N; i++) {
    f = cedarF[i]; psi = rnd() * TAU; xs = []; ys = [];
    for (k = 0; k < CEDAR_K; k++) {                // smooth low-frequency wobble, growing outwards
      th = k / CEDAR_K * TAU;
      r = f + Math.pow(f, 1.3) * (0.045 * Math.cos(th + ph[0] + 0.8 * f) + 0.026 * Math.cos(2 * th + ph[1] - 1.5 * f) +
        0.017 * Math.cos(3 * th + ph[2] + 2 * f) + 0.011 * Math.cos(5 * th + ph[3] - 2.5 * f)) +
        0.007 * Math.min(1, f * 4) * Math.cos(4 * th + psi);
      xs.push(r * Math.cos(th)); ys.push(r * Math.sin(th));
    }
    cedarX.push(xs); cedarY.push(ys);
    cedarA.push(i === CEDAR_N ? 0.95 : i % 4 === 3 ? 0.8 : 0.28 + 0.4 * rnd());
    cedarW.push(i === CEDAR_N ? 1.9 : i % 4 === 3 ? 1.4 : 0.7 + 0.5 * rnd());
  }
  // Centre the bark on the origin and scale it to unit radius (the pith sits slightly off-centre).
  for (k = 0; k < CEDAR_K; k++) { mx += cedarX[CEDAR_N][k] / CEDAR_K; my += cedarY[CEDAR_N][k] / CEDAR_K; }
  for (k = 0; k < CEDAR_K; k++) max = Math.max(max, Math.hypot(cedarX[CEDAR_N][k] - mx, cedarY[CEDAR_N][k] - my));
  for (i = 0; i <= CEDAR_N; i++) {
    for (k = 0; k < CEDAR_K; k++) { cedarX[i][k] = (cedarX[i][k] - mx) / max; cedarY[i][k] = (cedarY[i][k] - my) / max; }
  }
  pithX = -mx / max; pithY = -my / max;
  [0.58, 0.2, 0.33, 0.14].forEach(function (len, i) {   // radial cracks: bent wedges opening at the pith
    a = 0.6 + (i + 0.7 * rnd()) * TAU / 4; c = Math.cos(a); s = Math.sin(a);
    bend = (rnd() - 0.5) * 0.14 * len; wd = 0.007 + 0.012 * len;
    cedarCracks.push([pithX - s * wd, pithY + c * wd, pithX + s * wd, pithY - c * wd,
      pithX + c * len * 0.5 - s * (bend + wd * 0.5), pithY + s * len * 0.5 + c * (bend + wd * 0.5),
      pithX + c * len * 0.5 - s * (bend - wd * 0.5), pithY + s * len * 0.5 + c * (bend - wd * 0.5),
      pithX + c * len + s * bend, pithY + s * len - c * bend]);
  });
})();

// Smooth closed curve through ring i, blended a fraction k towards ring i + 1.
function cedarRing(ctx, i, k) {
  var X0 = cedarX[i], Y0 = cedarY[i], X1 = cedarX[i + 1] || X0, Y1 = cedarY[i + 1] || Y0;
  var K = CEDAR_K, j, n, x, y, px = 0, py = 0;
  ctx.beginPath();
  for (j = -1; j <= K; j++) {
    n = (j + K) % K; x = lerp(X0[n], X1[n], k); y = lerp(Y0[n], Y1[n], k);
    if (j === 0) ctx.moveTo((px + x) / 2, (py + y) / 2);
    else if (j > 0) ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
    px = x; py = y;
  }
  ctx.closePath();
}

function cedar(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  var m = Math.min(w, h), R = m * 0.43, u = lineW(m) / R, i, d, glow, c;
  var p = (t / 12) % 1, fh = lerp(cedarF[0], 1, p), env = Math.min(1, p / 0.12, (1 - p) / 0.12);
  env = env * env * (3 - 2 * env);                 // highlight fades in at the heart, out at the bark
  ctx.translate(w / 2, h / 2);
  ctx.rotate(t * 0.015);                           // very slow rotation
  ctx.scale(R, R);
  ctx.lineJoin = 'round';
  for (i = CEDAR_N; i >= 0; i--) {                 // bark first, then inwards to the pith
    cedarRing(ctx, i, 0);
    if (i === CEDAR_N || i === 7) { ctx.fillStyle = tone(WOOD); ctx.globalAlpha = 0.07; ctx.fill(); }
    ctx.lineWidth = u * cedarW[i]; ctx.globalAlpha = cedarA[i]; ctx.strokeStyle = tone(WOOD); ctx.stroke();
    d = cedarF[i] - fh;                            // rings near the highlight take an amber afterglow
    glow = env * (d > 0 ? Math.exp(-d * 30) : Math.exp(d * 6));
    if (glow > 0.03) { ctx.globalAlpha = glow * 0.8; ctx.strokeStyle = tone(GLOW); ctx.stroke(); }
  }
  cedarRing(ctx, CEDAR_N - 1, 0.55);               // bark: a band of fine radial hatching
  ctx.setLineDash([0.006, 0.026]);
  ctx.lineWidth = 0.05; ctx.globalAlpha = 0.5; ctx.strokeStyle = tone(WOOD); ctx.stroke();
  ctx.setLineDash([]);
  for (i = 0; i < CEDAR_N - 1 && cedarF[i + 1] < fh; i++) { /* find the rings around the highlight */ }
  cedarRing(ctx, i, (fh - cedarF[i]) / (cedarF[i + 1] - cedarF[i]));
  ctx.strokeStyle = tone(GLOW);                          // soft amber ring: three stacked strokes
  ctx.lineWidth = u * 6; ctx.globalAlpha = 0.14 * env; ctx.stroke();
  ctx.lineWidth = u * 2.8; ctx.globalAlpha = 0.3 * env; ctx.stroke();
  ctx.lineWidth = u * 1.2; ctx.globalAlpha = 0.95 * env; ctx.stroke();
  ctx.lineWidth = u * 0.8; ctx.strokeStyle = tone(WOOD);
  for (i = 0; i < cedarCracks.length; i++) {       // cracks are cut out of the rings, then outlined
    c = cedarCracks[i];
    ctx.beginPath();
    ctx.moveTo(c[0], c[1]); ctx.quadraticCurveTo(c[4], c[5], c[8], c[9]);
    ctx.quadraticCurveTo(c[6], c[7], c[2], c[3]);
    ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = 1; ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.5; ctx.stroke();
  }
  ctx.beginPath();                                 // pith
  ctx.arc(pithX, pithY, 0.014, 0, TAU);
  ctx.fillStyle = tone(WOOD); ctx.globalAlpha = 0.95; ctx.fill();
  ctx.restore();
}

// ---- 4. amber: loosely stacked isometric cubes of resin ---------------------
var C30 = Math.cos(Math.PI / 6);
// x, y, z, size of each cube in isometric space, listed back to front.
var CUBE_DEFS = [[0, 0, 0, 1], [0.26, 0.18, 1, 0.56], [1.12, 0.22, 0, 0.66], [0.02, 1.18, 0, 0.42]];
// Vertex ids: 0 top-back, 1 top-right, 2 top-front, 3 top-left, 4 bottom-right, 5 bottom-front, 6 bottom-left, 7 hidden.
var TOP = [0, 1, 2, 3], LEFT = [3, 2, 5, 6], RIGHT = [1, 2, 5, 4], HEX = [0, 1, 4, 5, 6, 3];
var EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [2, 5], [1, 4], [3, 6]];
var cubes = [], sparkles = [];
(function () {
  var rnd = mulberry32(42), all = [], lo = [1e9, 1e9], hi = [-1e9, -1e9], fit;
  function iso(x, y, z) {
    var p = [(x - y) * C30, (x + y) * 0.5 - z];
    all.push(p);
    return p;
  }
  CUBE_DEFS.forEach(function (c, n) {
    var x = c[0], y = c[1], z = c[2], s = c[3], q = { s: s, ph: n * TAU / 4 + 0.6, dots: [] }, i;
    q.v = [iso(x, y, z + s), iso(x + s, y, z + s), iso(x + s, y + s, z + s), iso(x, y + s, z + s),
      iso(x + s, y, z), iso(x + s, y + s, z), iso(x, y + s, z), iso(x, y, z)];
    for (i = 0; i < 6; i++) {                      // inclusions trapped in the resin
      q.dots.push({
        p: iso(x + s * (0.15 + 0.7 * rnd()), y + s * (0.15 + 0.7 * rnd()), z + s * (0.15 + 0.7 * rnd())),
        r: s * (0.014 + 0.026 * rnd()), light: i > 3
      });
    }
    cubes.push(q);
  });
  all.forEach(function (p) {
    lo[0] = Math.min(lo[0], p[0]); hi[0] = Math.max(hi[0], p[0]);
    lo[1] = Math.min(lo[1], p[1]); hi[1] = Math.max(hi[1], p[1]);
  });
  fit = Math.max(hi[0] - lo[0], hi[1] - lo[1]);    // fit the pile into a centred unit box
  all.forEach(function (p) { p[0] = (p[0] - (lo[0] + hi[0]) / 2) / fit; p[1] = (p[1] - (lo[1] + hi[1]) / 2) / fit; });
  cubes.forEach(function (q) {
    var i, e, k;
    q.s /= fit;
    q.dots.forEach(function (d) { d.r /= fit; });
    for (i = 0; i < 2; i++) {                      // two sparkle sites on the visible edges
      e = EDGES[(rnd() * EDGES.length) | 0]; k = 0.1 + 0.8 * rnd();
      sparkles.push({ x: lerp(q.v[e[0]][0], q.v[e[1]][0], k), y: lerp(q.v[e[0]][1], q.v[e[1]][1], k), T: 6 + 4 * rnd(), ph: rnd() });
    }
  });
})();

// Polyline through the vertices v[ids[0]], v[ids[1]], ... (added to the current path).
function trace(ctx, v, ids, close) {
  ctx.moveTo(v[ids[0]][0], v[ids[0]][1]);
  for (var i = 1; i < ids.length; i++) ctx.lineTo(v[ids[i]][0], v[ids[i]][1]);
  if (close) ctx.closePath();
}

// Cube face, filled with a linear gradient running between its opposite corners.
function face(ctx, v, ids, c0, c1) {
  var g = ctx.createLinearGradient(v[ids[0]][0], v[ids[0]][1], v[ids[2]][0], v[ids[2]][1]);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.beginPath(); trace(ctx, v, ids, true);
  ctx.fillStyle = g; ctx.fill();
}

function amber(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  var m = Math.min(w, h), S = m * 0.8, u = lineW(m) / S, n, i, q, v, g, d, k, r, x, y, cx, cy;
  ctx.translate(w / 2, h / 2);
  ctx.scale(S, S);
  ctx.lineJoin = 'round';
  for (n = 0; n < cubes.length; n++) {
    q = cubes[n]; v = q.v;
    face(ctx, v, TOP, toneA('255,199,102') + '0.92)', toneA('233,154,43') + '0.82)');
    face(ctx, v, LEFT, toneA('233,154,43') + '0.86)', toneA('168,92,18') + '0.8)');
    face(ctx, v, RIGHT, toneA('168,92,18') + '0.9)', toneA('168,92,18') + '0.62)');
    k = 0.5 + 0.5 * Math.sin(t * 0.75 + q.ph);     // inner glow, out of phase per cube
    cx = (v[2][0] + v[7][0]) / 2; cy = (v[2][1] + v[7][1]) / 2;
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, q.s * 1.1);
    g.addColorStop(0, toneA('255,226,166') + '' + (0.1 + 0.42 * k) + ')');
    g.addColorStop(0.4, toneA('255,199,102') + '' + (0.04 + 0.17 * k) + ')');
    g.addColorStop(1, toneA('255,199,102') + '0)');
    ctx.beginPath(); trace(ctx, v, HEX, true);     // the glow fills the cube's silhouette
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    for (i = 0; i < q.dots.length; i++) {          // inclusions
      d = q.dots[i];
      ctx.beginPath(); ctx.arc(d.p[0], d.p[1], d.r, 0, TAU);
      ctx.fillStyle = d.light ? toneA('255,226,166') + '0.55)' : toneA('168,92,18') + '0.8)'; ctx.fill();
    }
    ctx.strokeStyle = tone('#FFE2A6'); ctx.lineWidth = u;
    ctx.beginPath(); trace(ctx, v, [4, 7, 6]); trace(ctx, v, [7, 0]);
    ctx.globalAlpha = 0.22; ctx.stroke();          // hidden back edges, seen through the resin
    ctx.beginPath(); trace(ctx, v, HEX, true); trace(ctx, v, [1, 2, 3]); trace(ctx, v, [2, 5]);
    ctx.globalAlpha = 0.9; ctx.stroke();           // silhouette and the three front edges
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = tone('#FFE2A6');
  for (i = 0; i < sparkles.length; i++) {          // sparkles bloom and fade on the edges
    q = sparkles[i]; k = Math.sin(TAU * (t / q.T + q.ph));
    if (k <= 0) continue;
    k = k * k * k; r = 0.01 + 0.03 * k; x = q.x; y = q.y;
    ctx.globalAlpha = k;
    ctx.beginPath();                               // four-point star with concave sides
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  }
  ctx.restore();
}

// ---- 5. oud: an ember on its tray, ribbons of smoke -------------------------
var SMOKE = '205,211,224', ribbons = [];
(function () {
  var rnd = mulberry32(77), n = 12, i;
  for (i = 0; i < n; i++) {
    ribbons.push({ u: i / (n - 1) * 2 - 1 + (rnd() - 0.5) * 0.12, ph: rnd() * TAU, g: 0.7 + 0.6 * rnd(), a: 0.4 + 0.6 * rnd() });
  }
})();

function oud(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  var m = Math.min(w, h), lw = lineW(m), N = 22, ty = 0.385 * m, er = 0.014 * m, ey = ty - er, H = 0.83 * m;
  var pulse = 0.5 + 0.5 * Math.sin(t * 1.1), i, j, q, s, e, x, y, px, py, g;
  ctx.translate(w / 2, h / 2);
  g = ctx.createLinearGradient(0, ey, 0, ey - H);  // smoke fades towards the top
  g.addColorStop(0, toneA(SMOKE) + '0)'); g.addColorStop(0.07, toneA(SMOKE) + '0.5)'); g.addColorStop(0.3, toneA(SMOKE) + '0.7)');
  g.addColorStop(0.7, toneA(SMOKE) + '0.36)'); g.addColorStop(1, toneA(SMOKE) + '0)');
  ctx.strokeStyle = g; ctx.lineWidth = lw; ctx.lineCap = 'round';
  for (j = 0; j < ribbons.length; j++) {
    q = ribbons[j];
    ctx.beginPath();
    for (i = 0; i <= N; i++) {                     // flow field: waves travel upwards, widening with height
      s = i / N; e = Math.pow(s, 1.15) * m;
      x = e * (0.07 * Math.sin(7.2 * s - 0.45 * t) + 0.035 * Math.sin(13.5 * s - 0.7 * t + 1.7) +
        0.19 * q.u * Math.cos(4.6 * s - 0.32 * t + 0.8 + 0.6 * q.u) +
        0.03 * q.g * Math.sin(10.5 * s - 0.55 * t + q.ph) + 0.03 * s * Math.sin(17 * s - 0.8 * t + 2 * q.ph));
      y = ey - H * s + e * 0.025 * Math.cos(7.2 * s - 0.45 * t + q.u);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
      px = x; py = y;
    }
    ctx.globalAlpha = q.a; ctx.stroke();
  }
  ctx.strokeStyle = IVORY;                         // tray: a thin line and a shorter foot
  ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.moveTo(-0.16 * m, ty); ctx.lineTo(0.16 * m, ty); ctx.stroke();
  ctx.globalAlpha = 0.45;
  ctx.beginPath(); ctx.moveTo(-0.07 * m, ty + 0.022 * m); ctx.lineTo(0.07 * m, ty + 0.022 * m); ctx.stroke();
  g = ctx.createRadialGradient(0, ey, 0, 0, ey, 0.09 * m);   // ember: pulsing halo and core
  g.addColorStop(0, toneA('255,199,102') + '' + (0.5 + 0.4 * pulse) + ')');
  g.addColorStop(0.35, toneA('233,154,43') + '' + (0.14 + 0.16 * pulse) + ')');
  g.addColorStop(1, toneA('233,154,43') + '0)');
  ctx.globalAlpha = 1; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, ey, 0.09 * m, 0, TAU); ctx.fill();
  ctx.fillStyle = tone('#FFC766');
  ctx.beginPath(); ctx.arc(0, ey, er, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Light theme: gold and black. Dark theme: the original colours. */
export function setLight(value) {
  LIGHT = !!value;
}

export const SKETCHES = { rose: rose, blossom: blossom, cedar: cedar, amber: amber, oud: oud };
