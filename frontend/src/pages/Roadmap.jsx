import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import client from '../api/client.js';
import CounselorOrb from '../components/CounselorOrb.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { COUNTRIES, getSalaryForCountry } from '../utils/salaryData.js';

// Maps an exam keyword to the alternative routes a student can use instead.
// Keys are matched case-insensitively against each education_path step text.
const PATHWAY_ALTERNATIVES = {
  JEE: ['JEE Main', 'JEE Advanced', 'State CET', 'CUET', 'Private University Entrance', 'DASA (for NRIs)'],
  NEET: ['NEET UG', 'State Medical CET', 'AIIMS entrance (now merged with NEET)', 'Armed Forces Medical College entrance'],
  CLAT: ['CLAT', 'AILET', 'LSAT India', 'University-specific law entrance'],
  CAT: ['CAT', 'XAT', 'GMAT', 'MAT', 'CMAT', 'University-specific MBA entrance'],
  GATE: ['GATE', 'University-specific M.Tech entrance', 'Direct admission (some universities)'],
  UPSC: ['UPSC CSE', 'State PSC', 'SSC CGL (for central govt roles)'],
};

function getAlternatives(stepText) {
  const text = stepText.toLowerCase();
  for (const [keyword, alts] of Object.entries(PATHWAY_ALTERNATIVES)) {
    if (text.includes(keyword.toLowerCase())) return { keyword, alts };
  }
  return null;
}

/**
 * Roadmap — POST /career-roadmap (JWT-only; student-scoped via token).
 *
 * Response shape (api.py):
 *   { status, student_id,
 *     top_careers:     [[name, score], …],
 *     recommendations: [[name, score], …],
 *     career_details:  { [career_name]: { salary_min_inr, salary_max_inr,
 *                          education_path:{steps:[…]}, top_recruiters:[…],
 *                          growth_outlook, country_salary:{[code]:{…}} } } }
 *
 * country_salary keys: IN US GB CA AU SG HK AE EU
 * Each entry: { min_inr, max_inr, min_local, max_local,
 *               currency_symbol, currency_code, growth_outlook }
 */
export default function Roadmap() {
  const location = useLocation();
  const navigate = useNavigate();
  const focusCareer = location.state?.career || null;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('IN');
  const [openPathwayStep, setOpenPathwayStep] = useState(null);

  const fetchRoadmap = () => {
    setLoading(true);
    setError('');
    setData(null);
    client
      .post('/career-roadmap', focusCareer ? { career: focusCareer } : {})
      .then((res) => { setData(res.data); })
      .catch((err) => { setError(err?.response?.data?.error || 'Could not load your roadmap.'); })
      .finally(() => { setLoading(false); });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    client
      .post('/career-roadmap', focusCareer ? { career: focusCareer } : {})
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || 'Could not load your roadmap.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const topCareers = data?.top_careers || [];
  const recommendations = data?.recommendations || [];
  const headline = focusCareer || topCareers[0]?.[0] || 'Your roadmap';
  const details = data?.career_details?.[headline] || null;

  // Country-specific salary; falls back to India top-level columns when absent.
  const countrySalary = getSalaryForCountry(headline, selectedCountry, data?.career_details);
  const salaryMinINR = countrySalary?.min_inr ?? details?.salary_min_inr ?? null;
  const salaryMaxINR = countrySalary?.max_inr ?? details?.salary_max_inr ?? null;
  const salaryMinLocal = countrySalary?.min_local ?? null;
  const salaryMaxLocal = countrySalary?.max_local ?? null;
  const currencySymbol = countrySalary?.currency_symbol ?? '₹';
  const hasSalary = salaryMinINR != null || salaryMaxINR != null;

  // Growth outlook is country-specific (e.g. "Very High" in US vs "High" in India).
  const outlook = countrySalary?.growth_outlook ?? details?.growth_outlook ?? null;

  const eduSteps = details?.education_path?.steps || [];
  const recruiters = details?.top_recruiters || [];

  const openCareer = (name) => navigate('/roadmap', { state: { career: name } });

  // Context for the counselor: the career THIS page is showing, so "this career"
  // resolves to it (e.g. Mechanical Engineer) rather than the student's #1 match.
  const careerContext =
    headline && headline !== 'Your roadmap'
      ? {
          name: headline,
          salary_min_inr: salaryMinINR,
          salary_max_inr: salaryMaxINR,
          growth_outlook: outlook,
          top_recruiters: recruiters,
          education_steps: eduSteps,
        }
      : null;

  if (loading) {
    return (
      <Center>
        <Dot pulse />
        <h1 style={titleStyle}>Building your roadmap…</h1>
        <p style={subStyle}>Pulling together your strongest paths and next steps.</p>
      </Center>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="We hit a snag"
        message={error}
        onRetry={fetchRoadmap}
      />
    );
  }

  if (!details) {
    return (
      <ErrorState
        title="Career details unavailable"
        message={`We couldn't load the details for ${headline === 'Your roadmap' ? 'this career' : headline}. Try again or go back to results.`}
        onRetry={fetchRoadmap}
      />
    );
  }

  return (
    <div className="page-serif" style={{ padding: 'clamp(36px, 6vw, 72px) 20px 120px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <button onClick={() => navigate('/results')} style={backLinkStyle}>
          ← Back to results
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          style={{ marginTop: 18 }}
        >
          <p className="starship-caption" style={{ color: 'var(--glow)', marginBottom: 12 }}>
            Career roadmap
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
            {headline}
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '14px 0 0', maxWidth: 560, lineHeight: 'var(--lh-body)' }}>
            Here's how to move toward this path — and the other strong options the assessment found
            for you.
          </p>
        </motion.div>

        {/* Country selector — horizontal scroll on mobile, no wrap */}
        <div style={{ marginTop: 'clamp(28px, 5vw, 44px)' }}>
          <p className="starship-caption" style={{ color: 'var(--text-tertiary)', marginBottom: 12 }}>
            Salary by country
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              gap: 8,
              paddingBottom: 4,
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            }}
          >
            {COUNTRIES.map((c) => {
              const active = selectedCountry === c.code;
              return (
                <motion.button
                  key={c.code}
                  onClick={() => setSelectedCountry(c.code)}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '7px 15px',
                    borderRadius: 'var(--radius-pill)',
                    background: active ? 'rgba(93,82,184,0.22)' : 'var(--deep)',
                    border: active
                      ? '1px solid var(--violet)'
                      : '1px solid rgba(200,184,255,0.12)',
                    color: active ? 'var(--stardust)' : 'var(--text-secondary)',
                    fontSize: 'var(--fs-body-sm)',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: active ? 'var(--fw-medium)' : 'var(--fw-regular)',
                    cursor: 'pointer',
                    boxShadow: active ? '0 0 10px rgba(93,82,184,0.35)' : 'none',
                    transition: 'border-color 0.15s, background 0.15s, color 0.15s, box-shadow 0.15s',
                  }}
                >
                  <span aria-hidden>{c.flag}</span>
                  {c.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* career detail — salary + outlook, recruiters, education path */}
        <div
          style={{
            marginTop: 'clamp(20px, 4vw, 32px)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 18,
          }}
        >
          <DetailCard title="Expected salary">
            {hasSalary ? (
              <>
                {selectedCountry === 'IN' ? (
                  /* India — show INR in full Indian format, no duplication */
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 'var(--fw-medium)',
                      color: 'var(--text-primary)',
                      lineHeight: 1.35,
                    }}
                  >
                    {formatSalaryRangeINR(salaryMinINR, salaryMaxINR)}
                  </div>
                ) : (
                  /* Other countries — local currency + INR equivalent */
                  <div style={{ lineHeight: 1.45 }}>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 'var(--fw-medium)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {fmtLocalRange(salaryMinLocal, salaryMaxLocal, currencySymbol)}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--fs-body-sm)',
                        color: 'var(--text-tertiary)',
                        marginTop: 4,
                      }}
                    >
                      or&nbsp;&nbsp;{fmtINRCompact(salaryMinINR)}–{fmtINRCompact(salaryMaxINR)}/yr
                    </div>
                  </div>
                )}
                <div className="starship-caption" style={{ marginTop: 8, color: 'var(--text-tertiary)' }}>
                  Typical mid-career range
                </div>
                {outlook && (
                  <div style={{ marginTop: 14 }}>
                    <OutlookBadge outlook={outlook} />
                  </div>
                )}
                <p
                  style={{
                    margin: '14px 0 0',
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    lineHeight: 1.55,
                    fontStyle: 'italic',
                  }}
                >
                  Figures are approximate mid-career estimates and vary by employer, city, and
                  experience.
                </p>
              </>
            ) : (
              <p style={emptyTextStyle}>
                Salary figures for this path aren't in our data yet. The counselor can share current
                estimates and growth outlook.
              </p>
            )}
          </DetailCard>

          <DetailCard title="Top recruiters">
            {recruiters.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {recruiters.map((name, i) => (
                  <span key={`${name}-${i}`} style={recruiterPillStyle}>
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <p style={emptyTextStyle}>
                We're still compiling who hires for {headline}. Ask the counselor about employers in
                this field.
              </p>
            )}
          </DetailCard>
        </div>

        {/* education pathway — full-width numbered steps */}
        <div style={{ marginTop: 18 }}>
          <DetailCard title="Education pathway">
            {eduSteps.length > 0 ? (
              <ol
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                {eduSteps.map((step, i) => {
                  const match = getAlternatives(step);
                  const stepKey = `step-${i}`;
                  const altOpen = openPathwayStep === stepKey;
                  return (
                    <li key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <span style={stepNumStyle}>{i + 1}</span>
                        <span
                          style={{
                            color: 'var(--text-secondary)',
                            fontSize: 'var(--fs-body-sm)',
                            lineHeight: 1.6,
                            paddingTop: 3,
                          }}
                        >
                          {step}
                        </span>
                      </div>
                      {match && (
                        <div style={{ paddingLeft: 40 }}>
                          <button
                            onClick={() => setOpenPathwayStep(altOpen ? null : stepKey)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              color: 'var(--text-tertiary)',
                              fontSize: 12,
                              fontFamily: 'var(--font-sans)',
                              fontWeight: 'var(--fw-regular)',
                            }}
                          >
                            <span
                              aria-hidden
                              style={{
                                display: 'inline-block',
                                transition: 'transform 0.2s',
                                transform: altOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              }}
                            >
                              ▾
                            </span>
                            Other routes
                          </button>
                          <AnimatePresence initial={false}>
                            {altOpen && (
                              <motion.div
                                key="alts"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 10 }}>
                                  {match.alts.map((alt, j) => (
                                    <span
                                      key={j}
                                      style={{
                                        padding: '4px 11px',
                                        borderRadius: 'var(--radius-pill)',
                                        background: 'rgba(93,82,184,0.12)',
                                        border: '1px solid rgba(200,184,255,0.15)',
                                        color: 'var(--stardust)',
                                        fontSize: 12,
                                        fontWeight: 'var(--fw-regular)',
                                      }}
                                    >
                                      {alt}
                                    </span>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState
                icon="map"
                title="Education pathway coming soon"
                message={`We're mapping the step-by-step degrees and milestones for ${headline}. Ask the counselor what to study and which exams to target.`}
              />
            )}
          </DetailCard>
        </div>

        {/* recommended next paths */}
        {recommendations.length > 0 && (
          <Block eyebrow="Recommended next" title="Paths we suggest focusing on">
            <ChipRow careers={recommendations} onPick={openCareer} accent="var(--glow)" />
          </Block>
        )}

        {/* other strong matches */}
        {topCareers.length > 0 && (
          <Block eyebrow="Your matches" title="Other strong-fit careers">
            <ChipRow careers={topCareers} onPick={openCareer} accent="var(--stardust)" />
          </Block>
        )}
      </div>

      <CounselorOrb careerContext={careerContext} />
    </div>
  );
}

/* ---------- building blocks ---------- */

function Block({ eyebrow, title, children }) {
  return (
    <section style={{ marginTop: 'clamp(40px, 7vw, 68px)' }}>
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

function DetailCard({ title, children }) {
  return (
    <div
      style={{
        background: 'var(--deep)',
        border: '1px solid rgba(200,184,255,0.12)',
        borderRadius: 'var(--radius-card)',
        padding: 22,
      }}
    >
      <div
        style={{
          fontSize: 17,
          fontWeight: 'var(--fw-medium)',
          color: 'var(--text-primary)',
          marginBottom: 14,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/* Growth outlook badge — Very High / High / Moderate / Low */
const OUTLOOK_COLORS = {
  'Very High': 'var(--glow)',
  High: 'var(--aurora)',
  Moderate: 'var(--gold)',
  Low: 'var(--coral)',
};

function OutlookBadge({ outlook }) {
  const color = OUTLOOK_COLORS[outlook] || 'var(--text-tertiary)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        borderRadius: 'var(--radius-pill)',
        border: `1px solid ${color}`,
        color,
        fontSize: 'var(--fs-caption)',
        fontWeight: 'var(--fw-medium)',
        letterSpacing: 'var(--ls-caption)',
        textTransform: 'uppercase',
      }}
    >
      <span
        aria-hidden
        style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }}
      />
      {outlook} growth
    </span>
  );
}

/* ---------- salary formatting helpers ---------- */

/** India: "₹3,50,000 – ₹15,00,000 / year" using Indian digit grouping. */
function formatINR(n) {
  return `₹${Number(n).toLocaleString('en-IN')}`;
}
function formatSalaryRangeINR(min, max) {
  if (min != null && max != null) return `${formatINR(min)} – ${formatINR(max)} / year`;
  return `${formatINR(min != null ? min : max)} / year`;
}

/**
 * Non-India local currency: "$120k–$200k/yr", "HK$600k–HK$1M/yr", etc.
 * Values under 1 000 are shown as-is (rare edge case).
 */
function fmtLocalAmt(val, symbol) {
  if (val >= 1_000_000) {
    const m = val / 1_000_000;
    return `${symbol}${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (val >= 1_000) return `${symbol}${Math.round(val / 1_000)}k`;
  return `${symbol}${val}`;
}
function fmtLocalRange(min, max, symbol) {
  if (min != null && max != null) return `${fmtLocalAmt(min, symbol)}–${fmtLocalAmt(max, symbol)}/yr`;
  return `${fmtLocalAmt(min != null ? min : max, symbol)}/yr`;
}

/**
 * INR equivalent shown compact for non-India rows: "₹1.68Cr", "₹58.8L".
 * ≥ 1 Cr → Cr notation; ≥ 1 L → L notation; else Indian grouping.
 */
function fmtINRCompact(val) {
  if (val == null) return '';
  if (val >= 10_000_000) {
    const cr = val / 10_000_000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : parseFloat(cr.toFixed(2)).toString()}Cr`;
  }
  if (val >= 100_000) {
    const l = val / 100_000;
    return `₹${l % 1 === 0 ? l.toFixed(0) : parseFloat(l.toFixed(1)).toString()}L`;
  }
  return `₹${Number(val).toLocaleString('en-IN')}`;
}

/* ---------- other style objects ---------- */

const recruiterPillStyle = {
  padding: '7px 14px',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--nebula)',
  border: '1px solid rgba(200,184,255,0.14)',
  color: 'var(--text-secondary)',
  fontSize: 'var(--fs-body-sm)',
};

const stepNumStyle = {
  flexShrink: 0,
  width: 26,
  height: 26,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(200,184,255,0.10)',
  border: '1px solid rgba(200,184,255,0.22)',
  color: 'var(--stardust)',
  fontSize: 13,
  fontWeight: 'var(--fw-medium)',
  lineHeight: 1,
};

const emptyTextStyle = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 'var(--fs-body-sm)',
  lineHeight: 1.7,
};

function ChipRow({ careers, onPick, accent }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {careers.map(([name], i) => (
        <motion.button
          key={`${name}-${i}`}
          onClick={() => onPick(name)}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--deep)',
            border: '1px solid rgba(200,184,255,0.14)',
            color: 'var(--text-primary)',
            fontSize: 'var(--fs-body-sm)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 'var(--fw-regular)',
            cursor: 'pointer',
          }}
        >
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />
          {name}
          <span style={{ color: 'var(--text-tertiary)' }}>→</span>
        </motion.button>
      ))}
    </div>
  );
}

/* ---------- loading / error states ---------- */

const titleStyle = {
  fontSize: 'var(--fs-section)',
  fontWeight: 'var(--fw-medium)',
  margin: '0 0 10px',
  color: 'var(--text-primary)',
};
const subStyle = { color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 };
const backBtnStyle = {
  marginTop: 22,
  padding: '10px 20px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--gradient-brand)',
  color: 'var(--text-primary)',
  border: 'none',
  fontSize: 'var(--fs-body-sm)',
  fontWeight: 'var(--fw-medium)',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
};
const backLinkStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: 'var(--fs-body-sm)',
  fontFamily: 'var(--font-sans)',
  padding: 0,
};

function Center({ children }) {
  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', display: 'grid', placeItems: 'center', padding: '40px 20px' }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>{children}</div>
    </div>
  );
}

function Dot({ pulse = false }) {
  return (
    <motion.div
      aria-hidden
      animate={pulse ? { scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] } : { opacity: 1 }}
      transition={pulse ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
      style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: 'var(--glow)',
        boxShadow: '0 0 18px var(--glow)',
        margin: '0 auto 22px',
      }}
    />
  );
}
