import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import StarfieldCanvas from '../components/StarfieldCanvas.jsx';
import { SpotIllustration } from '../components/index.js';

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return mobile;
}

/**
 * HowItWorks — the public "/how-it-works" marketing page. Replaces the branded
 * placeholder. Five steps (Assess · Analyze · Match · Fund · Guide), one
 * SpotIllustration each, revealed on scroll.
 *
 * This page is NOT GSAP-pinned, so Framer Motion `whileInView` is safe here (the
 * pin-spacer orphaning bug only applies inside ScrollTrigger-pinned sections).
 * Above-the-fold hero uses a mount `animate` so it never waits on an observer.
 *
 * Aesthetic matches Landing: dark void background, token colours, font-weight
 * never above 500, no gradient text, StarfieldCanvas backdrop.
 */
const STEPS = [
  {
    name: 'assess',
    headline: 'Discover yourself',
    body: 'Answer 155 questions designed to map your interests, aptitude, and values. No right or wrong answers — just you.',
  },
  {
    name: 'analyze',
    headline: 'Your unique pattern',
    body: 'Our engine builds your RIASEC profile and identifies the cognitive strengths that set you apart.',
  },
  {
    name: 'match',
    headline: 'Careers that fit',
    body: 'We match your profile against real career paths and show you exactly why each one fits — or doesn’t.',
  },
  {
    name: 'fund',
    headline: 'Find your funding',
    body: 'Scholarships and universities filtered to your budget and location. No irrelevant results.',
  },
  {
    name: 'guide',
    headline: 'Your AI counselor',
    body: 'Ask anything. Our counselor knows your results and gives guidance that’s specific to you.',
  },
];

const EASE = [0.4, 0, 0.2, 1];

export default function HowItWorks() {
  const isMobile = useIsMobile();
  const [ctaHover, setCtaHover] = useState(false);
  return (
    <div className="page-serif" style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <StarfieldCanvas glowColor="rgba(83,74,183,0.14)" />

      {/* top bar — reads immediately as a product, not a space website */}
      <header
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'clamp(18px, 3vw, 26px) clamp(20px, 5vw, 48px)',
        }}
      >
        <Link
          to="/"
          style={{
            textDecoration: 'none',
            color: 'var(--text-primary)',
            fontSize: 17,
            fontWeight: 'var(--fw-medium)',
            letterSpacing: '0.06em',
          }}
        >
          STARSHIP
        </Link>
        <Link
          to="/onboarding"
          className="starship-caption"
          style={{
            textDecoration: 'none',
            color: 'var(--stardust)',
            padding: '8px 18px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(200,184,255,0.28)',
          }}
        >
          Start →
        </Link>
      </header>

      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 920,
          margin: '0 auto',
          padding: '0 clamp(20px, 5vw, 40px) clamp(80px, 12vw, 140px)',
        }}
      >
        {/* ---- hero (mount reveal — above the fold) ---- */}
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{
            textAlign: 'center',
            maxWidth: 680,
            margin: '0 auto',
            paddingTop: 'clamp(36px, 8vw, 80px)',
          }}
        >
          <p className="starship-caption" style={{ color: 'var(--glow)', marginBottom: 16 }}>
            How it works
          </p>
          <h1
            style={{
              fontSize: 'var(--fs-hero)',
              fontWeight: 'var(--fw-medium)',
              lineHeight: 'var(--lh-tight)',
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            How <span style={{ color: 'var(--stardust)' }}>STARSHIP</span> works
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 'var(--fs-body)',
              lineHeight: 1.8,
              margin: '16px auto 0',
              maxWidth: 480,
            }}
          >
            Five steps from uncertainty to clarity.
          </p>
        </motion.header>

        {/* ---- the five steps ---- */}
        <div style={{ marginTop: 'clamp(48px, 9vw, 96px)' }}>
          {STEPS.map((step, i) => (
            <motion.section
              key={step.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, ease: EASE }}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'clamp(20px, 4vw, 48px)',
                marginBottom: 'clamp(44px, 8vw, 84px)',
              }}
            >
              {/* illustration — left on desktop, top on mobile (flex wraps) */}
              <div style={{ flex: '0 0 auto' }}>
                <SpotIllustration name={step.name} size={isMobile ? 80 : 132} />
              </div>

              {/* step number + headline + description */}
              <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                <p className="starship-caption" style={{ color: 'var(--glow)', marginBottom: 10 }}>
                  Step {i + 1}
                </p>
                <h2
                  style={{
                    fontSize: 'var(--fs-section)',
                    fontWeight: 'var(--fw-medium)',
                    lineHeight: 1.2,
                    margin: '0 0 14px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {step.headline}
                </h2>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 'var(--fs-body)',
                    lineHeight: 'var(--lh-body)',
                    margin: 0,
                    maxWidth: 520,
                  }}
                >
                  {step.body}
                </p>
              </div>
            </motion.section>
          ))}
        </div>

        {/* ---- closing CTA ---- */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{ textAlign: 'center', marginTop: 'clamp(32px, 6vw, 64px)' }}
        >
          <h2
            style={{
              fontSize: 'var(--fs-section)',
              fontWeight: 'var(--fw-medium)',
              lineHeight: 1.2,
              margin: '0 0 22px',
              color: 'var(--text-primary)',
            }}
          >
            Ready when you are.
          </h2>
          <Link
            to="/onboarding"
            onMouseEnter={() => setCtaHover(true)}
            onMouseLeave={() => setCtaHover(false)}
            onFocus={() => setCtaHover(true)}
            onBlur={() => setCtaHover(false)}
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--violet)',
              color: 'var(--text-primary)',
              textDecoration: 'none',
              fontSize: 'var(--fs-body)',
              fontWeight: 'var(--fw-medium)',
              opacity: ctaHover ? 0.88 : 1,
              boxShadow: ctaHover ? 'var(--glow-violet)' : '0 0 0 rgba(0,0,0,0)',
              transition: 'opacity 160ms var(--ease-emphasis), box-shadow 200ms var(--ease-emphasis)',
            }}
          >
            Start your assessment
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
