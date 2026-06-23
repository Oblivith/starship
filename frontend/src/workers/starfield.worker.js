// Starfield animation loop running on an OffscreenCanvas in a Web Worker.
// Receives messages from StarfieldCanvas.jsx:
//   { type: 'init',     canvas, width, height, dpr, density, reduceMotion, shootingStars, glowColor }
//   { type: 'resize',   width, height, dpr, density }
//   { type: 'mousemove', mouseX, mouseY }
//   { type: 'stop' }

const LAYER_DEFS = [
  { count: 90, r: [0.4, 0.9], a: [0.25, 0.5], speed: 0.012, par: 0.018, twinkle: false },
  { count: 45, r: [0.7, 1.4], a: [0.40, 0.7], speed: 0.025, par: 0.045, twinkle: true  },
  { count: 18, r: [1.1, 2.1], a: [0.60, 1.0], speed: 0.045, par: 0.085, twinkle: true  },
];

const rand = (min, max) => min + Math.random() * (max - min);

let ctx = null;
let width = 0, height = 0;
let layers = [];
let t = 0, raf = null;
let curX = 0, curY = 0, mouseX = 0, mouseY = 0;
let streaks = [], nextStreak = 180 + Math.random() * 300;
let reduceMotion = false, shootingStars = false, glowColor = null;

function build(w, h, density) {
  width = w;
  height = h;
  t = 0;
  curX = 0; curY = 0; mouseX = 0; mouseY = 0;
  streaks = [];
  nextStreak = 180 + Math.random() * 300;

  const areaScale = (w * h) / 1_000_000;
  layers = LAYER_DEFS.map((def) => ({
    ...def,
    stars: Array.from(
      { length: Math.max(6, Math.round(def.count * areaScale * density)) },
      () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: rand(def.r[0], def.r[1]),
        a: rand(def.a[0], def.a[1]),
        ph: Math.random() * Math.PI * 2,
      }),
    ),
  }));
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  if (glowColor) {
    const g = ctx.createRadialGradient(
      width / 2, height * 0.42, 0,
      width / 2, height * 0.42, Math.max(width, height) * 0.7,
    );
    g.addColorStop(0, glowColor);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  curX += (mouseX - curX) * 0.05;
  curY += (mouseY - curY) * 0.05;

  for (const layer of layers) {
    const ox = curX * layer.par;
    const oy = curY * layer.par;
    for (const s of layer.stars) {
      if (!reduceMotion) {
        s.y += layer.speed;
        if (s.y > height + 2) s.y = -2;
      }
      let alpha = s.a;
      if (layer.twinkle && !reduceMotion) {
        alpha = s.a * (0.65 + 0.35 * Math.sin(t * 0.04 + s.ph));
      }
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  if (shootingStars && !reduceMotion) {
    if (t >= nextStreak) {
      const fromLeft = Math.random() < 0.5;
      const sx = fromLeft ? rand(-0.05 * width, 0.25 * width) : rand(0.75 * width, 1.05 * width);
      const sy = rand(0.04 * height, 0.42 * height);
      const ang = fromLeft ? rand(0.18, 0.42) : Math.PI - rand(0.18, 0.42);
      const speed = rand(7, 12);
      streaks.push({
        x: sx, y: sy,
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        life: 0, max: rand(42, 72), len: rand(70, 150),
      });
      nextStreak = t + rand(260, 620);
    }
    for (let i = streaks.length - 1; i >= 0; i--) {
      const st = streaks[i];
      st.x += st.vx; st.y += st.vy; st.life++;
      const p = st.life / st.max;
      const a = Math.max(0, p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6);
      const mag = Math.hypot(st.vx, st.vy);
      const tx = st.x - (st.vx / mag) * st.len;
      const ty = st.y - (st.vy / mag) * st.len;
      const grad = ctx.createLinearGradient(st.x, st.y, tx, ty);
      grad.addColorStop(0, `rgba(255,255,255,${0.9 * a})`);
      grad.addColorStop(0.35, `rgba(200,184,255,${0.4 * a})`);
      grad.addColorStop(1, 'rgba(200,184,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(st.x, st.y);
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(st.x, st.y, 1.7, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.globalAlpha = 1;
      if (
        st.life >= st.max ||
        st.x < -180 || st.x > width + 180 ||
        st.y > height + 180
      ) {
        streaks.splice(i, 1);
      }
    }
  }

  t++;
}

function loop() {
  draw();
  raf = requestAnimationFrame(loop);
}

function startLoop() {
  if (reduceMotion) {
    draw();
  } else {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
}

self.onmessage = ({ data }) => {
  if (data.type === 'init') {
    const { canvas, width: w, height: h, dpr, density,
            reduceMotion: rm, shootingStars: ss, glowColor: gc } = data;
    ctx = canvas.getContext('2d');
    reduceMotion = rm;
    shootingStars = ss;
    glowColor = gc;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build(w, h, density);
    startLoop();

  } else if (data.type === 'resize') {
    if (raf) cancelAnimationFrame(raf);
    const { width: w, height: h, dpr, density } = data;
    ctx.canvas.width = Math.floor(w * dpr);
    ctx.canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build(w, h, density);
    startLoop();

  } else if (data.type === 'mousemove') {
    mouseX = data.mouseX;
    mouseY = data.mouseY;

  } else if (data.type === 'stop') {
    if (raf) cancelAnimationFrame(raf);
  }
};
