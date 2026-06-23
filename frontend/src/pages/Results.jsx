import { useEffect, useMemo, useState, useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  RIASECRadar,
  CategoryBadge,
  CareerCard,
  ScholarshipCard,
  UniversityCard,
  StatCounter,
  ConstellationMap,
  ErrorState,
  EmptyState,
} from '../components/index.js';
import CounselorOrb from '../components/CounselorOrb.jsx';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Results — the payoff. Renders the engine output.
 *
 * Source of the result (BUG 1 — results must persist):
 *   • Straight from the funnel, /submit-assessment hands the result via router
 *     state (location.state).
 *   • On a direct visit or a redirect (a completed student bounced here from
 *     /onboarding or /assessment), there is no router state — so we load it from
 *     GET /results. That endpoint re-runs the READ-ONLY scoring engine over the
 *     student's saved answers; it never creates a session or overwrites anything.
 *     If the student has no completed assessment, it 404s and we send them to
 *     /onboarding to start one.
 *
 * Shape (verified in score_assessment.py — tuples arrive as JSON arrays):
 *   career_matches   [[name, score], …]            good_alternatives [[name, score], …]
 *   top_careers      [[name, score], …]            careers_to_avoid  [[name, score], …]
 *   recommended_paths[[name, score], …]            universities      [{name, estimated_cost}]
 *   financials       [{university, affordability_ratio, risk_level}]
 *   riasec_scores    { R,I,A,S,E,C: 0–100 float }  scholarships      [{name, amount_max_inr,
 *                                                                       competitiveness_level}]
 */

// RIASEC letter → human label, fixed R-I-A-S-E-C order.
const INTEREST = [
  ['R', 'Realistic'],
  ['I', 'Investigative'],
  ['A', 'Artistic'],
  ['S', 'Social'],
  ['E', 'Enterprising'],
  ['C', 'Conventional'],
];

// Map an engine fit score (~ -12 … +13) onto a friendly 5–99% bar.
// The engine now returns a continuous 0–100 match percentage directly
// (score_assessment.py), so just round + clamp to a sane display band.
function scoreToPercent(score) {
  return Math.max(5, Math.min(99, Math.round(Number(score))));
}

// scholarships carry competitiveness_level 1 (most accessible) … 5 (most
// competitive); NULL is treated as highly competitive, mirroring the engine
// (score_assessment.py: comp <= 2 high-chance, == 3 moderate, else competitive).
function competitivenessTag(level) {
  if (level != null && level <= 2) return 'Less competitive';
  if (level === 3) return 'Moderately competitive';
  return 'Highly competitive';
}

// Constellation layout (normalised 0–1), up to 6 nodes, arranged like a sky.
const NODE_POS = [
  { x: 0.5, y: 0.28 },
  { x: 0.2, y: 0.5 },
  { x: 0.8, y: 0.46 },
  { x: 0.36, y: 0.78 },
  { x: 0.66, y: 0.8 },
  { x: 0.5, y: 0.55 },
];

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { student, results: ctxResults, setResults } = useAuth();

  // TASK 1 — the result comes from AuthContext first (set after submit / restored
  // on mount), then router state straight after /submit-assessment, then a direct
  // GET /results self-fetch (returning student / direct visit).
  const initialResult = ctxResults || location.state || null;
  const [result, setResult] = useState(initialResult);
  const [status, setStatus] = useState(initialResult ? 'ready' : 'loading'); // loading|ready|empty|error

  const fetchResults = () => {
    setStatus('loading');
    client
      .get('/results')
      .then((res) => {
        const data = res.data?.results || null;
        setResult(data);
        if (data) setResults(data); // hydrate context for later navigations
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
    if (location.state) {
      setResult(location.state);
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
  }, [ctxResults, location.state]);

  // Destructure with safe defaults so the hooks below run unconditionally even
  // while loading / when there's no result (we branch after the hooks).
  const {
    career_matches = [],
    top_careers = [],
    good_alternatives = [],
    careers_to_avoid = [],
    universities = [],
    financials = [],
    riasec_scores = {},
    scholarships = [],
  } = result || {};

  // ---- RIASEC from real numeric scores (0–100, keyed by letter) ------------
  const riasec = useMemo(() => {
    const ranked = INTEREST.map(([letter, name]) => ({
      letter,
      name,
      value: Number(riasec_scores?.[letter]) || 0,
    }));
    ranked.sort((a, b) => b.value - a.value);
    return { top3: ranked.slice(0, 3), hasData: ranked.some((r) => r.value > 0) };
  }, [riasec_scores]);

  const goRoadmap = (careerName) => navigate('/roadmap', { state: { career: careerName } });

  // Track which scholarship card is expanded (only one at a time)
  const [expandedScholarship, setExpandedScholarship] = useState(null);
  const toggleScholarship = useCallback((key) => {
    setExpandedScholarship((prev) => (prev === key ? null : key));
  }, []);

  // financials lookup by university name (for the risk tag)
  const riskByUni = useMemo(() => {
    const m = {};
    financials.forEach((f) => {
      if (f?.university) m[f.university] = f.risk_level;
    });
    return m;
  }, [financials]);

  // constellation nodes from the strongest careers
  const nodes = useMemo(() => {
    const picked = [...top_careers, ...good_alternatives].slice(0, NODE_POS.length);
    return picked.map(([name, score], i) => ({
      id: name,
      label: name,
      x: NODE_POS[i].x,
      y: NODE_POS[i].y,
      primary: i === 0,
      match: scoreToPercent(score),
    }));
  }, [top_careers, good_alternatives]);

  const firstName = (student?.name || '').trim().split(/\s+/)[0] || 'there';

  // ---- load / empty / error gates (after all hooks have run) ----
  if (status === 'loading') {
    return <CenterMessage title="Loading your results…" subtitle="Re-scoring your saved answers." />;
  }
  if (status === 'empty') return <Navigate to="/onboarding" replace />;
  if (status === 'error' || !result) {
    return (
      <ErrorState
        title="Couldn't load your results"
        message="Something went wrong fetching your results. Please try again."
        onRetry={fetchResults}
      />
    );
  }

  return (
    <div className="page-serif" style={{ padding: 'clamp(36px, 6vw, 72px) 20px 120px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        {/* ---- header (mount reveal, always visible above the fold) ---- */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <p className="starship-caption" style={{ color: 'var(--glow)', marginBottom: 12 }}>
            Your results
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
            Here's your map, {firstName}.
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '14px 0 0', maxWidth: 560, lineHeight: 'var(--lh-body)' }}>
            Built from your {career_matches.length ? 'answers' : 'assessment'} — your interests, strengths and
            situation, matched to real careers and colleges.
          </p>
        </motion.div>

        {/* ---- 1. RIASEC ---- */}
        <Section eyebrow="Interest profile" title="What you're drawn to">
          {riasec.hasData ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'clamp(24px, 5vw, 56px)',
                justifyContent: 'center',
              }}
            >
              <RIASECRadar scores={riasec_scores} size={300} />
              <div style={{ minWidth: 220 }}>
                <p className="starship-caption" style={{ color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Your top areas
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {riasec.top3.map((r) => (
                    <div key={r.letter} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <CategoryBadge category={r.letter} showLetter />
                      <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-secondary)' }}>
                        {r.name}
                      </span>
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

        {/* ---- 2. Career matches ---- */}
        <Section eyebrow="Career matches" title="Paths that fit you">
          <CareerBucket
            label="Your strongest matches"
            accent="var(--glow)"
            careers={top_careers}
            onPick={goRoadmap}
          />
          <CareerBucket
            label="Also worth exploring"
            accent="var(--stardust)"
            careers={good_alternatives}
            onPick={goRoadmap}
          />
          <CareerBucket
            label="Bigger reaches — would need more preparation"
            accent="var(--warm)"
            careers={careers_to_avoid}
            onPick={goRoadmap}
            muted
          />
        </Section>

        {/* ---- 3. Scholarships ---- */}
        <Section eyebrow="Funding" title="Scholarships you could apply for">
          {scholarships.length ? (
            <div style={gridStyle}>
              {scholarships.map((s, i) => {
                const amount =
                  typeof s.amount_max_inr === 'number' && s.amount_max_inr > 0 ? s.amount_max_inr : null;
                const key = `${s.name}-${i}`;
                return (
                  <ScholarshipCard
                    key={key}
                    name={s.name}
                    amount={amount ?? 'Amount varies'}
                    period="max"
                    eligibility={[competitivenessTag(s.competitiveness_level)]}
                    index={i}
                    description={s.description}
                    eligibilityText={s.eligibility_criteria}
                    providerName={s.provider_name}
                    streamTags={s.stream_tags || []}
                    deadlineMonth={s.deadline_month}
                    applyUrl={s.application_url}
                    expanded={expandedScholarship === key}
                    onToggle={() => toggleScholarship(key)}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="star"
              title="No scholarships matched yet"
              message='No scholarships matched your profile just yet. Ask the counselor "Which scholarships can I apply for?" for ideas — and check back as we verify more funding data.'
            />
          )}
        </Section>

        {/* ---- 4. Universities ---- */}
        <Section eyebrow="Colleges" title="Where you could study">
          {universities.length ? (
            <div style={gridStyle}>
              {universities.map((u, i) => {
                const cost = typeof u.estimated_cost === 'number' && u.estimated_cost > 0 ? u.estimated_cost : null;
                const risk = riskByUni[u.name];
                return (
                  <UniversityCard
                    key={`${u.name}-${i}`}
                    name={u.name}
                    annualCost={cost}
                    index={i}
                    programs={risk ? [`${risk} financial risk`] : []}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="map"
              title="No colleges matched yet"
              message="College matches for your state and budget will appear as we expand cost and cutoff data. The counselor can still suggest options to research now."
            />
          )}
        </Section>

        {/* ---- 5. Stats ---- */}
        <Section eyebrow="At a glance" title="Your shortlist in numbers">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 24,
              maxWidth: 720,
              margin: '0 auto',
            }}
          >
            <StatCounter value={career_matches.length} label="Careers analysed" />
            <StatCounter value={universities.length} label="Colleges matched" />
            <StatCounter value={top_careers.length} label="Strong-fit careers" />
          </div>
        </Section>

        {/* ---- 6. Constellation ---- */}
        {nodes.length > 0 && (
          <Section eyebrow="Explore" title="Tap a star to see its roadmap">
            <ConstellationMap nodes={nodes} height={380} onSelect={(n) => goRoadmap(n.label)} />
          </Section>
        )}
      </div>

      {/* floating AI counselor */}
      <CounselorOrb />
    </div>
  );
}

/* ---------- small building blocks ---------- */

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: 18,
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

function Section({ eyebrow, title, children }) {
  return (
    <section style={{ marginTop: 'clamp(48px, 8vw, 84px)' }}>
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

function CareerBucket({ label, accent, careers, onPick, muted = false }) {
  if (!careers || careers.length === 0) return null;
  return (
    <div style={{ marginBottom: 30 }}>
      <p className="starship-caption" style={{ color: accent, marginBottom: 14 }}>
        {label}
      </p>
      <div style={{ ...gridStyle, opacity: muted ? 0.82 : 1 }}>
        {careers.map(([name, score], i) => (
          <CareerCard
            key={`${name}-${i}`}
            title={name}
            matchPercent={scoreToPercent(score)}
            index={i}
            onClick={() => onPick(name)}
          />
        ))}
      </div>
    </div>
  );
}

function Empty({ children, tone = 'violet' }) {
  const tones = {
    violet: { border: 'rgba(200,184,255,0.16)', dot: 'var(--stardust)' },
    gold: { border: 'rgba(239,159,39,0.30)', dot: 'var(--warm)' },
  };
  const t = tones[tone] || tones.violet;
  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        background: 'var(--deep)',
        border: `1px dashed ${t.border}`,
        borderRadius: 'var(--radius-card)',
        padding: '20px 22px',
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
        fontSize: 'var(--fs-body-sm)',
      }}
    >
      <span
        aria-hidden
        style={{ flex: '0 0 auto', width: 8, height: 8, borderRadius: '50%', background: t.dot, marginTop: 8 }}
      />
      <span>{children}</span>
    </div>
  );
}
