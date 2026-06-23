import { motion } from 'framer-motion';

/**
 * RIASEC colour map. FIVE entries are taken verbatim from the design direction;
 * `conventional` was supplied by the user afterwards (the doc omitted the 6th
 * colour). Exported so the radar chart and completion bars reuse the colours.
 */
export const RIASEC_COLORS = {
  realistic:     { bg: 'var(--riasec-r-bg)', text: 'var(--riasec-r-text)', label: 'Realistic',     letter: 'R' },
  investigative: { bg: 'var(--riasec-i-bg)', text: 'var(--riasec-i-text)', label: 'Investigative', letter: 'I' },
  artistic:      { bg: 'var(--riasec-a-bg)', text: 'var(--riasec-a-text)', label: 'Artistic',      letter: 'A' },
  social:        { bg: 'var(--riasec-s-bg)', text: 'var(--riasec-s-text)', label: 'Social',        letter: 'S' },
  enterprising:  { bg: 'var(--riasec-e-bg)', text: 'var(--riasec-e-text)', label: 'Enterprising',  letter: 'E' },
  conventional:  { bg: 'var(--riasec-c-bg)', text: 'var(--riasec-c-text)', label: 'Conventional',  letter: 'C' }, // user-confirmed
};

const LETTER_TO_KEY = {
  R: 'realistic', I: 'investigative', A: 'artistic',
  S: 'social', E: 'enterprising', C: 'conventional',
};

function resolve(category) {
  if (!category) return RIASEC_COLORS.realistic;
  const key = String(category).toLowerCase();
  if (RIASEC_COLORS[key]) return RIASEC_COLORS[key];
  return RIASEC_COLORS[LETTER_TO_KEY[String(category).toUpperCase()]] || RIASEC_COLORS.realistic;
}

/**
 * CategoryBadge — RIASEC colour pill that recolours per section. Because the
 * element is NOT re-keyed on `category`, the inline CSS transition cross-fades
 * the background/text colour when the prop changes (the "students learn the
 * colour system as they go" cue). A one-time mount fade gives it a soft entry.
 *
 * Props:
 *   category   {string}  'realistic'|… or letter 'R'|'I'|'A'|'S'|'E'|'C'
 *   showLetter {boolean} prefix a small letter chip (default false)
 *   label      {string}  override displayed text
 *   className, style
 */
export default function CategoryBadge({ category, showLetter = false, label, className = '', style = {} }) {
  const c = resolve(category);
  return (
    <motion.span
      className={`starship-caption ${className}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        borderRadius: 'var(--radius-pill)',
        backgroundColor: c.bg,
        color: c.text,
        transition: 'background-color 350ms var(--ease-emphasis), color 350ms var(--ease-emphasis)',
        ...style,
      }}
    >
      {showLetter && (
        <span
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: c.text,
            color: c.bg,
            fontSize: 10,
            lineHeight: 1,
          }}
        >
          {c.letter}
        </span>
      )}
      {label || c.label}
    </motion.span>
  );
}
