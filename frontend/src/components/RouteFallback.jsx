/**
 * RouteFallback — Suspense fallback shown while a lazily-loaded route chunk is
 * fetched (Change 4, code-splitting). A single pulsing stardust dot centred on the
 * void; brief, and only shown the first time a given page chunk is downloaded
 * (the chunk is cached thereafter). role="status" so assistive tech announces it.
 */
export default function RouteFallback() {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '40px 20px' }}
    >
      <span
        aria-hidden
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: 'var(--glow)',
          boxShadow: '0 0 18px var(--glow)',
          animation: 'starshipFallbackPulse 1.1s var(--ease-emphasis) infinite',
        }}
      />
      <style>{`@keyframes starshipFallbackPulse{0%,100%{opacity:.4;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}`}</style>
    </div>
  );
}
