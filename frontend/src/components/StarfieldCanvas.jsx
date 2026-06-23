import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * StarfieldCanvas — reusable hero/section background.
 *
 * Three star layers drift at different speeds with subtle mouse parallax, the
 * near layer twinkles. Pure <canvas>; absolutely fills its nearest positioned
 * ancestor (give the parent `position: relative`). Decorative + aria-hidden.
 *
 * Props:
 *   density       {number}  star-count multiplier (default 1)
 *   parallax      {boolean} mouse parallax (default true)
 *   glowColor     {string}  optional radial nebula glow, e.g. 'rgba(83,74,183,0.16)'
 *   shootingStars {boolean} occasional meteor streaks (default false; off under reduced-motion)
 *   className, style
 */
export default function StarfieldCanvas({
  density = 1,
  parallax = true,
  glowColor = null,
  shootingStars = false,
  className = '',
  style = {},
}) {
  const canvasRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement || document.body;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const LAYER_DEFS = [
      { count: 90, r: [0.4, 0.9], a: [0.25, 0.5], speed: 0.012, par: 0.018, twinkle: false },
      { count: 45, r: [0.7, 1.4], a: [0.40, 0.7], speed: 0.025, par: 0.045, twinkle: true },
      { count: 18, r: [1.1, 2.1], a: [0.60, 1.0], speed: 0.045, par: 0.085, twinkle: true },
    ];

    let width = 0, height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let layers = [];
    let raf = null;
    let mouseX = 0, mouseY = 0;
    let curX = 0, curY = 0;
    let t = 0;
    let streaks = [];
    let nextStreak = 180 + Math.random() * 300;

    const rand = (min, max) => min + Math.random() * (max - min);

    function build() {
      const rect = parent.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const areaScale = (width * height) / 1_000_000;
      layers = LAYER_DEFS.map((def) => ({
        ...def,
        stars: Array.from({ length: Math.max(6, Math.round(def.count * areaScale * density)) }, () => ({
          x: Math.random() * width,
          y: Math.random() * height,
          r: rand(def.r[0], def.r[1]),
          a: rand(def.a[0], def.a[1]),
          ph: Math.random() * Math.PI * 2,
        })),
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      if (glowColor) {
        const g = ctx.createRadialGradient(
          width / 2, height * 0.42, 0,
          width / 2, height * 0.42, Math.max(width, height) * 0.7
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
          st.x += st.vx; st.y += st.vy; st.life += 1;
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
          if (st.life >= st.max || st.x < -180 || st.x > width + 180 || st.y > height + 180) {
            streaks.splice(i, 1);
          }
        }
      }

      t += 1;
    }

    function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    }

    function onMouseMove(e) {
      const rect = parent.getBoundingClientRect();
      mouseX = e.clientX - rect.left - rect.width / 2;
      mouseY = e.clientY - rect.top - rect.height / 2;
    }

    build();
    if (reduceMotion) {
      draw();
    } else {
      raf = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(build);
    ro.observe(parent);
    const useParallax = parallax && !reduceMotion;
    if (useParallax) window.addEventListener('mousemove', onMouseMove);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      if (useParallax) window.removeEventListener('mousemove', onMouseMove);
    };
  }, [density, parallax, glowColor, shootingStars, reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}
