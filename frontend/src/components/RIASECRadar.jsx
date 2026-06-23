import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { RIASEC_COLORS } from './CategoryBadge.jsx';

/**
 * RIASECRadar — six-axis radar (hexagon) chart of a student's RIASEC profile.
 * The data shape draws on (stroke path-length + fade) the first time it scrolls
 * into view; vertices pop in staggered after. Axis letters are tinted with each
 * RIASEC colour so the chart reads back to the badges students saw on the way.
 *
 * Order is fixed R-I-A-S-E-C (clockwise from top). `scores` may be:
 *   - an object keyed by name or letter: { realistic: 80, I: 60, … } (0–max), or
 *   - an array in R,I,A,S,E,C order: [80,95,40,55,30,60]
 *
 * Props:
 *   scores     {object|number[]}  per-axis values 0–max
 *   max        {number}   full-scale value (default 100)
 *   size       {number}   square px footprint (default 320)
 *   fill       {string}   data area fill (default translucent violet)
 *   stroke     {string}   data outline (default 'var(--violet)')
 *   showValues {boolean}  print each value under its axis letter (default false)
 *   className, style
 */
const ORDER = ['realistic', 'investigative', 'artistic', 'social', 'enterprising', 'conventional'];

function normalize(scores) {
  if (Array.isArray(scores)) return ORDER.map((_, i) => Number(scores[i]) || 0);
  if (scores && typeof scores === 'object') {
    return ORDER.map((key) => {
      const letter = key[0].toUpperCase();
      const v = scores[key] ?? scores[letter] ?? scores[key.toUpperCase()];
      return Number(v) || 0;
    });
  }
  return ORDER.map(() => 0);
}

export default function RIASECRadar({
  scores = [70, 92, 45, 60, 35, 55],
  max = 100,
  size = 320,
  fill = 'rgba(91,82,184,0.22)',
  stroke = 'var(--violet)',
  showValues = false,
  className = '',
  style = {},
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduceMotion = useReducedMotion();
  const on = inView || reduceMotion;

  const values = normalize(scores);
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 42;          // leave room for axis letters
  const RINGS = 4;

  const angle = (i) => (-90 + i * 60) * (Math.PI / 180);
  const point = (i, r) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  const ringPoints = (level) =>
    ORDER.map((_, i) => point(i, R * (level / RINGS)).map((n) => n.toFixed(1)).join(',')).join(' ');

  const dataPts = values.map((v, i) => point(i, R * (Math.max(0, Math.min(max, v)) / max)));
  const dataStr = dataPts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');

  return (
    <div ref={ref} className={className} style={{ width: size, height: size, ...style }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="RIASEC profile radar">
        {/* concentric hexagon grid */}
        {Array.from({ length: RINGS }, (_, k) => (
          <polygon key={k} points={ringPoints(k + 1)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        ))}

        {/* spokes */}
        {ORDER.map((_, i) => {
          const [x, y] = point(i, R);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />;
        })}

        {/* data shape — outline draws on, fill fades in */}
        <motion.polygon
          points={dataStr}
          fill={fill}
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={on ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
        />

        {/* vertices, tinted per RIASEC */}
        {dataPts.map((p, i) => (
          <motion.circle
            key={i}
            cx={p[0]}
            cy={p[1]}
            fill={RIASEC_COLORS[ORDER[i]].text}
            initial={reduceMotion ? false : { r: 0, opacity: 0 }}
            animate={on ? { r: 4, opacity: 1 } : {}}
            transition={{ duration: 0.3, delay: 0.6 + i * 0.06, ease: [0.4, 0, 0.2, 1] }}
          />
        ))}

        {/* axis letters (+ optional value) */}
        {ORDER.map((key, i) => {
          const [x, y] = point(i, R + 20);
          const c = RIASEC_COLORS[key];
          return (
            <text key={key} x={x} y={y} fill={c.text} fontSize={13} fontWeight={500} textAnchor="middle" dominantBaseline="middle">
              {c.letter}
              {showValues && (
                <tspan x={x} dy={14} fill="var(--text-tertiary)" fontSize={10} fontWeight={400}>
                  {Math.round(values[i])}
                </tspan>
              )}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
