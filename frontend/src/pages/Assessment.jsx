import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import client from '../api/client.js';
import { BubbleScale, ProgressBar, ReactionToast, StarfieldCanvas, ErrorState } from '../components/index.js';
import { useNavGuard } from '../context/NavGuardContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSoundManager } from '../components/SoundManager.jsx';
import bundledQuestions from '../data/questions_v2.json';

/**
 * Assessment — 155 questions, one at a time.
 *
 * The bank is mixed (verified in questions_v2.json):
 *   • 105 LIKERT  questions  → 5 options valued 1–5  → BubbleScale mechanic
 *   • 50  MCQ     questions  → 4 options valued [0,0,0,1] (objective aptitude,
 *                              question_type === 'mcq') → a 4-choice picker
 *
 * Either way we submit the REAL option_id (api.py's /submit-answer expects
 * `selected_option_id`, not a 1–5 value). For likert we resolve the option whose
 * `value` matches the chosen bubble; for mcq we send the clicked option directly.
 * `question_id` is the question's `id` field (id === question_id per GET /questions).
 *
 * Bug fixes wired in here:
 *   BUG 1 — on mount, if the student already completed an assessment, redirect to
 *           /results (never silently re-enter and overwrite a finished result).
 *   BUG 2 — flag unsaved progress (NavGuard) after the first saved answer, and
 *           clear it once /submit-assessment succeeds, so leaving mid-way prompts.
 *   BUG 3 — after a LIKERT choice, hold the confirmed answer for 800ms and lock all
 *           inputs before auto-advancing, so a misclick can't skip a question.
 *
 * Back-nav guard (useBlocker):
 *   When the student has saved at least one answer and hasn't submitted yet
 *   (unsavedChanges === true), useBlocker intercepts the browser Back button (and
 *   any programmatic navigation away from /assessment) and shows an inline
 *   confirmation modal. "Stay" calls blocker.reset(); "Leave anyway" calls
 *   blocker.proceed(). This requires the data router (createBrowserRouter) — see
 *   App.jsx.
 *
 * Engagement layer (one-question-at-a-time immersion):
 *   • Question text is centre-aligned (likert + mcq).
 *   • Checkpoint overlays at q25/50/75/100/130 — a brief encouraging constellation
 *     card that auto-dismisses after 1.5s (no interaction).
 *   • Light-humour toasts on 15 hand-picked likert items when "That's me" (value 5)
 *     is chosen — a warm one-liner below the question for 1.5s.
 *   • MCQ (aptitude) questions get a 45s thin countdown bar; on expiry the question
 *     auto-advances with NO answer recorded (the "skip" path — /submit-answer is
 *     simply not called, leaving no response row for that question).
 *   • MCQ questions do NOT auto-advance on tap — a "Confirm →" button commits the
 *     answer (or the timer expires). Likert keeps the 800ms auto-advance.
 */

const TRANSITION_MESSAGES = [
  'Mapping your strengths…',
  'Calculating career compatibility…',
  'Exploring possible futures…',
  'Building your Starship…',
];

const SECTION_LABELS = {
  interest: 'Interests',
  behavioral: 'About you',
  constraints: 'Your situation',
  numerical: 'Numerical reasoning',
  logical: 'Logical reasoning',
  analytical: 'Analytical reasoning',
  verbal: 'Verbal reasoning',
};

const NEUTRAL_REACTIONS = ['Got it', 'Answer locked in', 'Noted', 'On to the next'];
const neutralReaction = () => NEUTRAL_REACTIONS[Math.floor(Math.random() * NEUTRAL_REACTIONS.length)];

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

// BUG 3 — confirm beat (ms) between selecting a LIKERT answer and auto-advancing.
const ADVANCE_DELAY_MS = 800;

// TASK 4 — per-question time budget for objective aptitude (mcq) questions.
const MCQ_TIME_SECONDS = 45;
const MCQ_TIME_MS = MCQ_TIME_SECONDS * 1000;

// TASK 2 — engagement checkpoints keyed by question NUMBER (index + 1). Each shows
// a brief encouraging overlay that auto-dismisses after 1.5s. Copy is verbatim.
const CHECKPOINTS = {
  25: "You're finding your rhythm. Keep going.",
  50: "Halfway there. You're doing great.",
  75: 'Almost there — the clearer picture is forming.',
  100: 'Just 55 more. Your results are taking shape.',
  130: 'Final stretch. This is where it all comes together.',
};
const CHECKPOINT_MS = 1500;

// TASK 3 — light-humour comments keyed by 0-based index within the LIKERT bank
// (the 105 likert questions in question_id order). Shown only when the student
// picks 5 ("That's me"). Warm, brief, age-appropriate — never sarcastic.
const HUMOUR_BY_LIKERT_INDEX = {
  0: 'A natural fixer — your future self will thank you.',
  4: "There's real joy in making things with your own hands.",
  8: 'You spot patterns everywhere — your brain loves a good puzzle.',
  14: 'A creative streak — keep that spark alive.',
  23: 'A born explainer — teachers everywhere salute you.',
  29: 'Spoken like a future captain of the ship.',
  32: 'You bring your A-game when it counts.',
  36: 'Somewhere a colour-coded planner is smiling.',
  44: 'Deadlines are just adrenaline in disguise, right?',
  58: 'The friend who gets the whole group moving.',
  73: 'Always up for a fresh approach — love that.',
  76: 'A lifelong learner in the making.',
  88: 'A little spontaneity keeps life interesting.',
  98: 'Big horizons ahead — pack light.',
  100: "Dream big — the world's a pretty big campus.",
};
const HUMOUR_MS = 1500;

export default function Assessment() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const { setUnsavedChanges, unsavedChanges } = useNavGuard();
  const { setResults } = useAuth(); // TASK 1 — persist the engine result into context
  const { playClick, playWhoosh } = useSoundManager();

  // useBlocker — intercepts the browser Back button (and any programmatic
  // navigation away) while the student has unsaved progress. Requires the data
  // router (createBrowserRouter) which App.jsx now uses.
  const blocker = useBlocker(unsavedChanges);

  // session_id from router state, falling back to sessionStorage (survives a refresh).
  const sessionId = useMemo(() => {
    const fromState = location.state?.session_id;
    if (fromState != null) return Number(fromState);
    const stored = sessionStorage.getItem('starship_session_id');
    return stored ? Number(stored) : null;
  }, [location.state]);

  const [gate, setGate] = useState('checking'); // 'checking' | 'ok'  (BUG 1)
  const [gateError, setGateError] = useState(''); // inline banner when profile check fails
  const [questions, setQuestions] = useState([]);
  const [loadingQ, setLoadingQ] = useState(true);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // question_id -> selected_option_id
  const [mcqChoice, setMcqChoice] = useState(null); // TASK 5 — tentative mcq pick (pre-confirm)
  const [direction, setDirection] = useState(1);
  const [toast, setToast] = useState('');
  const [humour, setHumour] = useState(''); // TASK 3 — inline humour toast
  const [checkpoint, setCheckpoint] = useState(''); // TASK 2 — overlay message
  const [locked, setLocked] = useState(false); // BUG 3 — inputs frozen during the confirm beat
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showTransition, setShowTransition] = useState(false);
  const advanceTimer = useRef(null);
  const humourTimer = useRef(null);
  const checkpointTimer = useRef(null);
  const mcqTimer = useRef(null);
  const shownCheckpoints = useRef(new Set());

  // BUG 1 — gate entry: a completed student must never re-enter the assessment.
  // Also preserves the original "no session → onboarding" guard. Runs once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await client.get('/profile');
        if (cancelled) return;
        if (data?.has_completed_assessment) {
          navigate('/dashboard', { replace: true }); // TASK 2 — completed → dashboard
          return;
        }
      } catch {
        // A transient profile-check failure shouldn't strand a student who has a
        // valid in-progress session — fall through to the session check, but show
        // an inline banner so the student knows what happened.
        if (!cancelled) {
          setGateError("Couldn't verify your session. Your progress is saved — you can continue.");
        }
      }
      if (cancelled) return;
      if (!sessionId) {
        navigate('/onboarding', { replace: true });
        return;
      }
      setGate('ok');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load questions (live), fall back to the bundled canonical export offline.
  const refetchQuestions = () => {
    setLoadingQ(true);
    client
      .get('/questions')
      .then((res) => {
        setQuestions(res.data?.questions?.length ? res.data.questions : bundledQuestions);
      })
      .catch(() => { setQuestions(bundledQuestions); })
      .finally(() => { setLoadingQ(false); });
  };

  useEffect(() => {
    let cancelled = false;
    client
      .get('/questions')
      .then((res) => {
        if (cancelled) return;
        setQuestions(res.data?.questions?.length ? res.data.questions : bundledQuestions);
      })
      .catch(() => {
        if (!cancelled) setQuestions(bundledQuestions);
      })
      .finally(() => {
        if (!cancelled) setLoadingQ(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Leaving the page (for any reason) clears every pending timer and the unsaved-
  // progress guard, so nothing lingers on a later page.
  useEffect(
    () => () => {
      clearTimeout(advanceTimer.current);
      clearTimeout(humourTimer.current);
      clearTimeout(checkpointTimer.current);
      clearTimeout(mcqTimer.current);
      setUnsavedChanges(false);
    },
    [setUnsavedChanges]
  );

  const total = questions.length;
  const q = questions[index];
  const isLast = index >= total - 1;
  const isLikert = q?.question_type === 'likert';

  // TASK 3 — map each question id to its position in the likert bank (0-based).
  const likertIndexById = useMemo(() => {
    const map = new Map();
    let li = 0;
    for (const item of questions) {
      if (item.question_type === 'likert') {
        map.set(item.id, li);
        li += 1;
      }
    }
    return map;
  }, [questions]);

  // On every question change: reset the tentative mcq pick (restoring a saved answer
  // when revisiting via Back). Humour/checkpoint run their own 1.5s timers and are
  // intentionally NOT reset here, so they outlive a fast auto-advance.
  useEffect(() => {
    if (!q) return;
    setMcqChoice(answers[q.id] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, q?.id]);

  // TASK 2 — fire a checkpoint overlay the first time we land on q25/50/75/100/130.
  useEffect(() => {
    if (gate !== 'ok' || loadingQ || !total) return;
    const num = index + 1;
    const msg = CHECKPOINTS[num];
    if (msg && !shownCheckpoints.current.has(num)) {
      shownCheckpoints.current.add(num);
      setCheckpoint(msg);
      playWhoosh();
      clearTimeout(checkpointTimer.current);
      checkpointTimer.current = setTimeout(() => setCheckpoint(''), CHECKPOINT_MS);
    }
  }, [index, gate, loadingQ, total]);

  // TASK 4 — per-question 45s timer for mcq (aptitude) questions only. Resets on
  // each new mcq question; paused (cleared) during the confirm beat / final submit.
  useEffect(() => {
    if (gate !== 'ok' || loadingQ || !q) return;
    if (q.question_type !== 'mcq') return;
    if (locked || submitting) return;
    mcqTimer.current = setTimeout(() => {
      handleTimeout();
    }, MCQ_TIME_MS);
    return () => clearTimeout(mcqTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, q?.id, locked, submitting, gate, loadingQ]);

  // ---- answer + advance ----------------------------------------------------
  const finish = async () => {
    setSubmitting(true);
    try {
      // session_id is a QUERY param on /submit-assessment (not a JSON body).
      const { data } = await client.post('/submit-assessment', null, {
        params: { session_id: sessionId },
      });
      // BUG 2 — results are persisted server-side; nothing left to warn about.
      setUnsavedChanges(false);
      sessionStorage.removeItem('starship_session_id');
      // TASK 1 — persist into AuthContext; the Dashboard reads it from there.
      setResults(data.results);
      // Show the cinematic transition sequence before navigating.
      setSubmitting(false);
      setShowTransition(true);
    } catch (err) {
      setError(err?.response?.data?.error || 'Submission failed. Your answers are saved — please try submitting again.');
      setSubmitting(false);
      setLocked(false); // allow a retry of the final submit
    }
  };

  // Advance forward to the next question (or finish), without persisting an answer.
  const advance = () => {
    if (isLast) {
      finish();
    } else {
      setDirection(1);
      setIndex((i) => i + 1);
      setLocked(false);
    }
  };

  const saveAnswer = async (question, optionId, message) => {
    if (locked || submitting) return; // ignore input during the confirm beat
    setLocked(true);
    setError('');
    clearTimeout(mcqTimer.current); // freeze the aptitude clock while we commit

    // Reflect the confirmed selection immediately; `locked` makes every option
    // non-interactive while we hold for the confirm beat.
    setAnswers((a) => ({ ...a, [question.id]: optionId }));
    setToast(message);

    // Persist and wait out the confirm beat in parallel, so the pause is never
    // shorter than the beat on a fast network, and never advances before the
    // answer has actually saved on a slow one.
    const pause = new Promise((resolve) => {
      advanceTimer.current = setTimeout(resolve, ADVANCE_DELAY_MS);
    });

    try {
      await client.post('/submit-answer', {
        session_id: sessionId,
        question_id: question.id, // id === question_id
        selected_option_id: optionId,
      });
      // BUG 2 — there is now saved progress worth protecting.
      setUnsavedChanges(true);
      await pause;
      advance();
    } catch (err) {
      clearTimeout(advanceTimer.current);
      setError(err?.response?.data?.error || 'Could not save that answer. Please try again.');
      setLocked(false);
    }
  };

  // TASK 4 — aptitude time ran out: advance with NO answer recorded (no submit).
  const handleTimeout = () => {
    if (locked || submitting) return;
    setLocked(true);
    setMcqChoice(null);
    advance();
  };

  // LIKERT — pick fires immediately (BUG 3's 800ms beat lives in saveAnswer).
  const onLikert = (value, message) => {
    if (locked || submitting) return;
    const opt = q.options.find((o) => o.value === value);
    if (!opt) return;
    playClick();
    // TASK 3 — warm one-liner when the student strongly relates ("That's me").
    if (value === 5) {
      const li = likertIndexById.get(q.id);
      const line = li != null ? HUMOUR_BY_LIKERT_INDEX[li] : null;
      if (line) showHumour(line);
    }
    saveAnswer(q, opt.option_id, message);
  };

  // MCQ — TASK 5: a tap only marks a tentative choice; it does NOT advance.
  const onMcqSelect = (opt) => {
    if (locked || submitting) return;
    playClick();
    setMcqChoice(opt.option_id);
  };

  // MCQ — TASK 5: commit the tentative choice (Confirm → button).
  const confirmMcq = () => {
    if (locked || submitting || mcqChoice == null) return;
    saveAnswer(q, mcqChoice, neutralReaction());
  };

  const showHumour = (line) => {
    setHumour(line);
    clearTimeout(humourTimer.current);
    humourTimer.current = setTimeout(() => setHumour(''), HUMOUR_MS);
  };

  const goBack = () => {
    if (index > 0 && !locked && !submitting) {
      setDirection(-1);
      setIndex((i) => i - 1);
      setToast('');
    }
  };

  // ---- render states -------------------------------------------------------
  if (gate === 'checking') {
    return <CenterState title="One moment…" subtitle="Getting your assessment ready." />;
  }
  if (loadingQ) {
    return <CenterState title="Loading your assessment…" subtitle="Fetching your 155 questions." />;
  }
  if (!total) {
    return (
      <ErrorState
        title="Questions unavailable"
        message={error || "We couldn't load the assessment questions. Please try again."}
        onRetry={refetchQuestions}
      />
    );
  }
  if (submitting) {
    return (
      <CenterState
        title="Charting your results…"
        subtitle="We're scoring your answers and matching careers, colleges and scholarships."
        pulse
      />
    );
  }

  if (showTransition) {
    return (
      <ResultsTransition onDone={() => navigate('/dashboard')} />
    );
  }

  // Back-nav guard — browser Back button (or any navigation away while progress
  // is unsaved). Normal-flow faux-viewport: no position:fixed; fills the content
  // area with a dark overlay and a centred violet-bordered card.
  if (blocker.state === 'blocked') {
    return (
      <BlockerModal
        onStay={() => blocker.reset()}
        onLeave={() => blocker.proceed()}
      />
    );
  }

  const storedOptionId = answers[q.id];
  const storedValue =
    storedOptionId != null ? q.options.find((o) => o.option_id === storedOptionId)?.value ?? null : null;

  const slideX = reduceMotion ? 0 : direction > 0 ? 50 : -50;

  return (
    <>
      {gateError && (
        <div
          role="alert"
          style={{
            background: 'rgba(93,82,184,0.12)',
            border: '1px solid rgba(93,82,184,0.30)',
            borderRadius: 0,
            padding: '10px 20px',
            textAlign: 'center',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--stardust)',
            lineHeight: 1.5,
          }}
        >
          {gateError}
        </div>
      )}
      <ProgressBar current={index + 1} total={total} />

      <div
        style={{
          minHeight: 'calc(100vh - 58px)',
          display: 'grid',
          placeItems: 'center',
          padding: 'clamp(40px, 7vw, 72px) 20px',
        }}
      >
        <div style={{ width: 'min(680px, 100%)' }}>
          {/* meta row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 18,
            }}
          >
            <span className="starship-caption" style={{ color: 'var(--glow)' }}>
              {SECTION_LABELS[q.section] || q.section}
            </span>
            <span className="starship-caption" style={{ color: 'var(--text-tertiary)' }}>
              {index + 1} / {total}
            </span>
          </div>

          <motion.div
            key={index}
            initial={{ opacity: 0, x: slideX }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* question text — serif for likert (interest/behavioral), sans for aptitude MCQ */}
            <h1
              style={{
                fontSize: 'var(--fs-question)',
                fontWeight: 'var(--fw-medium)',
                lineHeight: 1.35,
                color: 'var(--text-primary)',
                textAlign: 'center',
                margin: '0 0 clamp(28px, 5vw, 44px)',
                whiteSpace: 'pre-wrap',
                fontFamily: isLikert ? 'var(--font-serif)' : 'var(--font-sans)',
              }}
            >
              {q.question_text}
            </h1>

            {isLikert ? (
              <div style={{ display: 'grid', placeItems: 'center' }}>
                {/* BUG 3 — `disabled={locked}` freezes the scale during the confirm
                    beat; the chosen bubble stays filled (its built-in confirmed
                    state) while the others dim and become non-selectable. */}
                <BubbleScale value={storedValue} onSelect={onLikert} disabled={locked} />
              </div>
            ) : (
              <>
                {/* TASK 4 — thin 45s countdown bar below the question (no number). */}
                <TimerBar seconds={MCQ_TIME_SECONDS} runKey={index} />
                <McqChoices q={q} selectedId={mcqChoice} onPick={onMcqSelect} disabled={locked} />
                {/* TASK 5 — Confirm → commits the choice (no auto-advance on tap). */}
                <AnimatePresence>
                  {mcqChoice != null && (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: 'grid', placeItems: 'center', marginTop: 22 }}
                    >
                      <motion.button
                        type="button"
                        onClick={confirmMcq}
                        disabled={locked}
                        whileHover={locked ? undefined : { opacity: 0.88, boxShadow: 'var(--glow-violet)' }}
                        whileTap={locked ? undefined : { scale: 0.97 }}
                        style={{
                          padding: 'var(--btn-py) var(--btn-px)',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--violet)',
                          border: 'none',
                          color: 'var(--text-primary)',
                          fontSize: 'var(--fs-body)',
                          fontFamily: 'var(--font-sans)',
                          fontWeight: 'var(--fw-medium)',
                          cursor: locked ? 'default' : 'pointer',
                          transition: 'opacity 160ms var(--ease-emphasis), box-shadow 200ms var(--ease-emphasis)',
                        }}
                      >
                        Confirm →
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.div>

          {/* TASK 3 — humour toast lives OUTSIDE the keyed question block so it can
              persist its full 1.5s across a fast likert auto-advance. */}
          <AnimatePresence>
            {humour && (
              <motion.div
                key="humour"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.25 }}
                style={{ marginTop: 20, textAlign: 'center' }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    borderRadius: 999,
                    background: 'rgba(91,82,184,0.15)',
                    border: '1px solid rgba(91,82,184,0.35)',
                    color: 'var(--text-secondary)',
                    fontSize: 'var(--fs-body-sm)',
                    fontWeight: 'var(--fw-regular)',
                    lineHeight: 1.4,
                  }}
                >
                  {humour}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* footer: back + error */}
          <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 24 }}>
            <button
              onClick={goBack}
              disabled={index === 0 || locked}
              className="starship-caption"
              style={{
                background: 'transparent',
                border: 'none',
                color: index === 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                cursor: index === 0 || locked ? 'default' : 'pointer',
                padding: 0,
              }}
            >
              ← Back
            </button>
            {error && <span style={{ color: 'var(--coral)', fontSize: 'var(--fs-body-sm)', textAlign: 'right' }}>{error}</span>}
          </div>
        </div>
      </div>

      <ReactionToast message={toast} onDismiss={() => setToast('')} />

      {/* TASK 2 — checkpoint overlay (auto-dismisses; no interaction required). */}
      <AnimatePresence>
        {checkpoint && <CheckpointOverlay key="checkpoint" message={checkpoint} reduceMotion={reduceMotion} />}
      </AnimatePresence>
    </>
  );
}

// TASK 4 — thin per-question countdown. Depletes left→right over `seconds`. `runKey`
// (the question index) remounts it so the bar restarts on every new mcq question.
function TimerBar({ seconds, runKey }) {
  return (
    <div
      style={{
        width: 'min(540px, 100%)',
        height: 3,
        margin: '0 auto clamp(24px, 4vw, 32px)',
        borderRadius: 999,
        background: 'rgba(200,184,255,0.12)',
        overflow: 'hidden',
      }}
    >
      <motion.div
        key={runKey}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: seconds, ease: 'linear' }}
        style={{ height: '100%', background: 'var(--violet)', borderRadius: 999 }}
      />
    </div>
  );
}

// 4-choice picker for objective aptitude (mcq) questions. The selected option shows
// a violet highlight + checkmark; committing is a separate Confirm → step (TASK 5).
function McqChoices({ q, selectedId, onPick, disabled }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 540, margin: '0 auto' }}>
      {q.options.map((opt, i) => {
        const selected = opt.option_id === selectedId;
        return (
          <motion.button
            key={opt.option_id}
            type="button"
            onClick={() => onPick(opt)}
            disabled={disabled}
            whileHover={disabled ? undefined : { x: 3 }}
            whileTap={disabled ? undefined : { scale: 0.99 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              width: '100%',
              textAlign: 'left',
              padding: '15px 18px',
              borderRadius: 14,
              cursor: disabled ? 'default' : 'pointer',
              background: selected ? 'rgba(91,82,184,0.20)' : 'var(--deep)',
              border: `1px solid ${selected ? 'var(--violet)' : 'rgba(200,184,255,0.12)'}`,
              color: 'var(--text-primary)',
              fontSize: 'var(--fs-body)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 'var(--fw-regular)',
              lineHeight: 1.5,
              transition: 'border-color 160ms var(--ease-emphasis), background-color 160ms var(--ease-emphasis)',
            }}
          >
            <span
              aria-hidden
              style={{
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                width: 28,
                height: 28,
                borderRadius: 8,
                background: selected ? 'var(--violet)' : 'rgba(255,255,255,0.05)',
                color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 'var(--fw-medium)',
              }}
            >
              {selected ? '✓' : LETTERS[i] || i + 1}
            </span>
            <span>{opt.text}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// TASK 2 — brief encouraging overlay with a subtle drawing constellation. Dark card,
// violet border glow, font-weight ≤ 500, no gradient text. Auto-dismissed by parent.
function CheckpointOverlay({ message, reduceMotion }) {
  const stars = [
    { cx: 30, cy: 42, r: 2.6 },
    { cx: 72, cy: 22, r: 2 },
    { cx: 110, cy: 50, r: 3 },
    { cx: 150, cy: 28, r: 2 },
    { cx: 188, cy: 56, r: 2.6 },
  ];
  const path = 'M30,42 L72,22 L110,50 L150,28 L188,56';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(3,4,15,0.72)',
        backdropFilter: 'blur(2px)',
        padding: 20,
      }}
    >
      <motion.div
        initial={reduceMotion ? { opacity: 1 } : { y: 14, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        style={{
          textAlign: 'center',
          maxWidth: 340,
          width: '100%',
          padding: '30px 30px 34px',
          borderRadius: 20,
          background: 'var(--deep)',
          border: '1px solid var(--violet)',
          boxShadow: '0 0 44px rgba(91,82,184,0.45), inset 0 0 0 1px rgba(91,82,184,0.2)',
        }}
      >
        <svg viewBox="0 0 216 78" width="184" height="66" style={{ display: 'block', margin: '0 auto 18px' }} aria-hidden>
          <motion.path
            d={path}
            fill="none"
            stroke="var(--violet)"
            strokeWidth="1"
            strokeOpacity="0.5"
            initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
          />
          {stars.map((s, i) => (
            <motion.circle
              key={i}
              cx={s.cx}
              cy={s.cy}
              r={s.r}
              fill="var(--stardust)"
              style={{ filter: 'drop-shadow(0 0 4px var(--glow))' }}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: [0, 1, 0.7, 1] }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 1.4, delay: 0.12 * i, repeat: Infinity, repeatType: 'reverse' }
              }
            />
          ))}
        </svg>
        <p
          style={{
            margin: 0,
            color: 'var(--text-primary)',
            fontSize: 'var(--fs-body)',
            fontWeight: 'var(--fw-medium)',
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
      </motion.div>
    </motion.div>
  );
}

// Back-nav guard modal — shown when useBlocker fires (browser Back or programmatic
// navigation away from an in-progress assessment). Normal-flow faux-viewport: the
// outer div fills the content area below the nav without position:fixed, giving a
// dark-overlay feel while remaining in the document flow.
function BlockerModal({ onStay, onLeave }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onStay?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStay]);

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 58px)',
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(4,6,26,0.88)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="blocker-title"
        aria-describedby="blocker-desc"
        style={{
          width: 'min(420px, 100%)',
          background: 'var(--deep)',
          border: '1px solid var(--violet)',
          borderRadius: 'var(--radius-card)',
          padding: 'clamp(24px, 4vw, 32px)',
          boxShadow: '0 0 40px rgba(91,82,184,0.30)',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(91,82,184,0.22)',
            color: 'var(--stardust)',
            marginBottom: 18,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 8v5" />
            <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
          </svg>
        </div>

        <h2
          id="blocker-title"
          style={{
            fontSize: 'var(--fs-section)',
            fontWeight: 'var(--fw-medium)',
            lineHeight: 1.3,
            margin: '0 0 10px',
            color: 'var(--text-primary)',
          }}
        >
          Leave the assessment?
        </h2>
        <p
          id="blocker-desc"
          style={{ color: 'var(--text-secondary)', margin: '0 0 26px', lineHeight: 'var(--lh-body)' }}
        >
          If you go back now, your progress will be lost.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onLeave}
            className="starship-caption"
            style={{
              padding: 'var(--btn-py-sm) var(--btn-px-sm)',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              border: '1px solid rgba(200,184,255,0.28)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Leave anyway
          </button>
          <button
            type="button"
            onClick={onStay}
            autoFocus
            style={{
              padding: 'var(--btn-py) var(--btn-px)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--violet)',
              border: '1px solid var(--violet)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontWeight: 'var(--fw-medium)',
              fontSize: 'var(--fs-body-sm)',
            }}
          >
            Stay
          </button>
        </div>
      </div>
    </div>
  );
}

function CenterState({ title, subtitle, pulse = false }) {
  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', display: 'grid', placeItems: 'center', padding: '40px 20px' }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
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
        <h1 style={{ fontSize: 'var(--fs-section)', fontWeight: 'var(--fw-medium)', margin: '0 0 10px', color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {subtitle && <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 'var(--lh-body)' }}>{subtitle}</p>}
      </div>
    </div>
  );
}

/*
 * ResultsTransition — cinematic bridge between the last answer and /results.
 *
 * Four lines fade in and out sequentially (1.2 s each, crossfade), with a
 * star-field backdrop. After the final line the overlay fades to transparent
 * and `onDone` fires, triggering navigate('/results').
 *
 * Under reduced-motion the overlay is skipped: onDone fires after 400 ms.
 */
function ResultsTransition({ onDone }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      const t = setTimeout(onDone, 400);
      return () => clearTimeout(t);
    }

    const EACH = 1200; // ms per message
    const timers = [];
    // Schedule each subsequent message
    for (let i = 1; i < TRANSITION_MESSAGES.length; i++) {
      timers.push(setTimeout(() => setMsgIdx(i), EACH * i));
    }
    // Fade out after all messages
    timers.push(setTimeout(() => setFading(true), EACH * TRANSITION_MESSAGES.length));
    // Navigate after fade
    timers.push(setTimeout(onDone, EACH * TRANSITION_MESSAGES.length + 400));

    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'var(--void)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fading ? 0 : 1,
        transition: fading ? 'opacity 400ms ease' : 'none',
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        <StarfieldCanvas glowColor="rgba(83,74,183,0.12)" />
      </div>
      <AnimatePresence>
        <motion.p
          key={msgIdx}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: 'relative',
            zIndex: 1,
            fontSize: 'var(--fs-section)',
            fontWeight: 'var(--fw-regular)',
            color: 'var(--stardust)',
            textAlign: 'center',
            maxWidth: 560,
            padding: '0 24px',
            lineHeight: 1.4,
            fontFamily: 'var(--font-serif)',
            margin: 0,
          }}
        >
          {TRANSITION_MESSAGES[msgIdx]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
