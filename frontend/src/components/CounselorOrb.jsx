import { useState } from 'react';
import client from '../api/client.js';
import AIOrb from './AIOrb.jsx';

/**
 * CounselorOrb — stateful wrapper that wires the presentational <AIOrb> to
 * POST /chat.
 *
 * The backend owns the conversation context: on the first message it injects
 * the student's cached engine results (LATEST_RESULTS, populated by
 * /submit-assessment) and remembers the last 10 exchanges per session — so the
 * client only needs to send { message }.
 *
 * The trial Cohere key is rate-limited (≈20 calls/trial-endpoint), surfaced by
 * the backend as a 500 { error }. We detect that and reply in-panel rather than
 * letting the orb look broken.
 */
function friendlyError(err) {
  const raw = (err?.response?.data?.error || err?.message || '').toLowerCase();
  if (/rate|limit|429|quota|trial|too many/.test(raw)) {
    return 'I’m getting a lot of questions right now and need a short breather. Please try again in a minute.';
  }
  return 'I couldn’t reach the counselor just now. Please check your connection and try again.';
}

/**
 * CounselorOrb props:
 *   careerContext  {{ name, salary_min_inr, salary_max_inr, growth_outlook,
 *                     top_recruiters, education_steps }} | null
 *     The career detail page the orb is opened from. When provided it is sent
 *     to /chat so the backend anchors "this career" to it (instead of defaulting
 *     to the student's #1 match), and the suggested prompts are templated against
 *     this career's name. Omit on general pages — the backend fallback is fine.
 */
export default function CounselorOrb({ careerContext = null }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const onSend = async (text) => {
    if (loading) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const payload = { message: text };
      if (careerContext?.name) payload.career_context = careerContext;
      const { data } = await client.post('/chat', payload);
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: friendlyError(err) }]);
    } finally {
      setLoading(false);
    }
  };

  // When opened from a specific career page, the example questions name THAT
  // career so "this career" is never ambiguous. Otherwise AIOrb's generic
  // defaults are used.
  const suggestedPrompts = careerContext?.name
    ? [
        `Why is ${careerContext.name} a good fit for me?`,
        `What exams do I need for ${careerContext.name}?`,
        `Which universities offer ${careerContext.name}?`,
        `What scholarships fit ${careerContext.name}?`,
      ]
    : undefined;

  return (
    <AIOrb
      messages={messages}
      onSend={onSend}
      isLoading={loading}
      {...(suggestedPrompts ? { suggestedPrompts } : {})}
    />
  );
}
