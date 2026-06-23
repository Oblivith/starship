import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { motion } from 'framer-motion';
import { CareerCard, RIASECRadar, CategoryBadge, ErrorState, EmptyState } from '../components/index.js';
import DashboardCounselor from '../components/DashboardCounselor.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getAptitudeMatch } from '../utils/aptitudeMatch.js';

/**
 * Dashboard — the home surface for a student who has completed their assessment.
 * A calm, glanceable summary (NOT the full Results report): top-3 careers,
 * interest radar, aptitude readiness, and deep links onward. Reads as a career
 * tool first; the space backdrop is AppShell's dimmed StarfieldCanvas.
 *
 * Data source (TASK 1): AuthContext `results`, with a read-only GET /results
 * self-fetch fallback for the case where context isn't hydrated yet (e.g. a
 * fresh login that bounced straight here).
 *
 * Field names verified against score_assessment.py (do not guess):
 *   top_careers       [[name, score], …]   (career_matches[:3])
 *   riasec_scores     { R,I,A,S,E,C: 0–100 }
 *   aptitude_scores   { numerical_reasoning, logical_reasoning,
 *                       verbal_reasoning, analytical_reasoning: 0–100 }
 *   career_categories { career_name: primary_trait_letter }
 */

// RIASEC letter → label, fixed R-I-A-S-E-C order.
const INTEREST = [
  ['R', 'Realistic'],
  ['I', 'Investigative'],
  ['A', 'Artistic'],
  ['S', 'Social'],
  ['E', 'Enterprising'],
  ['C', 'Conventional'],
];
const LETTER_TO_NAME = Object.fromEntries(INTEREST.map(([l, n]) => [l, n]));

// the four reasoning sub-scores (0–100), in the order the dashboard shows them.
const APTITUDE_BARS = [
  ['numerical_reasoning', 'Numerical'],
  ['logical_reasoning', 'Logical'],
  ['analytical_reasoning', 'Analytical'],
  ['verbal_reasoning', 'Verbal'],
];

// Map an engine fit score (~ -12 … +13) onto a friendly 5–99% (mirrors Results.jsx).
// The engine now returns a continuous 0–100 match percentage directly
// (score_assessment.py), so just round + clamp to a sane display band.
function scoreToPercent(score) {
  return Math.max(5, Math.min(99, Math.round(Number(score))));
}


export default function Dashboard() {
  const navigate = useNavigate();
  const { student, results: ctxResults, setResults, setStudent } = useAuth();

  const [result, setResult] = useState(ctxResults || null);
  const [status, setStatus] = useState(ctxResults ? 'ready' : 'loading'); // loading|ready|empty|error

  // Re-take confirmation (bottom of page)
  const [retakeConfirming, setRetakeConfirming] = useState(false);
  const [retakeLoading, setRetakeLoading] = useState(false);
  const [retakeError, setRetakeError] = useState('');

  const fetchResults = () => {
    setStatus('loading');
    client
      .get('/results')
      .then((res) => {
        const data = res.data?.results || null;
        setResult(data);
        if (data) setResults(data);
        setStatus(data ? 'ready' : 'empty');
      })
      .catch((err) => {
        setStatus(err?.response?.status === 404 ? 'empty' : 'error');
      });
  };

  useEffect(() => {
    if (ctxResults) {
      setResult(ctxResults);
      setStatus('ready');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    client
      .get('/results')
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.results || null;
        setResult(data);
        if (data) setResults(data); // hydrate context for later navigations
        setStatus(data ? 'ready' : 'empty');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err?.response?.status === 404 ? 'empty' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [ctxResults]);

  const {
    top_careers = [],
    career_matches = [],
    riasec_scores = {},
    aptitude_scores = {},
    career_categories = {},
  } = result || {};

  const hasAptitude = useMemo(
    () => APTITUDE_BARS.some(([k]) => Number(aptitude_scores?.[k]) > 0),
    [aptitude_scores]
  );
  const hasRiasec = useMemo(
    () => INTEREST.some(([l]) => Number(riasec_scores?.[l]) > 0),
    [riasec_scores]
  );
  const riasecTop3 = useMemo(() => {
    const ranked = INTEREST.map(([letter, name]) => ({
      letter,
      name,
      value: Number(riasec_scores?.[letter]) || 0,
    }));
    ranked.sort((a, b) => b.value - a.value);
    return ranked.slice(0, 3);
  }, [riasec_scores]);

  const firstName = (student?.name || '').trim().split(/\s+/)[0] || 'there';
  const goRoadmap = (careerName) => navigate('/roadmap', { state: { career: careerName } });

  const handleRetake = async () => {
    setRetakeLoading(true);
    setRetakeError('');
    try {
      await client.delete('/assessment');
      setResults(null);
      setStudent((prev) => prev ? { ...prev, has_completed_assessment: false } : prev);
      navigate('/assessment');
    } catch (err) {
      setRetakeError(err?.response?.data?.error || 'Could not clear your assessment. Please try again.');
      setRetakeLoading(false);
    }
  };

  // ---- gates (after hooks) ----
  if (status === 'loading') {
    return <CenterMessage title="Loading your dashboard…" subtitle="Bringing your results together." />;
  }
  if (status === 'empty') return <Navigate to="/onboarding" replace />;
  if (status === 'error' || !result) {
    return (
      <ErrorState
        title="Couldn't load your dashboard"
        message="Something went wrong fetching your results. Please try again."
        onRetry={fetchResults}
      />
    );
  }
  if (!career_matches.length) {
    return (
      <div style={{ minHeight: 'calc(100vh - 58px)', display: 'grid', placeItems: 'center', padding: '40px 20px' }}>
        <EmptyState
          title="No career matches yet"
          message="Your results are still being computed. This won't take long — try refreshing in a moment."
          icon="star"
        />
      </div>
    );
  }

  return (
    <div className="page-serif" style={{ padding: 'clamp(32px, 6vw, 64px) 20px 120px' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        {/* ---- top row: welcome + counselor (counselor wraps below on mobile) ---- */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'clamp(20px, 4vw, 32px)',
            alignItems: 'flex-start',
            marginBottom: 'clamp(40px, 7vw, 64px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            style={{ flex: '1 1 520px', minWidth: 0 }}
          >
            <p className="starship-caption" style={{ color: 'var(--glow)', marginBottom: 12 }}>
              Your dashboard
            </p>
            <h1
              style={{
                fontSize: 'clamp(30px, 4vw, 40px)',
                fontWeight: 'var(--fw-medium)',
                lineHeight: 'var(--lh-tight)',
                margin: 0,
                color: 'var(--text-primary)',
              }}
            >
              Welcome back, {firstName}.
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: '12px 0 0', maxWidth: 520, lineHeight: 'var(--lh-body)' }}>
              Your future is clearer than yesterday.
            </p>
          </motion.div>

          {/* TASK 4 — prominent AI counselor (top-right on desktop, here-below on mobile) */}
          <DashboardCounselor />
        </div>

        {/* ---- 1. Top 3 career recommendations ---- */}
        <Section eyebrow="Top matches" title="Careers that fit you">
          {top_careers.length ? (
            <div style={cardGrid}>
              {top_careers.map(([name, score], i) => {
                const interest = scoreToPercent(score);
                const cat = career_categories[name];
                const aptMatch = getAptitudeMatch(name, career_categories, aptitude_scores);
                return (
                  <CareerCard
                    key={`${name}-${i}`}
                    title={name}
                    field={cat ? LETTER_TO_NAME[cat] : undefined}
                    matchPercent={interest}
                    demand={`Interest ${interest}%`}
                    salaryRange={hasAptitude ? `Aptitude ${aptMatch}%` : undefined}
                    index={i}
                    onClick={() => goRoadmap(name)}
                  />
                );
              })}
            </div>
          ) : (
            <Empty>Your top matches will appear here once scoring completes.</Empty>
          )}
        </Section>

        {/* ---- 2. Interest profile (RIASEC radar, 280px) ---- */}
        <Section eyebrow="Interest profile" title="What you're drawn to">
          {hasRiasec ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'clamp(20px, 5vw, 48px)',
              }}
            >
              <RIASECRadar scores={riasec_scores} size={280} />
              <div style={{ minWidth: 200 }}>
                <p className="starship-caption" style={{ color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Your strongest areas
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {riasecTop3.map((r) => (
                    <div key={r.letter} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <CategoryBadge category={r.letter} showLetter />
                      <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-secondary)' }}>{r.name}</span>
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: 'var(--fs-body-sm)',
                          fontWeight: 'var(--fw-medium)',
                          color: 'var(--stardust)',
                        }}
                      >
                        {Math.round(r.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <Empty>Your interest profile will appear here once scoring completes.</Empty>
          )}
        </Section>

        {/* ---- 3. Aptitude performance (4 horizontal bars) ---- */}
        <Section eyebrow="Aptitude" title="How you reason">
          {hasAptitude ? (
            <div style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {APTITUDE_BARS.map(([key, label], i) => (
                <AptitudeBar key={key} label={label} value={Number(aptitude_scores?.[key]) || 0} index={i} />
              ))}
            </div>
          ) : (
            <Empty>Your aptitude breakdown will appear here once scoring completes.</Empty>
          )}
        </Section>

        {/* ---- 4. Quick links ---- */}
        <Section eyebrow="Go deeper" title="Explore your options">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <QuickLink to="/careers" label="Explore all careers" />
            <QuickLink to="/results" label="View full results" />
          </div>
        </Section>

        {/* ---- 5. Starship Scholars teaser (subtle) ---- */}
        <div
          style={{
            marginTop: 'clamp(44px, 8vw, 80px)',
            padding: '22px 24px',
            borderRadius: 'var(--radius-card)',
            background: 'rgba(15, 14, 42, 0.5)',
            border: '1px solid rgba(239, 159, 39, 0.18)',
          }}
        >
          <p className="starship-caption" style={{ color: 'var(--warm)', marginBottom: 8 }}>
            Starship Scholars
          </p>
          <p
            style={{
              color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: 1.7,
              fontSize: 'var(--fs-body-sm)',
              maxWidth: 640,
            }}
          >
            Each year, Starship supports a small number of exceptional students who need it most. Keep achieving.
          </p>
        </div>

        {/* ---- 6. Re-take link (very bottom) ---- */}
        {/* The wrapper reserves min-height so the layout doesn't jump when
            the confirmation replaces the text link. No position:fixed. */}
        <div style={{ marginTop: 'clamp(36px, 6vw, 56px)', minHeight: 116 }}>
          {!retakeConfirming ? (
            <p style={{ textAlign: 'center', margin: 0, fontSize: 'var(--fs-body-sm)', color: 'var(--text-secondary)' }}>
              Want to start fresh?{' '}
              <button
                type="button"
                onClick={() => setRetakeConfirming(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--coral)',
                  fontSize: 'var(--fs-body-sm)',
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                Re-take the assessment →
              </button>
            </p>
          ) : (
            <div
              style={{
                background: 'var(--deep)',
                border: '1px solid var(--violet)',
                borderRadius: 'var(--radius-card)',
                padding: '20px 22px',
                maxWidth: 480,
                margin: '0 auto',
              }}
            >
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-body-sm)', lineHeight: 1.7, margin: '0 0 16px' }}>
                This will clear your results and career matches. This cannot be undone.
              </p>
              {retakeError && (
                <p style={{ color: 'var(--coral)', fontSize: 'var(--fs-body-sm)', margin: '0 0 12px' }}>
                  {retakeError}
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={retakeLoading}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--coral)',
                    color: 'var(--coral)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 16px',
                    fontSize: 'var(--fs-body-sm)',
                    fontWeight: 'var(--fw-medium)',
                    fontFamily: 'var(--font-sans)',
                    cursor: retakeLoading ? 'not-allowed' : 'pointer',
                    opacity: retakeLoading ? 0.6 : 1,
                  }}
                >
                  {retakeLoading ? 'Clearing…' : 'Yes, re-take'}
                </button>
                <button
                  type="button"
                  onClick={() => { setRetakeConfirming(false); setRetakeError(''); }}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(200,184,255,0.25)',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 16px',
                    fontSize: 'var(--fs-body-sm)',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- building blocks ---------- */

const cardGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: 'clamp(12px, 3vw, 18px)',
};

const retryButtonStyle = {
  padding: '10px 20px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--violet)',
  border: '1px solid var(--violet)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  fontWeight: 'var(--fw-medium)',
  fontSize: 'var(--fs-body-sm)',
};

// One labelled horizontal aptitude bar. Mount-animates its width (visible even in
// the headless/hidden preview, unlike scroll-triggered reveals).
function AptitudeBar({ label, value, index }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-body-sm)' }}>{label}</span>
        <span style={{ color: 'var(--stardust)', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-medium)' }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1], delay: index * 0.08 }}
          style={{ height: '100%', background: 'var(--gradient-brand)' }}
        />
      </div>
    </div>
  );
}

function QuickLink({ to, label }) {
  return (
    <Link
      to={to}
      style={{
        flex: '1 1 240px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '16px 20px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--deep)',
        border: '1px solid rgba(200,184,255,0.12)',
        color: 'var(--text-primary)',
        textDecoration: 'none',
        fontSize: 'var(--fs-body)',
        fontWeight: 'var(--fw-medium)',
      }}
    >
      <span>{label}</span>
      <span aria-hidden style={{ color: 'var(--glow)' }}>
        →
      </span>
    </Link>
  );
}

function Section({ eyebrow, title, children }) {
  return (
    <section style={{ marginTop: 'clamp(40px, 7vw, 72px)' }}>
      <p className="starship-caption" style={{ color: 'var(--glow)', marginBottom: 10 }}>
        {eyebrow}
      </p>
      <h2
        style={{
          fontSize: 'var(--fs-section)',
          fontWeight: 'var(--fw-medium)',
          lineHeight: 1.25,
          margin: '0 0 1.5rem',
          color: 'var(--text-primary)',
          letterSpacing: 'var(--ls-heading)',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function CenterMessage({ title, subtitle, action }) {
  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', display: 'grid', placeItems: 'center', padding: '40px 20px' }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div
          aria-hidden
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--glow)',
            boxShadow: '0 0 18px var(--glow)',
            margin: '0 auto 22px',
          }}
        />
        <h1 style={{ fontSize: 'var(--fs-section)', fontWeight: 'var(--fw-medium)', margin: '0 0 10px', color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {subtitle && <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{subtitle}</p>}
        {action && <div style={{ marginTop: 22 }}>{action}</div>}
      </div>
    </div>
  );
}

function Empty({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        background: 'var(--deep)',
        border: '1px dashed rgba(200,184,255,0.16)',
        borderRadius: 'var(--radius-card)',
        padding: '20px 22px',
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
        fontSize: 'var(--fs-body-sm)',
      }}
    >
      <span
        aria-hidden
        style={{ flex: '0 0 auto', width: 8, height: 8, borderRadius: '50%', background: 'var(--stardust)', marginTop: 8 }}
      />
      <span>{children}</span>
    </div>
  );
}
