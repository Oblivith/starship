import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CareerCard, CategoryBadge, RIASEC_COLORS, ErrorState, EmptyState } from '../components/index.js';
import CounselorOrb from '../components/CounselorOrb.jsx';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getAptitudeMatch } from '../utils/aptitudeMatch.js';
import {
  computeTiers,
  getPercentileRank,
  getPercentileCaption,
  TIER_IDS,
  TIER_META,
} from '../utils/matchTiers.js';

/**
 * Careers — the full ranked catalogue of the student's career matches, with a
 * client-side name search and a RIASEC-category filter. Each card shows the
 * Interest + Aptitude match and opens that career's roadmap.
 *
 * Field names verified against score_assessment.py:
 *   career_matches    [[name, score], …]  (the FULL ranked list, not just top-3)
 *   career_categories { career_name: primary_trait_letter }
 *   aptitude_scores   { numerical_reasoning, …: 0–100 }
 */

const INTEREST = [
  ['R', 'Realistic'],
  ['I', 'Investigative'],
  ['A', 'Artistic'],
  ['S', 'Social'],
  ['E', 'Enterprising'],
  ['C', 'Conventional'],
];
const LETTER_TO_NAME = Object.fromEntries(INTEREST.map(([l, n]) => [l, n]));
const RIASEC_ORDER = INTEREST.map(([l]) => l);

const APTITUDE_KEYS = [
  'numerical_reasoning',
  'logical_reasoning',
  'analytical_reasoning',
  'verbal_reasoning',
];

// The engine now returns a continuous 0–100 match percentage directly
// (score_assessment.py), so just round + clamp to a sane display band.
function scoreToPercent(score) {
  return Math.max(5, Math.min(99, Math.round(Number(score))));
}


export default function Careers() {
  const navigate = useNavigate();
  const { results: ctxResults, setResults } = useAuth();

  const [result, setResult] = useState(ctxResults || null);
  const [status, setStatus] = useState(ctxResults ? 'ready' : 'loading'); // loading|ready|empty|error

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
        if (data) setResults(data);
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

  const { career_matches = [], career_categories = {}, aptitude_scores = {} } = result || {};

  const hasAptitude = useMemo(
    () => APTITUDE_KEYS.some((k) => Number(aptitude_scores?.[k]) > 0),
    [aptitude_scores]
  );

  // distinct categories present among the careers, in fixed RIASEC order.
  const presentCats = useMemo(() => {
    const set = new Set();
    career_matches.forEach(([name]) => {
      const c = career_categories[name];
      if (c) set.add(c);
    });
    return RIASEC_ORDER.filter((l) => set.has(l));
  }, [career_matches, career_categories]);

  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState(null); // null = All
  const [activeTier, setActiveTier] = useState(null); // null = All

  // Every career's display percentage for THIS student — the full distribution that
  // both the tier classification and the percentile callouts are computed against
  // (not the search/category-filtered subset), so both stay stable while filtering.
  const allPercents = useMemo(
    () => career_matches.map(([, score]) => scoreToPercent(score)),
    [career_matches]
  );

  // Per-student match tiers, computed once from the FULL score distribution so the
  // labels stay stable as the user filters. Falls back to relative tiers when no
  // career clears the absolute 60% line. The same `tiers.tierOf` drives both the
  // filter pills and each card's percentage colour, so a green % == a "Good match".
  const tiers = useMemo(() => computeTiers(allPercents), [allPercents]);

  // How many careers fall in each tier (for the pill counts).
  const tierCounts = useMemo(() => {
    const counts = { good: 0, ok: 0, other: 0 };
    career_matches.forEach(([, score]) => {
      counts[tiers.tierOf(scoreToPercent(score))] += 1;
    });
    return counts;
  }, [career_matches, tiers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return career_matches.filter(([name, score]) => {
      if (q && !String(name).toLowerCase().includes(q)) return false;
      if (activeCat && career_categories[name] !== activeCat) return false;
      if (activeTier && tiers.tierOf(scoreToPercent(score)) !== activeTier) return false;
      return true;
    });
  }, [career_matches, career_categories, query, activeCat, activeTier, tiers]);

  const goRoadmap = (careerName) => navigate('/roadmap', { state: { career: careerName } });

  // ---- gates ----
  if (status === 'loading') {
    return <CenterMessage title="Loading careers…" subtitle="Gathering every match for you." />;
  }
  if (status === 'empty') return <Navigate to="/onboarding" replace />;
  if (status === 'error' || !result) {
    return (
      <ErrorState
        title="Couldn't load your careers"
        message="Something went wrong fetching your results. Please try again."
        onRetry={fetchResults}
      />
    );
  }

  return (
    <div className="page-serif" style={{ padding: 'clamp(32px, 6vw, 64px) 20px 120px' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <p className="starship-caption" style={{ color: 'var(--glow)', marginBottom: 12 }}>
            Explore careers
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
            Every career we matched for you
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '12px 0 0', maxWidth: 560, lineHeight: 'var(--lh-body)' }}>
            Ranked by fit. Search by name or filter by interest area, then open any one for its roadmap.
          </p>
        </motion.div>

        {/* ---- controls: search + category filter ---- */}
        <div style={{ marginTop: 'clamp(28px, 5vw, 40px)' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search careers…"
            aria-label="Search careers by name"
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--deep)',
              border: '1px solid rgba(200,184,255,0.16)',
              borderRadius: 'var(--radius-pill)',
              padding: '12px 18px',
              color: 'var(--text-primary)',
              fontSize: 'var(--fs-body-sm)',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          />

          {/* ---- match-quality tier filter ---- */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16, alignItems: 'center' }}>
            <TierPill
              label="All"
              count={career_matches.length}
              selected={activeTier === null}
              onClick={() => setActiveTier(null)}
            />
            {TIER_IDS.map((id) => (
              <TierPill
                key={id}
                label={TIER_META[id].label}
                count={tierCounts[id]}
                selected={activeTier === id}
                onClick={() => setActiveTier(activeTier === id ? null : id)}
              />
            ))}
          </div>
          {tiers.caption && (
            <p className="starship-caption" style={{ color: 'var(--text-tertiary)', marginTop: 10 }}>
              {tiers.caption}
            </p>
          )}

          {presentCats.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setActiveCat(null)}
                className="starship-caption"
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-pill)',
                  background: activeCat === null ? 'rgba(200,184,255,0.16)' : 'transparent',
                  border: '1px solid rgba(200,184,255,0.28)',
                  color: activeCat === null ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                All
              </button>
              {presentCats.map((letter) => {
                const selected = activeCat === letter;
                const dimmed = activeCat !== null && !selected;
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setActiveCat(selected ? null : letter)}
                    aria-pressed={selected}
                    aria-label={`Filter by ${LETTER_TO_NAME[letter]}`}
                    title={LETTER_TO_NAME[letter]}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-pill)',
                      opacity: dimmed ? 0.45 : 1,
                      boxShadow: selected ? `0 0 0 2px ${RIASEC_COLORS[LETTER_TO_NAME[letter].toLowerCase()].text}` : 'none',
                      transition: 'opacity 160ms var(--ease-emphasis)',
                    }}
                  >
                    <CategoryBadge category={letter} showLetter />
                  </button>
                );
              })}
            </div>
          )}

          <p className="starship-caption" style={{ color: 'var(--text-tertiary)', marginTop: 16 }}>
            {filtered.length} {filtered.length === 1 ? 'career' : 'careers'}
          </p>
        </div>

        {/* ---- results grid ---- */}
        {filtered.length ? (
          <div style={{ ...cardGrid, marginTop: 8 }}>
            {filtered.map(([name, score], i) => {
              const interest = scoreToPercent(score);
              const cat = career_categories[name];
              const aptMatch = getAptitudeMatch(name, career_categories, aptitude_scores);
              // Percentile is computed client-side against the full distribution, and
              // only surfaced as a caption when genuinely distinguishing (top ~30%).
              const percentileCaption = getPercentileCaption(
                getPercentileRank(interest, allPercents)
              );
              return (
                <CareerCard
                  key={`${name}-${i}`}
                  title={name}
                  field={cat ? LETTER_TO_NAME[cat] : undefined}
                  matchPercent={interest}
                  matchTier={tiers.tierOf(interest)}
                  percentileCaption={percentileCaption}
                  demand={`Interest ${interest}%`}
                  salaryRange={hasAptitude ? `Aptitude ${aptMatch}%` : undefined}
                  index={Math.min(i, 8)}
                  onClick={() => goRoadmap(name)}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon="compass"
            title="No careers match this filter"
            message={
              activeCat || activeTier
                ? 'No careers match this filter. Try a different category or clear the filters.'
                : 'No careers match your search. Try a different term.'
            }
          />
        )}
      </div>

      {/* floating AI counselor (unchanged across pages) */}
      <CounselorOrb />
    </div>
  );
}

/* ---------- building blocks ---------- */

function TierPill({ label, count, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="starship-caption"
      style={{
        padding: '7px 14px',
        borderRadius: 'var(--radius-pill)',
        background: selected ? 'rgba(200,184,255,0.16)' : 'transparent',
        border: '1px solid rgba(200,184,255,0.28)',
        color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'opacity 160ms var(--ease-emphasis)',
      }}
    >
      {label}
      <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>{count}</span>
    </button>
  );
}

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
        marginTop: 18,
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
