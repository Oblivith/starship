import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/**
 * SpotIllustration — small inline SVG spot art for the "How it works" steps.
 * One flat, line-led glyph per `name`, drawn in the brand palette on a soft
 * tinted disc. A single accent element animates (draw-on or pop) the first time
 * it scrolls into view; everything respects reduced motion. Decorative.
 *
 *   assess   — answer the questions (bubble scale)
 *   analyze  — we read your RIASEC profile (radar)
 *   match    — career matches land (target + star)
 *   fund     — scholarships & funding (rupee)
 *   guide    — the AI counselor (chat)
 *
 * Props:
 *   name   {string}  one of the keys above (default 'assess')
 *   size   {number}  px (default 96)
 *   className, style
 */
const TINT = {
  assess:  { ring: 'rgba(91,82,184,0.16)',  accent: 'var(--violet)' },
  analyze: { ring: 'rgba(77,217,184,0.14)', accent: 'var(--glow)' },
  match:   { ring: 'rgba(91,82,184,0.16)',  accent: 'var(--stardust)' },
  fund:    { ring: 'rgba(239,159,39,0.14)', accent: 'var(--gold)' },
  guide:   { ring: 'rgba(77,217,184,0.14)', accent: 'var(--glow)' },
};

// 5-point star centred on (48,48), outer r≈15 / inner r≈6.
const STAR = '48,33 51.5,43.2 62.3,43.4 53.7,49.9 56.8,60.1 48,54 39.2,60.1 42.3,49.9 33.7,43.4 44.5,43.2';

export default function SpotIllustration({ name = 'assess', size = 96, className = '', style = {} }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduceMotion = useReducedMotion();
  const t = TINT[name] || TINT.assess;
  const stroke = 'var(--stardust)';
  const on = inView || reduceMotion;

  const draw = (delay = 0) => ({
    initial: reduceMotion ? false : { pathLength: 0, opacity: 0 },
    animate: on ? { pathLength: 1, opacity: 1 } : {},
    transition: { duration: 0.9, delay, ease: [0.4, 0, 0.2, 1] },
  });
  const popR = (r, delay = 0.5) => ({
    initial: reduceMotion ? false : { r: 0, opacity: 0 },
    animate: on ? { r, opacity: 1 } : {},
    transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] },
  });
  const popScale = (delay = 0.5) => ({
    initial: reduceMotion ? false : { scale: 0, opacity: 0 },
    animate: on ? { scale: 1, opacity: 1 } : {},
    transition: { duration: 0.45, delay, ease: [0.4, 0, 0.2, 1] },
    style: { transformBox: 'fill-box', transformOrigin: 'center' },
  });

  let glyph;
  switch (name) {
    case 'analyze':
      glyph = (
        <g>
          <polygon points="48,24 69,36 69,60 48,72 27,60 27,36" stroke={stroke} strokeOpacity="0.5" strokeWidth="2" fill="none" strokeLinejoin="round" />
          <line x1="48" y1="48" x2="48" y2="24" stroke={stroke} strokeOpacity="0.25" strokeWidth="1.5" />
          <line x1="48" y1="48" x2="69" y2="60" stroke={stroke} strokeOpacity="0.25" strokeWidth="1.5" />
          <line x1="48" y1="48" x2="27" y2="60" stroke={stroke} strokeOpacity="0.25" strokeWidth="1.5" />
          <motion.polygon points="48,32 61,43 57,59 41,57 35,42" stroke={t.accent} strokeWidth="2.5" fill={t.accent} fillOpacity="0.18" strokeLinejoin="round" {...draw()} />
        </g>
      );
      break;
    case 'match':
      glyph = (
        <g>
          <circle cx="48" cy="48" r="20" stroke={stroke} strokeOpacity="0.4" strokeWidth="2" fill="none" />
          <circle cx="48" cy="48" r="11" stroke={stroke} strokeOpacity="0.3" strokeWidth="2" fill="none" />
          <motion.polygon points={STAR} fill={t.accent} {...popScale()} />
        </g>
      );
      break;
    case 'fund':
      glyph = (
        <g>
          <circle cx="48" cy="48" r="20" stroke={t.accent} strokeOpacity="0.25" strokeWidth="2" fill="none" />
          <motion.circle cx="48" cy="48" r="20" stroke={t.accent} strokeWidth="2.5" fill="none" {...draw()} />
          <path d="M42 39 H54 M42 44 H54 M52 39 C52 46 46 47 43 47 L53 58" stroke={stroke} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
      break;
    case 'guide':
      glyph = (
        <g>
          <path
            d="M30 36 H66 a4 4 0 0 1 4 4 V56 a4 4 0 0 1 -4 4 H44 l-9 8 v-8 H30 a4 4 0 0 1 -4 -4 V40 a4 4 0 0 1 4 -4 z"
            stroke={stroke} strokeOpacity="0.45" strokeWidth="2" fill="none" strokeLinejoin="round"
          />
          <motion.circle cx="40" cy="48" fill={t.accent} {...popR(2.5, 0.5)} />
          <motion.circle cx="48" cy="48" fill={t.accent} {...popR(2.5, 0.62)} />
          <motion.circle cx="56" cy="48" fill={t.accent} {...popR(2.5, 0.74)} />
        </g>
      );
      break;
    case 'assess':
    default:
      glyph = (
        <g>
          <rect x="30" y="26" width="36" height="44" rx="5" stroke={stroke} strokeOpacity="0.45" strokeWidth="2" fill="none" />
          <line x1="37" y1="38" x2="59" y2="38" stroke={stroke} strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" />
          <line x1="37" y1="46" x2="59" y2="46" stroke={stroke} strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" />
          <circle cx="39" cy="59" r="3.5" stroke={t.accent} strokeWidth="2" fill="none" />
          <motion.circle cx="48" cy="59" fill={t.accent} {...popR(3.5, 0.5)} />
          <circle cx="57" cy="59" r="3.5" stroke={t.accent} strokeWidth="2" fill="none" />
        </g>
      );
  }

  return (
    <div ref={ref} className={className} style={{ width: size, height: size, ...style }}>
      <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true" style={{ display: 'block' }}>
        <circle cx="48" cy="48" r="46" fill={t.ring} />
        {glyph}
      </svg>
    </div>
  );
}
