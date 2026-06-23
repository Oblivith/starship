# CHANGELOG — Pre-Phase-8 Improvement Pass

**This file is the SOLE record of the pre-Phase-8 cleanup pass.** It is kept
separate from `PROJECT_STATE.md` / `CURRENT_PHASE.md` on purpose so it does not
get mixed into the main phase history.

## How to revert any change

> To revert any change, tell Claude Code: **"revert change N"** and provide this
> changelog file — it contains the exact original code/value to restore for that
> entry. Each entry is numbered and self-contained: reverting one number does not
> require reverting any other unless the entry explicitly says it depends on
> another change.

Every entry below records: the file(s) affected, a one-sentence description, and
the **exact original code** being replaced (verbatim, in a code block) so it can
be pasted back exactly.

---

## Change 1 — CareerCard: make the clickable card keyboard-accessible

**File:** `frontend/src/components/CareerCard.jsx`

**Description:** When a `CareerCard` has an `onClick` handler (every card on the
Dashboard, Careers, and Results pages opens a roadmap on click), it was a plain
`motion.div` with no keyboard support — a mouse-only control. Added `role="button"`,
`tabIndex={0}`, an `aria-label`, and an `onKeyDown` handler (Enter/Space) **only when
`onClick` is present**, matching the keyboard pattern already used by
`ScholarshipCard.jsx`. Non-clickable cards are unchanged.

**Exact original code replaced** (the `motion.div` opening, lines ~49–57):

```jsx
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: index * 0.08 }}
      whileHover={{ y: -4, boxShadow: '0 0 24px rgba(83,74,183,0.45)' }}
      onClick={onClick}
      style={{
```

To revert: restore the block above exactly (and remove the `const interactive = ...`
line added just before the `return`).

---

## Change 2 — api.py: stop leaking raw exception text to API clients

**File:** `api.py`

**Description:** The global exception handler returned the raw `str(exc)` of any
unhandled error directly to the client. That can disclose internals (SQL fragments,
file paths, library/config details) to anyone who can trigger a 500. Changed it to
**log the full exception with traceback server-side** (adds logging — existing
prints/logging are untouched) and return a generic, user-safe message. The client
response keeps the same `{"error": ...}` shape, so the frontend contract is unchanged.
Only genuinely *unhandled* 500s are affected — every explicit `JSONResponse(status_code=4xx, ...)`
return and `HTTPException` (e.g. 401/404/422) is dispatched by its own handler and is
untouched.

**Exact original code replaced — (a) imports block near the top (lines ~1–9):**

```python
from __future__ import annotations

import os
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from score_assessment import run_career_engine
from ai_chat import chat_with_ai
```

**(b) the handler itself (lines ~71–73):**

```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc)})
```

To revert: restore both blocks above exactly and remove the added
`logger = logging.getLogger("starship.api")` line.

---

## Change 3 — AIOrb: don't silently drop a message typed while the reply is loading

**File:** `frontend/src/components/AIOrb.jsx`

**Description:** `AIOrb.send()` cleared the input draft and called `onSend` unconditionally,
but the consumer (`CounselorOrb.onSend`) early-returns when `loading` is true. So if a
student hit Enter/Send while the counselor was still answering, their typed message was
**cleared from the box but never sent** — silent data loss. Fixed by (a) guarding `send()`
so it does nothing while `isLoading` (the draft is preserved), and (b) disabling + dimming
the send button while `isLoading` so the busy state is visible. The input stays editable so
the student can keep composing.

**Exact original code replaced — (a) the `send` handler (lines ~76–81):**

```jsx
  const send = (text) => {
    const t = (text ?? draft).trim();
    if (!t) return;
    onSend?.(t);
    setDraft('');
  };
```

**(b) the submit button (lines ~222–238):**

```jsx
              <button
                type="submit"
                aria-label="Send"
                style={{
                  flex: '0 0 auto',
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--void)',
                  background: 'var(--gradient-teal)',
                  fontSize: 16,
                }}
              >
                →
              </button>
```

To revert: restore both blocks above exactly.

---

## Change 4 — api.py: validate non-negative money fields on PATCH /profile

**File:** `api.py` (`update_profile`)

**Description:** `POST /start-assessment` already rejects a negative `budget_max`, but
`PATCH /profile` accepted any float for `annual_family_income_inr` / `budget_max_inr`.
The frontend (Onboarding/Profile) guards `>= 0`, but the API itself did not, so a direct
call could persist a negative budget that then flows into the affordability scoring. Added
a server-side `>= 0` check that mirrors the existing `/start-assessment` validation message
style. Purely additive (a new guard clause); no schema or query change.

**Exact original code replaced (lines ~522–526):**

```python
    fields = {k: v for k, v in req.model_dump().items() if v is not None}
    if not fields:
        return JSONResponse(status_code=422, content={"error": "No fields to update"})

    set_clause = ", ".join(f"{k} = %s" for k in fields)
```

To revert: restore the block above exactly (removing the inserted money-field validation loop).

---

## Summary of this pass

| # | Area | File(s) | Build/Check |
|---|------|---------|-------------|
| 1 | Accessibility | `frontend/src/components/CareerCard.jsx` | `npm run build` ✅ |
| 2 | Security (info-disclosure) | `api.py` | `python` syntax ✅ |
| 3 | UX bug (lost chat message) | `frontend/src/components/AIOrb.jsx` | `npm run build` ✅ |
| 4 | Backend input validation | `api.py` | `python` syntax ✅ |

- **Total changes made:** 4
- **Changes reverted by author mid-session:** 0
- **Deliberately NOT changed** (considered, then left alone, to avoid churn/risk):
  - `Scene2FigureFallback.jsx` — documented as an intentional revert backup; never imported, so zero bundle impact. Not deleted.
  - Debug `print("🔥 …")` lines in `api.py` / `ai_chat.py` — left in place to respect the
    `docs/CLAUDE.md` rule "Preserve all existing console output and logging."
  - `config.py` hardcoded DB-password fallback (`"7616"`) — a real secret, but it is the
    working local-dev default; removing it would break local DB connectivity. **Flagged for a
    dedicated follow-up** (rotate + move to required env var) rather than changed blind here.
  - Per-endpoint DB connections in `api.py` / `oauth.py` are not wrapped in `try/finally`, so a
    mid-request exception can leak a connection. Real but a broad multi-endpoint refactor — out
    of scope for an isolated low-risk pass; flagged for a dedicated, tested change.
  - `ConstellationMap` SVG nodes aren't keyboard-focusable, but they duplicate the
    now-keyboard-accessible `CareerCard`s on the same Results page, so they were left as a
    visual enhancement rather than adding redundant tab stops.
