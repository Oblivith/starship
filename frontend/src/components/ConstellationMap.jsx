import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/**
 * ConstellationMap — career options plotted as a star constellation. Faint links
 * draw on, then star nodes pop + twinkle (staggered) the first time the map
 * scrolls into view. The `primary` node renders larger with a violet glow; the
 * rest are smaller teal stars. Click a star to select it.
 *
 * Node coordinates are normalised 0–1 (origin top-left) so callers don't deal in
 * pixels. If `links` is omitted, every node links to the primary (hub-and-spoke);
 * with no primary, nodes link sequentially.
 *
 * Props:
 *   nodes    {{id?, label, x, y, primary?, match?}[]}  x,y in 0–1
 *   links    {[number, number][]}  index pairs (optional)
 *   width    {number}  viewBox width  (default 600)
 *   height   {number}  viewBox height (default 360)
 *   onSelect {(node, index) => void}
 *   className, style
 */
export default function ConstellationMap({
  nodes = [],
  links,
  width = 600,
  height = 360,
  onSelect,
  className = '',
  style = {},
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduceMotion = useReducedMotion();
  const on = inView || reduceMotion;

  const pad = 52;
  const px = (x) => pad + x * (width - pad * 2);
  const py = (y) => pad + y * (height - pad * 2);

  const primaryIndex = nodes.findIndex((n) => n.primary);
  let edges = links;
  if (!edges) {
    edges =
      primaryIndex >= 0
        ? nodes.map((_, i) => [primaryIndex, i]).filter(([a, b]) => a !== b)
        : nodes.slice(1).map((_, i) => [i, i + 1]);
  }
  const nodeDelayBase = edges.length * 0.05;

  return (
    <div ref={ref} className={className} style={{ width: '100%', ...style }}>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Career constellation map"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* links */}
        {edges.map(([a, b], i) => {
          const na = nodes[a];
          const nb = nodes[b];
          if (!na || !nb) return null;
          return (
            <motion.line
              key={`l-${i}`}
              x1={px(na.x)}
              y1={py(na.y)}
              x2={px(nb.x)}
              y2={py(nb.y)}
              stroke="rgba(200,184,255,0.28)"
              strokeWidth={1}
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={on ? { pathLength: 1, opacity: 1 } : {}}
              transition={{ duration: 0.7, delay: i * 0.06, ease: [0.4, 0, 0.2, 1] }}
            />
          );
        })}

        {/* nodes */}
        {nodes.map((n, i) => {
          const x = px(n.x);
          const y = py(n.y);
          const isPrimary = !!n.primary;
          const r = isPrimary ? 9 : 5;
          const color = isPrimary ? 'var(--violet)' : 'var(--glow)';
          const delay = nodeDelayBase + i * 0.1;
          return (
            <g key={n.id ?? i} style={{ cursor: onSelect ? 'pointer' : 'default' }} onClick={() => onSelect?.(n, i)}>
              {/* glow halo — gentle twinkle */}
              <motion.circle
                cx={x}
                cy={y}
                r={r + 7}
                fill={color}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={
                  reduceMotion
                    ? { opacity: 0.14 }
                    : on
                      ? { opacity: isPrimary ? [0.18, 0.34, 0.18] : [0.1, 0.24, 0.1] }
                      : {}
                }
                transition={reduceMotion ? {} : { duration: isPrimary ? 3 : 4, delay, repeat: Infinity, ease: 'easeInOut' }}
                style={{ filter: 'blur(3px)' }}
              />
              {/* star */}
              <motion.circle
                cx={x}
                cy={y}
                fill={isPrimary ? 'var(--stardust)' : '#FFFFFF'}
                stroke={color}
                strokeWidth={isPrimary ? 2 : 1}
                initial={reduceMotion ? false : { r: 0, opacity: 0 }}
                animate={on ? { r, opacity: 1 } : {}}
                transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
              />
              {/* label */}
              <motion.text
                x={x}
                y={y - r - 10}
                textAnchor="middle"
                fill={isPrimary ? 'var(--stardust)' : 'var(--text-secondary)'}
                fontSize={isPrimary ? 13 : 12}
                fontWeight={isPrimary ? 500 : 400}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={on ? { opacity: 1 } : {}}
                transition={{ duration: 0.4, delay: delay + 0.15 }}
              >
                {n.label}
                {typeof n.match === 'number' && (
                  <tspan dx={6} fill="var(--glow)" fontSize={11}>
                    {Math.round(n.match)}%
                  </tspan>
                )}
              </motion.text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
