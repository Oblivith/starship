import { useState, useEffect } from 'react';

const styles = `
@keyframes starPulse {
  0%, 100% { transform: scale(0.9); opacity: 0.5; }
  50%       { transform: scale(1.08); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .loading-star { animation: none !important; opacity: 1 !important; transform: scale(1) !important; }
}
`;

export default function LoadingScreen() {
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(
    () => !!sessionStorage.getItem('starship_loaded')
  );

  useEffect(() => {
    if (gone) return;
    const t1 = setTimeout(() => setFading(true), 1200);
    const t2 = setTimeout(() => {
      sessionStorage.setItem('starship_loaded', '1');
      setGone(true);
    }, 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [gone]);

  if (gone) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0F0E2A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        opacity: fading ? 0 : 1,
        transition: fading ? 'opacity 400ms ease' : 'none',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <style>{styles}</style>
      <svg
        className="loading-star"
        width="40"
        height="40"
        viewBox="0 0 18 18"
        aria-hidden="true"
        style={{ animation: 'starPulse 1.8s ease-in-out infinite' }}
      >
        <path
          d="M9 0.5 L11 6.6 L17.5 9 L11 11.4 L9 17.5 L7 11.4 L0.5 9 L7 6.6 Z"
          fill="var(--stardust)"
        />
      </svg>
      <span className="starship-caption">Loading</span>
    </div>
  );
}
