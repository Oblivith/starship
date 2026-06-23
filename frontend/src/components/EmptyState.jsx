/**
 * EmptyState — inline empty-content card, no retry.
 * Props: { title, message, icon?: "star" | "compass" | "map" }
 */

const StarIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
    <polygon
      points="14,2 16.9,10.1 25.5,10.1 18.8,15.5 21.2,24 14,19 6.8,24 9.2,15.5 2.5,10.1 11.1,10.1"
      stroke="var(--stardust)"
      strokeWidth="1.3"
      fill="none"
      opacity="0.7"
    />
  </svg>
);

const CompassIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
    <circle cx="14" cy="14" r="11.5" stroke="var(--stardust)" strokeWidth="1.3" opacity="0.7" />
    <circle cx="14" cy="14" r="2" fill="var(--stardust)" opacity="0.7" />
    <path d="M14 4.5 L15.2 12.5 L14 12 L12.8 12.5 Z" fill="var(--stardust)" opacity="0.7" />
    <path d="M14 23.5 L12.8 15.5 L14 16 L15.2 15.5 Z" fill="var(--stardust)" opacity="0.3" />
  </svg>
);

const MapIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
    <path
      d="M4 7 L10 4.5 L18 8 L24 5.5 L24 22 L18 24.5 L10 21 L4 23.5 Z"
      stroke="var(--stardust)"
      strokeWidth="1.3"
      fill="none"
      opacity="0.7"
    />
    <line x1="10" y1="4.5" x2="10" y2="21" stroke="var(--stardust)" strokeWidth="0.9" opacity="0.4" />
    <line x1="18" y1="8" x2="18" y2="24.5" stroke="var(--stardust)" strokeWidth="0.9" opacity="0.4" />
  </svg>
);

const ICONS = { star: StarIcon, compass: CompassIcon, map: MapIcon };

export default function EmptyState({ title, message, icon }) {
  const Icon = icon ? ICONS[icon] : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12,
        background: 'var(--deep)',
        border: '1px dashed rgba(200,184,255,0.18)',
        borderRadius: 'var(--radius-card)',
        padding: 'clamp(20px, 4vw, 30px) clamp(18px, 4vw, 28px)',
      }}
    >
      {Icon && (
        <div style={{ opacity: 0.85 }}>
          <Icon />
        </div>
      )}
      {title && (
        <p
          style={{
            fontSize: 'var(--fs-body)',
            fontWeight: 'var(--fw-medium)',
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {title}
        </p>
      )}
      {message && (
        <p
          style={{
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--moonstone)',
            margin: 0,
            lineHeight: 1.7,
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
