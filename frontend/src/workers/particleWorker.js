/**
 * particleWorker.js — off-main-thread physics (and, where supported, drawing)
 * for the StardustStudent rooftop figure.
 *
 * The worker is a generic engine: it owns the particle state as flat typed
 * arrays and runs the exact spring + repulsion + drift integration that used to
 * live on the main thread. All tunable values (stiffness, damping, repulsion
 * radius, drift, breathing, shimmer, palette) arrive once in the `init` message
 * so this file hard-codes no magic numbers — StardustStudent.jsx remains the
 * single source of truth for "do not change" constants.
 *
 * Two modes, chosen by the main thread:
 *   • 'offscreen' — the canvas was transferred here (OffscreenCanvas). The worker
 *     runs its own rAF loop and does physics AND drawing; the main thread does
 *     nothing per frame. (OPT 2)
 *   • 'transfer'  — no OffscreenCanvas support. The main thread drives an rAF
 *     loop and, each frame, posts { mouseX, mouseY, time, gdx, gdy, breath } with
 *     a recycled output ArrayBuffer (transferable). The worker integrates physics
 *     and writes back [x, y, opacity, colorIndex, isShimmer] per particle for the
 *     main thread to draw. (OPT 1)
 *
 * Either way the physics never touches the main thread.
 */

// ---- constants (received from the main thread on init) -------------------
let cfg = null;

// ---- geometry / mode -----------------------------------------------------
let mode = 'transfer';
let count = 0;
let cx = 0, cy = 0;
let width = 0, height = 0, dpr = 1;

// ---- particle state (typed arrays — OPT 3) -------------------------------
let pos = null;        // Float32Array(count*2)  current x,y
let vel = null;        // Float32Array(count*2)  velocity
let home = null;       // Float32Array(count*2)  rest (spring target)
let repCache = null;   // Float32Array(count*2)  last repulsion force (OPT 5)
let sizeArr = null;    // Float32Array(count)
let colIdxArr = null;  // Uint8Array(count)      0..3 → palette index
let isShimArr = null;  // Uint8Array(count)      1 = shimmer particle
let shimPhaseArr = null; // Float32Array(count)  shimmer wobble phase
let glowArr = null;    // Float32Array(count)    legacy shimmer glow; received but unused by the draw
let bakedAlphaArr = null; // Float32Array(count) baked base alpha
let alphaStepArr = null;  // Uint8Array(count)   0..2 (bulk) / 255 (shimmer)

// ---- drawing (offscreen mode only) ---------------------------------------
let canvas = null, ctx = null;
let groups = null;     // [{ color, indices:Int32Array }] in original draw order
let shimmerIdx = null; // Int32Array

// ---- runtime -------------------------------------------------------------
let cursorX = 0, cursorY = 0, cursorOn = false;
let startedAt = 0;
let raf = null;
let frame = 0;

// ---- OPT 6 adaptive quality (offscreen draw path) ------------------------
let slowStreak = 0, fastStreak = 0, skipEnabled = false, lastT = 0;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
// Median of a small numeric array — one call per colour bucket at build time to
// pick that bucket's single globalAlpha (mirrors the main thread). Copies first.
const median = (values) => {
  if (!values.length) return 1;
  const s = values.slice().sort((a, b) => a - b);
  return s[s.length >> 1];
};

self.onmessage = (e) => {
  const m = e.data;
  switch (m.type) {
    case 'init':       onInit(m); break;
    case 'cursor':     onCursor(m); break;
    case 'visibility': if (m.hidden) stopLoop(); else startLoop(); break;
    case 'showStatic': stopLoop(); if (ctx) drawFrame(0, 1, false); break; // reduced-motion toggle
    case 'tick':       onTick(m); break;
    case 'dispose':    stopLoop(); break;
  }
};

// ---- init ----------------------------------------------------------------
function onInit(m) {
  cfg = m.cfg;
  mode = m.mode;
  count = m.count;
  cx = m.cx; cy = m.cy;
  width = m.width; height = m.height; dpr = m.dpr;

  home = m.home;
  sizeArr = m.size;
  colIdxArr = m.colIdx;
  isShimArr = m.isShimmer;
  shimPhaseArr = m.shimPhase;
  glowArr = m.glow;
  bakedAlphaArr = m.bakedAlpha;
  alphaStepArr = m.alphaStep;

  pos = Float32Array.from(home);       // particles start at rest position
  vel = new Float32Array(count * 2);   // zero velocity
  repCache = new Float32Array(count * 2);
  startedAt = now();
  frame = 0;

  if (mode === 'offscreen') {
    canvas = m.canvas;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildGroups();
    drawFrame(0, 1, false);            // resting state, drawn immediately
    if (!m.hidden) startLoop();
  }
  // transfer mode: the main thread owns the canvas + draw; we wait for ticks.
}

function onCursor(m) {
  // Clearing the cache on cursor-off stops a stale (throttled) repulsion force
  // from being reused across the gap. (OPT 5 hygiene.)
  if (!m.on && cursorOn) repCache.fill(0);
  cursorX = m.x; cursorY = m.y; cursorOn = m.on;
}

// ---- bulk-colour grouping (offscreen draw) — mirrors the main builder ----
// Particles are pre-grouped once into one bucket per colour so the render loop
// iterates flat index arrays with no per-frame allocation or branching (OPT 4).
// Each bucket stores an opaque rgb fill plus the median of its particles' baked
// alphas; the draw applies that alpha once via globalAlpha and fills the whole
// colour in a single rect path.
function buildGroups() {
  const POOL = cfg.POOL;
  const buckets = [];
  const alphas = [];
  const shim = [];
  for (let i = 0; i < count; i++) {
    if (isShimArr[i]) { shim.push(i); continue; }
    const ci = colIdxArr[i];
    if (!buckets[ci]) { buckets[ci] = []; alphas[ci] = []; }
    buckets[ci].push(i);
    alphas[ci].push(bakedAlphaArr[i]);
  }
  const order = [];
  for (let ci = 0; ci < POOL.length; ci++) {
    if (!buckets[ci]) continue;
    order.push({
      color: `rgb(${POOL[ci][0]},${POOL[ci][1]},${POOL[ci][2]})`,
      alpha: median(alphas[ci]),
      indices: Int32Array.from(buckets[ci]),
    });
  }
  groups = order;
  shimmerIdx = Int32Array.from(shim);
}

// ---- physics (shared by both modes) --------------------------------------
// Identical integration to the original main-thread loop: spring toward home,
// cursor repulsion, collective drift, damping, hard offset clamp. The only
// behavioural change is OPT 5 — repulsion is recomputed every other frame and
// reused on the alternate frame (human hand motion is < 30hz).
function physics(gdx, gdy) {
  const computeRep = (frame % 2) === 0;   // OPT 5: recompute repulsion at ~30hz
  frame++;

  const K = cfg.STIFFNESS, D = cfg.DAMPING;
  const R = cfg.REPEL_R, RMAX = cfg.REPEL_MAX, MAXOFF = cfg.MAX_OFF;
  const R2 = R * R;                        // OPT 4: compare distSq to radiusSq
  const on = cursorOn;

  for (let i = 0; i < count; i++) {
    const ix = i * 2, iy = ix + 1;
    const x = pos[ix], y = pos[iy];

    // spring toward home + collective drift
    let fx = (home[ix] - x) * K + gdx;
    let fy = (home[iy] - y) * K + gdy;

    // cursor repulsion (cached on alternate frames)
    if (on) {
      if (computeRep) {
        const dx = x - cursorX, dy = y - cursorY;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {                      // only sqrt when actually inside radius
          const d = Math.sqrt(d2) || 0.001;
          const force = (1 - d / R) * RMAX;
          repCache[ix] = (dx / d) * force;
          repCache[iy] = (dy / d) * force;
        } else {
          repCache[ix] = 0; repCache[iy] = 0;
        }
      }
      fx += repCache[ix];
      fy += repCache[iy];
    }

    const vx = (vel[ix] + fx) * D;
    const vy = (vel[iy] + fy) * D;
    let nx = x + vx, ny = y + vy;

    // never let a particle stray too far from its home
    const ox = nx - home[ix], oy = ny - home[iy];
    const od = Math.sqrt(ox * ox + oy * oy);
    if (od > MAXOFF) {
      nx = home[ix] + (ox / od) * MAXOFF;
      ny = home[iy] + (oy / od) * MAXOFF;
    }

    vel[ix] = vx; vel[iy] = vy;
    pos[ix] = nx; pos[iy] = ny;
  }
}

// ---- offscreen draw (mode === 'offscreen') -------------------------------
// Two passes, zero shadowBlur (the per-particle shadow buffer was the GPU
// bottleneck): bulk colour buckets each fill as one rect path at the bucket's
// median globalAlpha, then the capped shimmer set draws as soft halo+core
// two-circle dots with per-frame opacity wobble.
function drawFrame(t, breath, animated) {
  const POOL = cfg.POOL, TAU = cfg.TAU;
  ctx.clearRect(0, 0, width, height);
  ctx.shadowBlur = 0; // set once, globally; never per particle

  // Pass 1 — bulk: one rect path + one fill per colour bucket.
  for (let b = 0; b < groups.length; b++) {
    const idx = groups[b].indices;
    ctx.globalAlpha = groups[b].alpha;
    ctx.fillStyle = groups[b].color;
    ctx.beginPath();
    for (let j = 0; j < idx.length; j++) {
      const i = idx[j];
      if (skipEnabled && (i & 3) === 3) continue;       // OPT 6: skip every 4th
      const rx = cx + (pos[i * 2] - cx) * breath;
      const ry = cy + (pos[i * 2 + 1] - cy) * breath;
      const s = sizeArr[i];
      ctx.rect(rx - s, ry - s, s * 2, s * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Pass 2 — shimmer: faint wide halo, then a full-alpha core. The overlap reads
  // as a soft glow with no shadowBlur compositing cost.
  const SW = cfg.SHIMMER_W, SA = cfg.SHIMMER_AMP;
  for (let j = 0; j < shimmerIdx.length; j++) {
    const i = shimmerIdx[j];
    if (skipEnabled && (i & 3) === 3) continue;         // OPT 6
    const rx = cx + (pos[i * 2] - cx) * breath;
    const ry = cy + (pos[i * 2 + 1] - cy) * breath;
    let a = bakedAlphaArr[i];
    if (animated) a = clamp01(a + Math.sin(t * SW + shimPhaseArr[i]) * SA);
    const ci = colIdxArr[i];
    const r = POOL[ci][0], g = POOL[ci][1], bl = POOL[ci][2];
    const s = sizeArr[i];
    ctx.fillStyle = `rgba(${r},${g},${bl},${a * 0.18})`;
    ctx.beginPath();
    ctx.arc(rx, ry, s * 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(${r},${g},${bl},${a})`;
    ctx.beginPath();
    ctx.arc(rx, ry, s, 0, TAU);
    ctx.fill();
  }
}

// ---- offscreen rAF loop --------------------------------------------------
function loop() {
  raf = requestAnimationFrame(loop);
  const t0 = now();
  if (lastT) updateAdaptive(t0 - lastT);
  lastT = t0;

  const t = (t0 - startedAt) / 1000;
  const breath = 1 + Math.sin(t * cfg.BREATH_W) * cfg.BREATH_AMP;
  const ang = t * (cfg.TAU / cfg.DRIFT_PERIOD);
  const gdx = Math.cos(ang) * cfg.GLOBAL_DRIFT;
  const gdy = Math.sin(ang) * cfg.GLOBAL_DRIFT;

  physics(gdx, gdy);
  drawFrame(t, breath, true);
}
function startLoop() { if (raf == null) { lastT = 0; raf = requestAnimationFrame(loop); } }
function stopLoop()  { if (raf != null) { cancelAnimationFrame(raf); raf = null; } }

// ---- OPT 6 adaptive quality ----------------------------------------------
// Silent safety net: if frames run long for a sustained stretch, skip every 4th
// particle in the draw pass; restore once frames are comfortably fast again.
function updateAdaptive(d) {
  if (d > cfg.SLOW_MS) {
    slowStreak++; fastStreak = 0;
    if (slowStreak >= cfg.SLOW_FRAMES) skipEnabled = true;
  } else if (d < cfg.FAST_MS) {
    fastStreak++; slowStreak = 0;
    if (fastStreak >= cfg.FAST_FRAMES) skipEnabled = false;
  } else {
    slowStreak = 0; fastStreak = 0;
  }
}

// ---- transfer mode: one physics step per main-thread frame ---------------
function onTick(m) {
  if (!m.mouseOn && cursorOn) repCache.fill(0);
  cursorX = m.mouseX; cursorY = m.mouseY; cursorOn = m.mouseOn;

  physics(m.gdx, m.gdy);

  const out = new Float32Array(m.buffer);
  writeOutput(out, m.time, m.breath);
  // Transfer the buffer back (zero-copy); the main thread draws from it.
  self.postMessage({ type: 'frame', buffer: m.buffer }, [m.buffer]);
}

// Serialise [x, y, opacity, colorIndex, isShimmer] per particle. Breathing and
// shimmer wobble are baked in here so the main thread does pure draw calls.
function writeOutput(out, t, breath) {
  const SW = cfg.SHIMMER_W, SA = cfg.SHIMMER_AMP;
  for (let i = 0; i < count; i++) {
    const rx = cx + (pos[i * 2] - cx) * breath;
    const ry = cy + (pos[i * 2 + 1] - cy) * breath;
    let a = bakedAlphaArr[i];
    if (isShimArr[i]) a = clamp01(a + Math.sin(t * SW + shimPhaseArr[i]) * SA);
    const o = i * 5;
    out[o]     = rx;
    out[o + 1] = ry;
    out[o + 2] = a;
    out[o + 3] = colIdxArr[i];
    out[o + 4] = isShimArr[i];
  }
}
