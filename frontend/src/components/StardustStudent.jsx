import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * StardustStudent — the signature rooftop figure, rendered as a dense field of
 * near-pixel starlight particles constrained to a hand-drawn silhouette mask.
 *
 * The seated student is a PNG silhouette (`/starship_student_solid_mask.png`)
 * sampled once on mount: every opaque pixel of the figure becomes a valid home,
 * and up to 12000 tiny particles are scattered across that pool (with
 * replacement). From a distance the figure reads as almost solid; only on close
 * inspection does it resolve into individual specks that breathe, shimmer, and —
 * on desktop — scatter away from the cursor before springing calmly back into
 * formation. Pure <canvas> + requestAnimationFrame; no external particle library.
 *
 * Performance: the spring/repulsion/drift integration for 12000 particles runs
 * in a Web Worker (frontend/src/workers/particleWorker.js), never on the main
 * thread. Where OffscreenCanvas is supported the canvas itself is transferred to
 * the worker so even the draw calls leave the main thread; otherwise the worker
 * posts back a Float32Array of [x, y, opacity, colourIndex, isShimmer] per frame
 * (transferable, zero-copy) and the main thread does pure draw calls. Particle
 * state is flat typed arrays; the output buffer and colour groups are allocated
 * once. Physics, palette, sizes, spring feel, repulsion, breathing, drift and
 * shimmer wobble are unchanged. The render path is fill-rate-tuned: shadowBlur is
 * gone entirely (the per-particle shadow buffer was the GPU bottleneck at this
 * density) — bulk particles fill one rect path per colour bucket, and the capped
 * shimmer set is drawn as a soft halo+core two-circle dot that reproduces the
 * glow with plain alpha.
 *
 * Design rules honoured (CLAUDE.md): pale/muted starlight palette only — brand
 * violet (#534AB7) is never used directly; motion gated by reduced-motion +
 * mobile; and a visible resting state is drawn immediately so even paused /
 * headless frames still show the figure (students are the subject).
 *
 * Props:
 *   width  {number}  canvas CSS width  (default 280)
 *   height {number}  canvas CSS height (default 340)
 */

const MASK_SRC = '/starship_student_solid_mask.png';

// Weighted starlight palette (RGB). Deliberately pale — these read as starlight,
// not as the UI accent. Brand violet (#534AB7) is intentionally absent.
const POOL = [
  [240, 238, 255], // #F0EEFF — near white, very faint lavender
  [200, 192, 248], // #C8C0F8 — soft lavender
  [255, 255, 255], // #FFFFFF — pure white
  [152, 144, 216], // #9890D8 — deeper lavender, for depth
];
// Cumulative pick weights: 50% / 25% / 15% / 10%.
const POOL_CUM = [0.5, 0.75, 0.9, 1.0];

// Bulk (non-shimmer) particles carry a quantised alpha ∈ {0.6, 0.8, 1.0}. At
// draw time they are bucketed by colour only (one bucket per palette entry) and
// each bucket fills as a single rect path at its particles' median alpha, applied
// once via globalAlpha — a handful of fill() calls for ~11000 particles. The
// continuous-alpha shimmer lives on the individually-drawn shimmer particles.
const ALPHA_STEPS = 3; // bulk alpha ∈ {0.6, 0.8, 1.0}; per-colour median → globalAlpha

// Interaction / feel constants.
const STIFFNESS = 0.14;     // spring pull back toward home (tighter, crisper snap)
const DAMPING = 0.72;       // velocity damping
const REPEL_R = 40;         // cursor influence radius (canvas-local px)
const REPEL_MAX = 1.68;     // peak repulsion force → ~12px equilibrium (force / stiffness)
const MAX_OFF = 18;         // hard clamp: never further than this from home
const GLOBAL_DRIFT = 0.008; // tiny collective nudge applied to every particle equally
const DRIFT_PERIOD = 6;     // seconds for the global drift direction to come around
const SAMPLE_MAX = 400;     // offscreen sampling resolution (long edge)
const TAU = Math.PI * 2;

// Breathing + shimmer — these were inline magic numbers in the old render(); they
// are named here only so the worker and the main-thread draw share one source of
// truth. Values are unchanged: breath = 1 + sin(t·TAU/4)·0.006 (±0.6%, 4s period);
// shimmer opacity wobble = sin(t·0.9 + phase)·0.12.
const BREATH_W = TAU / 4;
const BREATH_AMP = 0.006;
const SHIMMER_W = 0.9;
const SHIMMER_AMP = 0.12;

// OPT 6 adaptive-quality thresholds (silent safety net; should never trigger on
// hardware that holds 60fps).
const SLOW_MS = 24, FAST_MS = 18, SLOW_FRAMES = 5, FAST_FRAMES = 10;

const rand = (min, max) => min + Math.random() * (max - min);

// Weighted pick into POOL: 50% / 25% / 15% / 10%.
function pickColourIdx() {
  const r = Math.random();
  for (let i = 0; i < POOL_CUM.length; i++) if (r < POOL_CUM[i]) return i;
  return POOL.length - 1;
}

// Median of a small numeric array — used once per colour bucket at build time to
// pick that bucket's single globalAlpha (FIX 3). Copies before sorting.
function median(values) {
  if (!values.length) return 1;
  const s = values.slice().sort((a, b) => a - b);
  return s[s.length >> 1];
}

// Constants shipped to the worker so it hard-codes no tunable values.
const WORKER_CFG = {
  STIFFNESS, DAMPING, REPEL_R, REPEL_MAX, MAX_OFF,
  GLOBAL_DRIFT, DRIFT_PERIOD, TAU,
  BREATH_W, BREATH_AMP, SHIMMER_W, SHIMMER_AMP,
  ALPHA_STEPS, POOL,
  SLOW_MS, FAST_MS, SLOW_FRAMES, FAST_FRAMES,
};

function spawnWorker() {
  return new Worker(new URL('../workers/particleWorker.js', import.meta.url), { type: 'module' });
}

/**
 * The engine owns everything that must survive React 18 StrictMode's dev
 * mount→unmount→mount: a canvas can be transferControlToOffscreen()'d only once,
 * so we never rebuild — we re-attach interaction and cancel a deferred teardown.
 * Returned once per canvas element; width/height are fixed for its lifetime
 * (they are constants at the only call site).
 */
function createEngine(canvas, width, height, initialReduce) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const isTouch =
    window.matchMedia('(hover: none)').matches || 'ontouchstart' in window;
  const targetCount = initialReduce ? 1200 : isMobile ? 4000 : 12000;

  const engine = {
    disposed: false,
    disposeTimer: null,
    built: false,
    reduce: initialReduce,
    repelEnabled: false,

    img: null,
    worker: null,
    mode: null,          // 'offscreen' | 'transfer' | 'static'
    mainCtx: null,

    // particle state (flat typed arrays — OPT 3)
    count: 0,
    home: null, size: null, colIdx: null, isShimmer: null,
    shimPhase: null, glow: null, bakedAlpha: null, alphaStep: null,
    groups: null, shimmerIdx: null,
    cx: width / 2, cy: height / 2,

    // transfer-mode draw loop
    raf: null, outBuf: null, latest: null, pending: false,
    lastFrameT: 0, startedAt: 0,

    // cursor
    cursorX: 0, cursorY: 0, cursorOn: false,

    // OPT 6 (main-thread draw path)
    slowStreak: 0, fastStreak: 0, skipEnabled: false,
  };

  // ---- sample the silhouette mask into flat particle arrays -------------
  function buildParticles(img) {
    // Draw to a fixed-resolution offscreen canvas. Aspect ratio is preserved
    // (long edge = SAMPLE_MAX) so the figure is never distorted; it is re-fit
    // to the display canvas via its own bounding box below.
    const s = SAMPLE_MAX / Math.max(img.width, img.height);
    const sw = Math.max(1, Math.round(img.width * s));
    const sh = Math.max(1, Math.round(img.height * s));
    const off = document.createElement('canvas');
    off.width = sw;
    off.height = sh;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(img, 0, 0, sw, sh);
    const data = octx.getImageData(0, 0, sw, sh).data;

    // 1) Binary opaque mask (alpha > 128), sampled at stride 1 — every pixel.
    //    Drop near-full-width rows — the reference sheet drew a ground line
    //    the student rests on.
    const opaque = new Uint8Array(sw * sh);
    for (let y = 0; y < sh; y++) {
      const base = y * sw;
      let rowCount = 0;
      for (let x = 0; x < sw; x++) {
        if (data[(base + x) * 4 + 3] > 128) {
          opaque[base + x] = 1;
          rowCount++;
        }
      }
      if (rowCount > sw * 0.8) {
        for (let x = 0; x < sw; x++) opaque[base + x] = 0; // baseline row
      }
    }

    // 2) Keep only the largest connected blob (8-connectivity). This drops the
    //    stray "1." figure-number label (and any speckle) from the sheet.
    const label = new Int32Array(sw * sh).fill(-1);
    const stack = [];
    let bestId = -1, bestSize = 0, curId = 0;
    for (let i = 0; i < sw * sh; i++) {
      if (!opaque[i] || label[i] !== -1) continue;
      label[i] = curId;
      stack.length = 0;
      stack.push(i);
      let size = 0;
      while (stack.length) {
        const p = stack.pop();
        size++;
        const px = p % sw;
        const py = (p / sw) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = px + dx, ny = py + dy;
            if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
            const ni = ny * sw + nx;
            if (opaque[ni] && label[ni] === -1) {
              label[ni] = curId;
              stack.push(ni);
            }
          }
        }
      }
      if (size > bestSize) { bestSize = size; bestId = curId; }
      curId++;
    }
    if (bestId === -1) return;

    // 3) Collect the figure's pixels + tight bounding box. Every one of these
    //    is a valid home — together they form the full valid-positions pool.
    const pts = [];
    let minx = sw, miny = sh, maxx = 0, maxy = 0;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (label[y * sw + x] === bestId) {
          pts.push(x, y);
          if (x < minx) minx = x;
          if (x > maxx) maxx = x;
          if (y < miny) miny = y;
          if (y > maxy) maxy = y;
        }
      }
    }
    if (!pts.length) return;

    // 4) Fit the figure into the display canvas (contain, bottom-anchored so
    //    the seated figure rests near the canvas floor / rooftop edge).
    const fw = (maxx - minx) || 1;
    const fh = (maxy - miny) || 1;
    const FILL = 0.92;
    const scale = Math.min((width * FILL) / fw, (height * FILL) / fh);
    const renderW = fw * scale;
    const renderH = fh * scale;
    const offX = (width - renderW) / 2;
    const offY = height - renderH - height * 0.03;
    const mapX = (sx) => offX + (sx - minx) * scale;
    const mapY = (sy) => offY + (sy - miny) * scale;

    // 5) Scatter particles across the silhouette into flat typed arrays. Every
    //    figure pixel is a valid home; particles sample the pool *with
    //    replacement*, so multiple particles can share a pixel — necessary to
    //    read as near-solid at this density. Colour, size, alpha and shimmer are
    //    all assigned per particle once here; nothing per-particle is re-derived
    //    each frame. The RNG draw order matches the original exactly, so the
    //    statistical look (15% shimmer, colour/size/alpha distributions) is
    //    identical (the scatter was always random per load).
    const poolCount = pts.length / 2;
    const count = targetCount;
    const home = new Float32Array(count * 2);
    const sizeA = new Float32Array(count);
    const colIdxA = new Uint8Array(count);
    const isShimA = new Uint8Array(count);
    const shimPhaseA = new Float32Array(count);
    const glowA = new Float32Array(count);
    const bakedAlphaA = new Float32Array(count);
    const alphaStepA = new Uint8Array(count);
    let sumX = 0, sumY = 0;

    // Pass A — place every particle (home, colour, size, shimmer phase). The
    // shimmer/bulk split is deferred to pass B because it now depends on the
    // centre of mass (FIX 4), which isn't known until every home is summed.
    for (let i = 0; i < count; i++) {
      const k = (Math.random() * poolCount) | 0;
      const hx = mapX(pts[k * 2]);
      const hy = mapY(pts[k * 2 + 1]);

      home[i * 2] = hx;
      home[i * 2 + 1] = hy;
      colIdxA[i] = pickColourIdx();
      sizeA[i] = 0.3 + Math.random() * Math.random() * 0.5; // 0.3–0.8px, skewed small
      shimPhaseA[i] = Math.random() * TAU;

      sumX += hx;
      sumY += hy;
    }
    const cxv = sumX / count;
    const cyv = sumY / count;

    // FIX 4 — shimmer particles are the only individually-drawn ones, so their
    // count is capped per device and concentrated at the figure's centre mass,
    // where particle density is highest and the eye lands. Rank by distance² to
    // centre and take the closest N. The cap never binds for the small
    // reduced-motion pool, so that path keeps its original ~15% share.
    const shimmerCount = Math.min(isMobile ? 200 : 800, Math.round(count * 0.15));
    const orderByDist = new Uint32Array(count);
    const dist2 = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      orderByDist[i] = i;
      const dx = home[i * 2] - cxv, dy = home[i * 2 + 1] - cyv;
      dist2[i] = dx * dx + dy * dy;
    }
    orderByDist.sort((a, b) => dist2[a] - dist2[b]);
    for (let n = 0; n < shimmerCount; n++) isShimA[orderByDist[n]] = 1;

    // Pass B — bake per-particle alpha. Shimmer carries a continuous alpha that
    // wobbles per frame; bulk carries a quantised alpha {0.6, 0.8, 1.0} whose
    // per-colour median becomes that colour bucket's single globalAlpha (FIX 3).
    for (let i = 0; i < count; i++) {
      if (isShimA[i]) {
        bakedAlphaA[i] = rand(0.6, 1.0);
        glowA[i] = rand(1.5, 2.5); // retained for the init protocol; unused by the draw
        alphaStepA[i] = 255;
      } else {
        const al = (Math.random() * ALPHA_STEPS) | 0; // 0..2
        bakedAlphaA[i] = 0.6 + 0.2 * al;              // 0.6 / 0.8 / 1.0
        glowA[i] = 0;
        alphaStepA[i] = al;
      }
    }

    engine.count = count;
    engine.home = home;
    engine.size = sizeA;
    engine.colIdx = colIdxA;
    engine.isShimmer = isShimA;
    engine.shimPhase = shimPhaseA;
    engine.glow = glowA;
    engine.bakedAlpha = bakedAlphaA;
    engine.alphaStep = alphaStepA;
    engine.cx = cxv;
    engine.cy = cyv;
  }

  // Pre-group bulk particles into one bucket per colour (FIX 3) and collect
  // shimmer indices, both as flat Int32Arrays (OPT 4). Each bucket stores an
  // opaque rgb fill plus the median of its particles' baked alphas; the draw
  // applies that alpha once via globalAlpha and fills the whole colour in a
  // single rect path. Used by the main-thread draw path (transfer + static).
  function buildGroups() {
    const buckets = [];
    const alphas = [];
    const shim = [];
    for (let i = 0; i < engine.count; i++) {
      if (engine.isShimmer[i]) { shim.push(i); continue; }
      const ci = engine.colIdx[i];
      if (!buckets[ci]) { buckets[ci] = []; alphas[ci] = []; }
      buckets[ci].push(i);
      alphas[ci].push(engine.bakedAlpha[i]);
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
    engine.groups = order;
    engine.shimmerIdx = Int32Array.from(shim);
  }

  // Resting frame as an [x, y, opacity, colourIndex, isShimmer] buffer: positions
  // at home (breath = 1 is identity), baked alpha, no wobble. Reproduces the old
  // render(false) exactly.
  function makeStaticBuffer() {
    const n = engine.count;
    const buf = new Float32Array(n * 5);
    for (let i = 0; i < n; i++) {
      buf[i * 5] = engine.home[i * 2];
      buf[i * 5 + 1] = engine.home[i * 2 + 1];
      buf[i * 5 + 2] = engine.bakedAlpha[i];
      buf[i * 5 + 3] = engine.colIdx[i];
      buf[i * 5 + 4] = engine.isShimmer[i];
    }
    return buf;
  }

  // Main-thread draw (transfer + static modes). Positions/opacity come from the
  // buffer already breath- and wobble-transformed by the worker (transfer) or
  // pre-baked (static). Two passes, zero shadowBlur: bulk colour buckets each as
  // one rect path at the bucket's median globalAlpha (FIX 2/3), then the capped
  // shimmer set as soft halo+core two-circle dots (FIX 1).
  function drawBuffer(buf) {
    const ctx = engine.mainCtx;
    if (!ctx) return;
    const skip = engine.skipEnabled;
    ctx.clearRect(0, 0, width, height);
    ctx.shadowBlur = 0; // set once, globally; never per particle

    // Pass 1 — bulk: one rect path + one fill per colour bucket.
    const groups = engine.groups;
    for (let b = 0; b < groups.length; b++) {
      const idx = groups[b].indices;
      ctx.globalAlpha = groups[b].alpha;
      ctx.fillStyle = groups[b].color;
      ctx.beginPath();
      for (let j = 0; j < idx.length; j++) {
        const i = idx[j];
        if (skip && (i & 3) === 3) continue;          // OPT 6
        const x = buf[i * 5], y = buf[i * 5 + 1], sz = engine.size[i];
        ctx.rect(x - sz, y - sz, sz * 2, sz * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Pass 2 — shimmer: faint wide halo, then a full-alpha core. The overlap
    // reads as a soft glow with no shadowBlur compositing cost.
    const shim = engine.shimmerIdx;
    for (let j = 0; j < shim.length; j++) {
      const i = shim[j];
      if (skip && (i & 3) === 3) continue;            // OPT 6
      const x = buf[i * 5], y = buf[i * 5 + 1], a = buf[i * 5 + 2];
      const sz = engine.size[i], ci = engine.colIdx[i];
      const r = POOL[ci][0], g = POOL[ci][1], bl = POOL[ci][2];
      ctx.fillStyle = `rgba(${r},${g},${bl},${a * 0.18})`;
      ctx.beginPath();
      ctx.arc(x, y, sz * 2.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(${r},${g},${bl},${a})`;
      ctx.beginPath();
      ctx.arc(x, y, sz, 0, TAU);
      ctx.fill();
    }
  }

  function updateAdaptive(d) {
    if (d > SLOW_MS) {
      engine.slowStreak++; engine.fastStreak = 0;
      if (engine.slowStreak >= SLOW_FRAMES) engine.skipEnabled = true;
    } else if (d < FAST_MS) {
      engine.fastStreak++; engine.slowStreak = 0;
      if (engine.fastStreak >= FAST_FRAMES) engine.skipEnabled = false;
    } else {
      engine.slowStreak = 0; engine.fastStreak = 0;
    }
  }

  // ---- transfer-mode loop: main drives, worker integrates --------------
  function frameLoop() {
    engine.raf = requestAnimationFrame(frameLoop);
    const t0 = performance.now();
    if (engine.lastFrameT) updateAdaptive(t0 - engine.lastFrameT);
    engine.lastFrameT = t0;

    if (engine.latest) drawBuffer(engine.latest);

    if (!engine.pending && engine.outBuf) {
      const t = (t0 - engine.startedAt) / 1000;
      const breath = 1 + Math.sin(t * BREATH_W) * BREATH_AMP;
      const ang = t * (TAU / DRIFT_PERIOD);
      const gdx = Math.cos(ang) * GLOBAL_DRIFT;
      const gdy = Math.sin(ang) * GLOBAL_DRIFT;
      const b = engine.outBuf;
      engine.outBuf = null;
      engine.latest = null;       // buffer about to be neutered by transfer
      engine.pending = true;
      engine.worker.postMessage(
        { type: 'tick', buffer: b, mouseX: engine.cursorX, mouseY: engine.cursorY,
          mouseOn: engine.cursorOn, time: t, gdx, gdy, breath },
        [b]
      );
    }
  }
  function startMainLoop() {
    if (engine.raf == null && !document.hidden) {
      engine.lastFrameT = 0;
      engine.raf = requestAnimationFrame(frameLoop);
    }
  }
  function stopMainLoop() {
    if (engine.raf != null) { cancelAnimationFrame(engine.raf); engine.raf = null; }
  }
  function onWorkerMessage(e) {
    const d = e.data;
    if (d && d.type === 'frame') {
      engine.outBuf = d.buffer;
      engine.latest = new Float32Array(d.buffer);
      engine.pending = false;
    }
  }

  // ---- events ----------------------------------------------------------
  function onMove(e) {
    // Map client → canvas-internal coords. getBoundingClientRect reflects the
    // GSAP camera scale, so dividing by rect size keeps repulsion aligned even
    // while scene 1 is mid-zoom.
    const rect = canvas.getBoundingClientRect();
    const lx = ((e.clientX - rect.left) / rect.width) * width;
    const ly = ((e.clientY - rect.top) / rect.height) * height;
    if (lx >= -REPEL_R && lx <= width + REPEL_R && ly >= -REPEL_R && ly <= height + REPEL_R) {
      engine.cursorX = lx;
      engine.cursorY = ly;
      engine.cursorOn = true;
    } else {
      engine.cursorOn = false; // pointer left the figure's neighbourhood → reform
    }
    if (engine.mode === 'offscreen' && engine.worker) {
      engine.worker.postMessage({ type: 'cursor', x: engine.cursorX, y: engine.cursorY, on: engine.cursorOn });
    }
  }
  function onLeave() {
    engine.cursorOn = false;
    if (engine.mode === 'offscreen' && engine.worker) {
      engine.worker.postMessage({ type: 'cursor', x: engine.cursorX, y: engine.cursorY, on: false });
    }
  }
  function onVisibility() {
    if (engine.reduce) return;                 // reduced-motion: stay static
    if (engine.mode === 'offscreen') {
      engine.worker && engine.worker.postMessage({ type: 'visibility', hidden: document.hidden });
    } else if (engine.mode === 'transfer') {
      if (document.hidden) stopMainLoop(); else startMainLoop();
    }
  }

  // ---- listeners (original add/remove sets) ----------------------------
  function addListeners() {
    removeListeners();
    if (engine.repelEnabled) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('blur', onLeave);
      document.addEventListener('mouseleave', onLeave);
    }
    if (!engine.reduce) {
      document.addEventListener('visibilitychange', onVisibility);
    }
  }
  function removeListeners() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('blur', onLeave);
    document.removeEventListener('mouseleave', onLeave);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  // ---- mode setup ------------------------------------------------------
  function initData(modeName, extra) {
    return Object.assign({
      type: 'init', mode: modeName,
      count: engine.count, cx: engine.cx, cy: engine.cy,
      width, height, dpr, hidden: document.hidden, cfg: WORKER_CFG,
      home: engine.home, size: engine.size, colIdx: engine.colIdx, isShimmer: engine.isShimmer,
      shimPhase: engine.shimPhase, glow: engine.glow, bakedAlpha: engine.bakedAlpha, alphaStep: engine.alphaStep,
    }, extra);
  }

  function setupOffscreen(off) {
    engine.mode = 'offscreen';
    engine.worker.postMessage(initData('offscreen', { canvas: off }), [off]);
  }

  function ensureMainCanvas() {
    if (engine.mainCtx) return;
    engine.mainCtx = canvas.getContext('2d');
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    engine.mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setupTransfer() {
    engine.mode = 'transfer';
    ensureMainCanvas();
    buildGroups();
    engine.outBuf = new Float32Array(engine.count * 5).buffer; // pre-allocated once (OPT 4)
    engine.startedAt = performance.now();
    drawBuffer(makeStaticBuffer());     // resting state, immediately
    engine.worker.postMessage(initData('transfer'));
    startMainLoop();
  }

  function drawStaticMain() {
    engine.mode = 'static';
    ensureMainCanvas();
    buildGroups();
    drawBuffer(makeStaticBuffer());
  }

  // ---- public lifecycle ------------------------------------------------
  engine.start = function start() {
    const img = new Image();
    engine.img = img;
    img.onload = () => {
      if (engine.disposed) return;
      buildParticles(img);
      if (!engine.count) return;        // mask produced nothing — nothing to show
      engine.built = true;

      // Reduced-motion: static resting frame on the main thread, no worker, no
      // loop — exactly the original reduced path.
      if (engine.reduce || typeof Worker === 'undefined') {
        drawStaticMain();
        return;
      }

      let worker;
      try { worker = spawnWorker(); }
      catch { drawStaticMain(); return; } // worker blocked (rare) → visible static figure
      engine.worker = worker;
      worker.onmessage = onWorkerMessage;

      const canOffscreen =
        typeof OffscreenCanvas !== 'undefined' &&
        typeof canvas.transferControlToOffscreen === 'function';
      let off = null;
      if (canOffscreen) {
        try { off = canvas.transferControlToOffscreen(); } catch { off = null; }
      }
      if (off) setupOffscreen(off);
      else setupTransfer();

      // Push current cursor state (a pre-init mousemove may have set it).
      if (engine.mode === 'offscreen') {
        worker.postMessage({ type: 'cursor', x: engine.cursorX, y: engine.cursorY, on: engine.cursorOn });
      }
    };
    img.src = MASK_SRC;
  };

  engine.attach = function attach(reduceNow) {
    engine.reduce = reduceNow;
    engine.repelEnabled = !reduceNow && !isMobile && !isTouch;
    addListeners();
    resumeIfNeeded();
  };

  function resumeIfNeeded() {
    if (!engine.built) return;            // start()'s img.onload will set up
    if (engine.mode === 'static') return; // static stays static
    if (engine.reduce) {                  // reduced-motion turned on mid-session
      if (engine.mode === 'offscreen') {
        engine.worker && engine.worker.postMessage({ type: 'showStatic' });
      } else {
        stopMainLoop();
        drawBuffer(makeStaticBuffer());
      }
      return;
    }
    // motion allowed → (re)start the animation
    if (engine.mode === 'offscreen') {
      engine.worker && engine.worker.postMessage({ type: 'visibility', hidden: document.hidden });
    } else {
      startMainLoop();
    }
  }

  engine.detach = function detach() {
    removeListeners();
    // Pause rendering while unmounted.
    if (engine.mode === 'offscreen') {
      engine.worker && engine.worker.postMessage({ type: 'visibility', hidden: true });
    } else if (engine.mode === 'transfer') {
      stopMainLoop();
    }
    // Defer teardown one task so a StrictMode remount can cancel it.
    if (engine.disposeTimer) clearTimeout(engine.disposeTimer);
    engine.disposeTimer = setTimeout(() => engine.dispose(), 0);
  };

  engine.dispose = function dispose() {
    if (engine.disposed) return;
    engine.disposed = true;
    if (engine.disposeTimer) { clearTimeout(engine.disposeTimer); engine.disposeTimer = null; }
    stopMainLoop();
    removeListeners();
    if (engine.worker) {
      try { engine.worker.postMessage({ type: 'dispose' }); } catch { /* worker already gone */ }
      engine.worker.terminate();
      engine.worker = null;
    }
  };

  return engine;
}

export default function StardustStudent({ width = 280, height = 340 }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Reuse the engine across StrictMode's dev mount→unmount→mount: the canvas
    // can be transferred to the worker only once. Cancel any pending teardown
    // and just re-attach interaction (handling a reduced-motion toggle).
    const existing = engineRef.current;
    if (existing && !existing.disposed) {
      if (existing.disposeTimer) { clearTimeout(existing.disposeTimer); existing.disposeTimer = null; }
      existing.attach(reduce);
      return () => existing.detach();
    }

    const engine = createEngine(canvas, width, height, reduce);
    engineRef.current = engine;
    engine.start();
    engine.attach(reduce);
    return () => engine.detach();
  }, [width, height, reduce]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ width: `${width}px`, height: `${height}px`, display: 'block', pointerEvents: 'none' }}
    />
  );
}
