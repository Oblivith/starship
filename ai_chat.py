import os
from dotenv import load_dotenv
import cohere
from score_assessment import run_career_engine

load_dotenv()

_client = cohere.ClientV2(api_key=os.getenv("COHERE_API_KEY"))

# Per-session conversation history: maps student_id -> list of message dicts
# Format: [{"role": "user"|"assistant", "content": "..."}]
_conversation_history: dict[int, list[dict]] = {}

SYSTEM_PROMPT = """You are a career counselor for PROJECT STARSHIP, a platform helping underprivileged students in India figure out their future.

You already know this student's assessment results — their top careers, matched universities, financial situation, and confidence scores. That data is your background knowledge. Don't recite it back; use it to give sharp, personalised answers.

HOW TO RESPOND:
- Default to 2–4 sentences. Go longer ONLY if the student explicitly asks for more detail ("tell me more", "explain", "go deeper", etc.).
- Lead with the single most useful insight for what they asked. Cut everything else.
- End almost every response with ONE natural, curious follow-up question — not a checklist, just one.
- Never give a career roadmap or step-by-step plan unless they specifically ask for one.
- Never list more than 3 items unless they ask for a list.
- If they ask "what careers suit me", name ONE career, say in one line why it fits them, then ask a follow-up. Don't list five options.

TONE:
- Warm and direct — like a knowledgeable older friend who actually cares, not a formal advisor reading from a report.
- No motivational filler ("Great question!", "You've got what it takes!"). Just honest, practical insight.
- If they write in Hindi, reply in Hindi.

DATA RULES:
- Use only the provided assessment data — never invent careers, colleges, or costs.
- Affordability ratio = cost relative to the student's budget, not a population percentage.
- Don't mix unrelated career clusters (e.g. medical vs. engineering).
- Only mention universities relevant to the career being discussed.
- Don't ask for information that's already in the data."""


def _build_context_message(data: dict) -> str:
    return f"""--- STUDENT ASSESSMENT RESULTS ---

TOP CAREERS:
{data.get("top_careers", [])}

UNIVERSITIES:
{data.get("universities", [])}

FINANCIAL DATA:
{data.get("financials", [])}

CONFIDENCE SCORES:
{data.get("confidence_scores", {})}
--- END OF RESULTS ---"""


def _build_career_context_prefix(career_context: dict) -> str:
    """Build a one-shot instruction that anchors 'this career' to the career
    detail page the student is currently viewing. Returned text is prepended to
    ONLY the copy of the final user turn sent to Cohere (never stored in history),
    so it overrides the assessment's #1 match without going stale on navigation."""
    name = (career_context or {}).get("name")
    if not name:
        return ""

    facts = []
    smin = career_context.get("salary_min_inr")
    smax = career_context.get("salary_max_inr")
    if smin or smax:
        facts.append(f"Salary (INR/yr): {smin}–{smax}.")
    outlook = career_context.get("growth_outlook")
    if outlook:
        facts.append(f"Growth outlook: {outlook}.")
    recruiters = career_context.get("top_recruiters") or []
    if recruiters:
        facts.append("Top recruiters: " + ", ".join(str(r) for r in recruiters[:6]) + ".")
    steps = career_context.get("education_steps") or []
    if steps:
        facts.append("Education path: " + " → ".join(str(s) for s in steps[:6]) + ".")

    detail = (" " + " ".join(facts)) if facts else ""
    return (
        f'[CURRENT PAGE CONTEXT — IMPORTANT: The student is currently viewing the "{name}" '
        f"career detail page.{detail} When the student says \"this career\", \"this\", or \"it\", "
        f"they mean {name}. Answer about {name} specifically — do NOT default to their #1 overall "
        f"assessment match unless they explicitly ask about a different career.]\n\n"
    )


def chat_with_ai(student_id: int, user_query: str, result=None, career_context=None):
    print(f"🔥 USING COHERE (student_id={student_id})")

    if result is None:
        result = run_career_engine(student_id)

    # Initialise history for new sessions, injecting context as first exchange.
    # Cohere v2 takes system instruction as a {"role": "system"} message at index 0.
    if student_id not in _conversation_history:
        context_msg = _build_context_message(result)
        _conversation_history[student_id] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": context_msg},
            {"role": "assistant", "content": "Understood. I have reviewed the student's assessment results and am ready to give personalised guidance."},
        ]

    history = _conversation_history[student_id]
    history.append({"role": "user", "content": user_query})

    # If the student opened the counselor from a specific career detail page, the
    # current-page context is injected into ONLY the copy of the final user turn
    # sent to Cohere — never stored in history — so "this career" anchors to the
    # page being viewed (prioritised over top_careers[0]) without polluting
    # conversation memory or going stale as the student navigates between careers.
    messages = history
    if career_context:
        prefix = _build_career_context_prefix(career_context)
        if prefix:
            messages = history[:-1] + [{"role": "user", "content": prefix + user_query}]

    response = _client.chat(
        model="command-r-plus-08-2024",
        messages=messages,
    )

    reply = response.message.content[0].text.strip()

    history.append({"role": "assistant", "content": reply})

    # Keep 3 header entries (system + context pair) + last 10 exchanges (20 messages)
    if len(history) > 23:
        _conversation_history[student_id] = history[:3] + history[-20:]

    return {"reply": reply}
