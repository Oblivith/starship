import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Field, FormError, SubmitButton, Select } from './auth/AuthShell.jsx';
import { CLASS_OPTIONS, INDIAN_STATES } from '../data/constants.js';

/**
 * Onboarding — collect the profile the scoring engine reads, then open an
 * assessment session.
 *
 * Field mapping (verified against api.py — do not rename):
 *   name                 → students.name
 *   current_class        → students.current_class   ('9'|'10'|'11'|'12'|'Dropper')
 *   state                → students.preferred_state  (PATCH key: preferred_state)
 *   annual budget (INR)  → students.annual_family_income_inr + students.budget_max_inr
 *
 * Flow: PATCH /profile → POST /start-assessment → /assessment.
 *
 * POST /start-assessment accepts current_class ∈ {9,10,11,12,Dropper}, so we send
 * the real value as-is.
 */

export default function Onboarding() {
  const navigate = useNavigate();
  const { student, refreshProfile } = useAuth();

  const [name, setName] = useState('');
  const [currentClass, setCurrentClass] = useState('');
  const [state, setState] = useState('');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true); // BUG 1 — gate until we confirm no completed assessment

  // Prefill from an existing profile (returning student editing their details).
  useEffect(() => {
    if (!student) return;
    if (student.name) setName(student.name);
    if (student.current_class) setCurrentClass(student.current_class);
    if (student.preferred_state) setState(student.preferred_state);
    if (student.annual_family_income_inr != null) setBudget(String(student.annual_family_income_inr));
  }, [student]);

  // BUG 1 — a student who already completed an assessment must not be dropped
  // back into onboarding (which would start a new session and overwrite their
  // result). Re-check the profile on mount and bounce them to their results.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await refreshProfile();
      if (cancelled) return;
      if (profile?.has_completed_assessment) {
        navigate('/dashboard', { replace: true }); // TASK 2 — completed → dashboard
        return;
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) return setError('Please tell us your name.');
    if (!currentClass) return setError('Select your current class.');
    if (!state) return setError('Select your state.');
    const budgetNum = Number(budget);
    if (budget === '' || Number.isNaN(budgetNum) || budgetNum < 0)
      return setError('Enter your annual education budget (₹0 or more).');

    setLoading(true);
    try {
      // 1) Persist the profile the engine reads.
      await client.patch('/profile', {
        name: name.trim(),
        current_class: currentClass,
        preferred_state: state,
        annual_family_income_inr: budgetNum,
        budget_max_inr: budgetNum,
      });
      await refreshProfile();

      // 2) Open the assessment session.
      const { data } = await client.post('/start-assessment', {
        current_class: currentClass,
        budget_max: budgetNum,
      });

      const sessionId = data.session_id;
      // Stash for resilience: a refresh on /assessment loses router state.
      sessionStorage.setItem('starship_session_id', String(sessionId));
      navigate('/assessment', { state: { session_id: sessionId } });
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not start your assessment. Please try again.');
      setLoading(false);
    }
  };

  // BUG 1 — hold a minimal loader until the completed-assessment check resolves,
  // so the form never flashes before a completed student is redirected away.
  if (checking) {
    return (
      <div style={{ minHeight: 'calc(100vh - 58px)', display: 'grid', placeItems: 'center', padding: '40px 20px' }}>
        <div
          aria-hidden
          style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--glow)', boxShadow: '0 0 18px var(--glow)' }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 58px)',
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(28px, 6vw, 64px) 20px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        style={{ width: 'min(480px, 100%)' }}
      >
        <p className="starship-caption" style={{ color: 'var(--glow)', marginBottom: 12 }}>
          Step 1 of 2 · Your profile
        </p>
        <h1
          style={{
            fontSize: 'var(--fs-section)',
            fontWeight: 'var(--fw-medium)',
            lineHeight: 'var(--lh-tight)',
            margin: '0 0 10px',
            color: 'var(--text-primary)',
          }}
        >
          Let’s tailor your guidance
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 26px', lineHeight: 'var(--lh-body)' }}>
          A few details help us match you to the right careers, colleges and scholarships.
        </p>

        <div
          style={{
            background: 'var(--deep)',
            border: '1px solid rgba(200,184,255,0.12)',
            borderRadius: 'var(--radius-card)',
            padding: 'clamp(22px, 4vw, 30px)',
          }}
        >
          <form onSubmit={submit} noValidate>
            <FormError message={error} />
            <Field
              label="Your name"
              name="name"
              value={name}
              onChange={setName}
              placeholder="e.g. Aarav Sharma"
              autoComplete="name"
            />
            <Select
              label="Current class"
              name="current_class"
              value={currentClass}
              onChange={setCurrentClass}
              options={CLASS_OPTIONS}
              placeholder="Select your class"
            />
            <Select
              label="State"
              name="state"
              value={state}
              onChange={setState}
              options={INDIAN_STATES}
              placeholder="Select your state"
            />
            <Field
              label="Annual education budget (₹)"
              name="budget"
              type="number"
              value={budget}
              onChange={setBudget}
              placeholder="e.g. 200000"
              inputMode="numeric"
              hint="Used to match affordable colleges and scholarships. An estimate is fine."
            />
            <SubmitButton loading={loading}>Start my assessment →</SubmitButton>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
