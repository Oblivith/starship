# STARSHIP — Project State

## Completed

### Session 58 — Code splitting + performance: lazy loading, starfield worker, meta tags, robots.txt (2026-06-23)

**Changed: `frontend/src/App.jsx`, `frontend/src/components/StarfieldCanvas.jsx`,
`frontend/src/workers/starfield.worker.js` (new), `frontend/vite.config.js`,
`frontend/index.html`, `frontend/public/robots.txt` (new).
`npm run build` → 499 modules, 0 errors. 30+ separate chunks confirmed.**

- **React.lazy for Landing** — Landing was the only static page import in `App.jsx`. Converted to
  `React.lazy(() => import('./pages/Landing.jsx'))`. `RouterProvider` wrapped in
  `<Suspense fallback={<LoadingScreen />}>` (imported normally, not lazy — it is the fallback).
  All other pages already used the data router's `lazy` property and remain unchanged (that
  pattern avoids the suspended-inside-data-router React warning). **Build chunk:** `Landing-*.js`
  at 158.68 kB — now a deferred download, not part of the initial JS payload.

- **StarfieldCanvas off main thread** — `starfield.worker.js` (new) receives the canvas via
  `OffscreenCanvas` and runs the entire three-layer star + shooting-star `requestAnimationFrame`
  loop off the main thread. `StarfieldCanvas.jsx` detects `typeof OffscreenCanvas !== 'undefined'`
  at runtime: if available, transfers the canvas (`canvas.transferControlToOffscreen()`) and
  creates a module worker (`new Worker(new URL('../workers/starfield.worker.js', import.meta.url), {type:'module'})`);
  mouse + resize events postMessage to the worker. Falls back silently to the unchanged
  main-thread loop on Safari < 17 / older browsers. `vite.config.js` gains `worker: {format:'es'}`.
  **Build chunk:** `starfield.worker-*.js` at 2.69 kB emitted separately.

- **OG / SEO meta tags** — Added to `frontend/index.html`: `og:title`, `og:description`,
  `og:type`, `twitter:card`, `robots: index,follow`, `canonical: https://starship.careers`.

- **robots.txt** — `frontend/public/robots.txt`: `Allow: /`; `Disallow` for `/dashboard`,
  `/assessment`, `/results`, `/admin` (auth-gated pages; no SEO value in crawling them).

- **Chunk size summary (build):**
  `starfield.worker-*.js` 2.69 kB · `Landing-*.js` 158.68 kB · `Assessment-*.js` 117.08 kB ·
  `Results-*.js` 18.28 kB · `Roadmap-*.js` 13.53 kB · `Dashboard-*.js` 13.47 kB ·
  `Careers-*.js` 7.00 kB · all auth pages 1–3 kB each.
  Main shared vendor bundle (`index-*.js`) 393.95 kB (React + React Router + Framer Motion).

---

### Session 57 — Admin UI: /admin + /admin/students/:id pages (2026-06-23)

**New `frontend/src/pages/Admin.jsx` + `frontend/src/pages/AdminStudent.jsx`;
updated `frontend/src/App.jsx` (two new public routes). `npm run build` → 499 modules, 0 errors.**

- **`Admin.jsx` (`/admin`)** — public, key-gated. Prompts for admin key on first visit (password
  input); stores in `sessionStorage('starship_admin_key')`. Fetches `GET /admin/students?limit=500`
  with `X-Admin-Key` header using raw `fetch` (bypasses the JWT axios client). 401/403 → clears
  sessionStorage, shows "Invalid admin key", returns to lock screen. Table columns: Name, Email,
  Phone, Class, State, Assessment (is_verified badge), Top Career, Score, Last Login. Top Career and
  Score show "—" (not returned by the current admin endpoint). Client-side search by name/email,
  sort by name / email / last_login (clickable column headers, toggle asc/desc). Row click navigates
  to `/admin/students/{id}`. Sign-out button clears sessionStorage. Uses inline styles with design
  tokens; no AppShell dependency.

- **`AdminStudent.jsx` (`/admin/students/:id`)** — fetches `GET /admin/students/{student_id}` with
  `X-Admin-Key` from sessionStorage. If key absent → redirect to `/admin`. 401/403 → clear key +
  redirect. 404 → error message. Displays full profile grid (9 fields: student_id, name, email,
  phone, class, preferred_state, annual_family_income_inr, is_verified badge, last_login). Three
  placeholder sections — Assessment Results / Top 5 Career Matches / Scholarship Matches — each with
  a dashed-border empty note explaining a dedicated admin results endpoint is needed. Back button →
  `/admin`.

- **`App.jsx`** — two new public lazy routes added above the auth block:
  `/admin` → `Admin.jsx`, `/admin/students/:id` → `AdminStudent.jsx`. Not inside `<ProtectedRoute>`.

**Note:** The current `GET /admin/students` and `GET /admin/students/{id}` endpoints return only
basic student profile fields (no assessment results, career matches, or scholarship data). The
placeholder sections in AdminStudent.jsx mark where those would go once a backend admin-results
endpoint is built.

---

### Session 56 — Frontend error states + empty states across all authenticated pages (2026-06-23)

**New `frontend/src/components/ErrorState.jsx`, `frontend/src/components/EmptyState.jsx`,
updated `frontend/src/components/index.js` (barrel), `frontend/src/pages/Dashboard.jsx`,
`frontend/src/pages/Results.jsx`, `frontend/src/pages/Careers.jsx`,
`frontend/src/pages/Roadmap.jsx`, `frontend/src/pages/Assessment.jsx`,
`frontend/src/pages/auth/Login.jsx`, `frontend/src/api/client.js`.
`npm run build` → 497 modules, 0 errors.**

- **`ErrorState` component** — dark card (max-width 480px, centred, `--deep` bg, violet border/glow)
  with a compass SVG icon (~40px, `--violet`), title (17px fw-medium), message (`--fs-body-sm`,
  `--moonstone`), and optional "Try again" button (outline violet, `--radius-md`). Used for
  network/fetch failures.

- **`EmptyState` component** — same card style but lighter tone (dashed border), three optional icons
  (`"star"`, `"compass"`, `"map"`), title + message only (no retry). Used for genuine empty data.

- **Dashboard.jsx** — network error gate replaced with `<ErrorState onRetry={fetchResults} />`;
  added empty-career-matches gate returning centred `<EmptyState icon="star" />`.

- **Results.jsx** — fetch failure replaced with `<ErrorState onRetry={fetchResults} />`;
  scholarships-empty section shows `<EmptyState icon="star" title="No scholarships matched yet" />`;
  universities-empty section shows `<EmptyState icon="map" title="No colleges matched yet" />`.

- **Careers.jsx** — fetch failure replaced with `<ErrorState onRetry={fetchResults} />`;
  filtered-empty grid slot replaced with `<EmptyState icon="compass" title="No careers match this
  filter" />` with message varying on whether a filter/search is active.

- **Roadmap.jsx** — error gate replaced with `<ErrorState onRetry={fetchRoadmap} />`; added
  `!details` gate as second `<ErrorState onRetry={fetchRoadmap} />`; education-steps-empty
  replaced with `<EmptyState icon="map" title="Education pathway coming soon" />`.

- **Assessment.jsx** — questions-fetch failure replaced with `<ErrorState onRetry={refetchQuestions}
  />` (full-page); session-gate failure shows inline top banner (`role="alert"`, violet-tint bg);
  submit failure stays inline (`gateError` state, does not navigate away). Inline banner placed ABOVE
  `<ProgressBar>` so it is always visible without disrupting the assessment flow.

- **api/client.js** — double-401 handling was already in place (`isRefreshCall` guard). Added
  `reason` param to `redirectToLogin` and `failAuth`; double-401 and refresh failure now redirect
  to `/login?reason=session_expired`. **Login.jsx** reads the `reason` param via `useSearchParams`
  and initialises `error` state with "Your session has expired. Please sign in again."

---

### Session 55 — LoadingScreen replaced with single pulsing star (CSS-only, no JS animation) (2026-06-23)

### Session 54 — Counselor: career-page context (Bug A) + progressive typing (Bug B) (2026-06-23)

**`ai_chat.py`, `api.py` (`/chat`), `frontend/src/components/CounselorOrb.jsx`,
`frontend/src/components/AIOrb.jsx`, `frontend/src/pages/Roadmap.jsx`. `npm run build` → 493
modules, 0 errors. `python3 -m py_compile ai_chat.py api.py` clean.**

- **BUG A — counselor ignored the career page being viewed. ROOT CAUSE = failure point (a):
  the current career was NEVER passed in the first place.** `Roadmap.jsx` mounted `<CounselorOrb />`
  with no props; `CounselorOrb` posted only `{ message }`; `chat_with_ai` built context purely from
  `run_career_engine` (whose `top_careers[0]` was the student's #1 match, e.g. Journalist). So
  "Why is this career good for me?" on the Mechanical Engineer page was answered about Journalism.
  Secondary: the suggested example prompts in `AIOrb` were a static generic `DEFAULT_PROMPTS` array
  that referenced no specific career. (It was NOT (b) backend-overwrite or (c) a hardcoded
  top-career reference in the prompt generator — the page career simply never left the page.)
  - **Fix — thread explicit page context end-to-end.** `Roadmap.jsx` builds a `careerContext`
    `{ name, salary_min_inr, salary_max_inr, growth_outlook, top_recruiters, education_steps }`
    from the career the page is actually showing (`headline`) and passes it to `CounselorOrb`.
    `CounselorOrb` sends it as `career_context` on `POST /chat` and templates the suggested prompts
    against `careerContext.name` (e.g. *"Why is Mechanical Engineer a good fit for me?"*). `api.py`'s
    `ChatRequest` gained an optional `career_context: Optional[dict]`, forwarded to `chat_with_ai`.
    `ai_chat._build_career_context_prefix` builds a one-shot instruction ("the student is viewing
    the *Mechanical Engineer* page … when they say 'this career' they mean Mechanical Engineer …
    do NOT default to their #1 overall match") that is prepended to **only the copy of the final
    user turn sent to Cohere — never stored in history** (so it can't pollute memory or go stale as
    the student navigates between careers). When `career_context` is absent (Dashboard/Profile/
    general orb) no prefix is injected and the old top-match fallback is unchanged.
  - **Verified (stubbed Cohere client):** the page career + its facts reach the model's final turn,
    the stored history user turn stays the clean question, the assessment top-match data is still
    available as background, and the no-context path injects no prefix.

- **BUG B — counselor rendered replies as a wall of text → progressive "typing in".**
  - **Path taken: SIMULATED typing (not true streaming) — deliberate, lower-risk judgement call.**
    The Cohere SDK (5.21.1) *does* expose `ClientV2.chat_stream`, so true streaming is technically
    available. But the frontend HTTP layer is a single axios client with a single-flight 401→
    `/auth/refresh` interceptor and shared error handling, consumed by BOTH `CounselorOrb` and
    `DashboardCounselor`. True streaming would require switching `/chat` to raw `fetch()` +
    `ReadableStream`, re-implementing the JWT-refresh/retry + error logic outside axios, and a
    FastAPI `StreamingResponse` — a disproportionate rewrite of the request/response cycle vs. the
    UX gain. Per the brief's explicit fallback clause, implemented simulated typing instead.
  - **Implementation (in `AIOrb` only, so it covers every consumer):** the `/chat` call is unchanged
    (full JSON reply through axios). `AIOrb` reveals the most-recently-arrived **assistant** message
    progressively — ~4 chars every 18ms via a `setInterval` keyed on a `typingIdxRef` — while all
    earlier messages render in full. `useReducedMotion` shows the full reply instantly. The
    pin-to-bottom scroll effect now also depends on the reveal count so it follows the text as it
    types.
  - **Preserved:** `AIOrb.send()`'s loading-guard (`if (isLoading) return;` — no-op send while a
    reply is in flight, from the previous session) is **intact, untouched**; the loading dots,
    controlled/uncontrolled open+draft, and both wrappers' try/catch + `friendlyError` handling are
    unchanged.

---

### Session 53 — Landing Scene 1: ground-glow DOM order fix + build verification (2026-06-21)

**Only `frontend/src/pages/Landing.jsx` changed (DOM order only). `npm run build` → 493 modules,
0 errors.**

Session 52's `js-ground-glow` div was placed after the student in the DOM. Corrected: moved to
before `.js-seated` so DOM order matches z-index order (rooftop→glow→student). No value changes.
All properties confirmed: `bottom:7vh/5vh`, `width:364px/236px`, `height:150px/110px`,
`radial-gradient(ellipse at 50% 70%, rgba(225,232,250,0.22)…)`, `mixBlendMode:screen`,
`filter:blur(6px)`, `zIndex:4`. Glow invisible at zoom-in; fades in via
`.from('.js-ground-glow',{autoAlpha:0,duration:0.44},0.14)` in `tl1` alongside `.js-city`.

---

### Session 52 — Landing Scene 1: PNG overlay reverted → single conservative CSS ground-glow (2026-06-21)

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 493 modules, 0 errors (no new
module). No locked layout value touched.**

Session-51's PNG lighting-overlay failed visually (image too large, saturated haze covered hero
text, glow blob oversized). Fully reverted. Replaced with one small CSS-only ground-glow element
scoped tightly to the area beneath the student — no other lighting added this pass.

**Removed (fully, no orphaned refs):**
- `<img className="js-lighting-overlay">` (Session-51 PNG overlay).
- `.from('.js-lighting-overlay', ...)` GSAP tween from `tl1`.

**Added — `js-ground-glow` div (one element only):**
- `bottom: 7vh / 5vh` (matches student anchor exactly), `width: 364px / 236px` (≈1.3× student
  width), `height: 150px / 110px` (≈0.44–0.50× student height).
- At 900px viewport, glow top = **23.7% from bottom** — within the bottom 25% zone, far from
  the hero headline (top 12%).
- `mixBlendMode: screen`, `filter: blur(6px)`, `zIndex: 4`. Fades in via tl1 with the pull-back.

---

### Session 51 — Landing Scene 1: CSS gradient lighting abandoned → single painted PNG overlay (2026-06-21)

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 493 modules, 0 errors (no new
module). No locked layout value touched.**

After three sessions (42/44/47) of CSS gradient + `mix-blend-mode:screen` lighting that always read
as "a shape" rather than "light," the CSS-gradient approach was abandoned entirely and replaced with a
single `<img className="js-lighting-overlay">` at `/assets/skyline/lighting-overlay.png` — a
transparent PNG where ground-glow, rim-light, haze, and window-bloom are painted together as one
cohesive layer with organic, irregular edges (no perfect-oval or hard-line CSS geometry artifacts).

**Removed (all deleted, no dead code):**
- Two-layer screen-blended glow (LAYER 2 outer spread + LAYER 1 inner core, both `mixBlendMode:'screen'`, z=4)
- Rim-light bar (`bottom:41%`, 3px, `blur(4px)`, z=3)
- City-haze overlay (`height:54vh`, `to top` gradient, z=1)
- Foreground-warmth overlay inside `.js-city` (`mixBlendMode:'overlay'`, z=5)
- Vignette (`radial-gradient(ellipse 130% 100%)`, full-inset, z=8)
- All multi-paragraph SESSION 42/44/47 comment blocks cleaned up

**Added:**
- `<img className="js-lighting-overlay">` at z=4, `objectFit:cover`, `objectPosition:bottom center`,
  `mixBlendMode:'screen'`, `opacity:0.85`. `onError` hides it silently so the scene renders without
  the asset until Aman places it at `frontend/public/assets/skyline/lighting-overlay.png`.
- `tl1` in GSAP: `.from('.js-lighting-overlay', { autoAlpha: 0, duration: 0.44 }, 0.14)` — same
  scrub position as `.js-city` reveal (0.14), so the overlay is invisible in the initial zoomed-in
  state and fades in alongside the skyline during the pull-back.

---

### Session 50 — Universities gap-fill v2: cost + state coverage, +332 real institutions (2026-06-21)

**New `scrapers/universities_expand_v2.py`. Targets GAPS, not raw count. Run twice (idempotent);
universities table 9,718 → 10,050 rows.**

- **KEY DATA FINDING (corrects the brief's premise):** India is split across TWO country labels.
  `country='India'` = 307 rows (Session-17 curated, 100% cost + state). But the EARLIER global/QS
  import labels India rows with the ISO-2 code **`'IN'`** = 357 rows, and that is where the NULLs
  live (31 NULL cost, 316 NULL state). Filtering on `country='India'` alone shows zero NULLs — the
  wrong picture. So "India universities" is defined here as `country IN ('India','IN')` (combined
  664 rows before). Reported back rather than silently following the `='India'` assumption.
- **STEP A — cost fill (Cohere `command-r-plus-08-2024`, batched 20/call):** estimated realistic
  annual INR cost from name/tier/type for the 31 NULL-cost India rows. UPDATE-only (never
  overwrites). Result: **31 filled → India cost coverage 95.3% → 100.0%** (target ≥70%).
- **STEP B — state inference (Cohere, batched):** inferred Indian state/UT from name (+city) for
  the 316 NULL-state India rows; rejects any state not in the official 36-name set (no
  hallucinations). **311 filled across two runs → India state coverage 52.4% → 99.5%** (target
  ≥60%). 5 rows left NULL — genuinely unidentifiable names ("Indian University", "University of
  Music and Fine Arts") that Cohere correctly declined to guess.
- **STEP C — +332 NET-NEW real named institutions** (target ≥300), `data_source='curated_v2'`,
  all with cost, all India ones with state: ~145 government polytechnics, ~150 state private
  universities (beyond Session 17), ~45 government engineering colleges, 25 government medical
  colleges, + abroad top-51-100 (USA/UK/Canada/Australia — most already existed, only 1 net-new).
  **Curated real names only — Cohere is used ONLY to cost/locate existing real rows, never to
  invent institution names** (same philosophy as Session 17). Idempotent via case-insensitive
  existence check (no unique constraint on `university_name` exists, so `ON CONFLICT` is impossible
  — documented in both v1 and v2). 332 = 232 (run 1) + 100 (run 2 supplement).
- **Final counts:** total **9,718 → 10,050** (+332); India rows 664 → 995; cost coverage **100.0%**;
  state coverage **99.5%**. `GET /stats` `universities` count will read 10,050 after its 5-min cache
  expires (no endpoint change needed).

---

### Session 49 — Career match %: tier colour-coding + percentile context (display-only) (2026-06-21)

**`frontend/src/components/CareerCard.jsx`, `frontend/src/pages/Careers.jsx`, and
`frontend/src/utils/matchTiers.js`. `npm run build` → 493 modules, 0 errors (no new module —
edits to existing files only). NO scoring/backend logic touched** — `score_assessment.py`, all
match-percentage math, and every DB query are byte-identical. This was purely how the EXISTING
score gets coloured and contextualised on screen.

- **TASK 1 — tier colour-coding on the percentage number only.** The match % number in CareerCard
  is now coloured by the SAME `tiers.tierOf` already used by the Careers tier-filter pills, so a
  green % is guaranteed to be the same career shown under the "Good match" tab (incl. the adaptive
  fallback in `matchTiers.js`). Colours are existing tokens.css tokens — **no new hex introduced**:
  `good → var(--mint)` (#5DCAA5, the brand's positive green-teal), `ok → var(--gold)` (#EF9F27,
  semantic amber), `other → var(--coral)` (#D85A30, the dedicated destructive token already used by
  the re-take-assessment / delete buttons in Profile.jsx + Dashboard.jsx). No dedicated
  `--success/--warning/--danger` token exists in tokens.css (verified), so the closest existing
  positive/amber/destructive tokens were re-used for design consistency. Colour is applied ONLY to
  the number — card background, border, and the existing match bar (`--gradient-brand`) are
  unchanged.
- **`matchTiers.js` additions (no behaviour change to existing exports):** `TIER_COLORS` (the
  good/ok/other → token map), `standardTierOf(percent)` (extracted absolute-threshold classifier,
  now reused by `computeTiers`' standard branch AND as CareerCard's default when no adaptive tier is
  passed), `getPercentileRank(score, allScores)` (share of the student's other careers this one
  beats, 0–100), and `getPercentileCaption(percentile)` (returns `"Top N% of your matches"` only
  when percentile ≥ 70 — i.e. genuinely top ~30% — else `null`, so average careers show the plain %
  with no noise).
- **TASK 2 — percentile context.** Careers.jsx memoises `allPercents` (the full per-student
  distribution) and passes each card a `percentileCaption` computed CLIENT-SIDE from that
  already-fetched list (no new endpoint). CareerCard renders it as a small, muted
  (`--text-tertiary`, `--fs-caption`) right-aligned caption beneath the percentage; absent for
  non-distinguishing careers.
- **CareerCard backward-compatible:** new `matchTier` + `percentileCaption` props are optional. When
  absent (Dashboard.jsx, Results.jsx — unchanged) the card self-classifies via `standardTierOf`, so
  the percentage is tier-coloured everywhere it's displayed; the plain percentile caption only
  appears where a parent supplies it (currently Careers.jsx).

**Verification:** `npm run build` → 493 modules, 0 errors. The Careers page is behind auth + a
completed assessment (needs a logged-in student with cached results), so live headless preview isn't
meaningful here — the change is static display logic confirmed by the build; flagged for Aman to
eyeball in a real session.

---

### Session 48 — Live stats endpoint + Scene 4 Possibility live counters (2026-06-21)

**`api.py` (new `GET /stats`) + `frontend/src/pages/Landing.jsx` (Scene 4). `npm run build` →
493 modules, 0 errors. Module count unchanged.**

- **`GET /stats` (public, no auth):** Returns `{ careers, scholarships, universities, states }` via
  `COUNT(*)` queries. In-memory 5-minute TTL cache (`_STATS_CACHE` dict, `time.monotonic()`). Current
  real counts: **careers 221, scholarships 96, universities 9,718, states 34**.
- **Scene 4 (Possibility):** `client.get('/stats')` on mount; `useState` fallback values
  `{careers:25, scholarships:340, universities:180, states:28}` prevent layout flash. Fetch failure
  silently keeps fallbacks. **Four StatCounters** (was 3): Careers+ / Scholarships+ / Universities+ /
  States. `StatCounter` already uses `en-IN` locale — 9,718 renders as "9,718" (no component changes).

---

### Session 47 — Landing Scene 1: rebuild the ground-glow as TWO-LAYER screen-blended light + warm-foreground contrast (2026-06-20)

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 493 modules, 0 errors (no new
module — lighting-layer edit only). No locked layout value (skyline sizing/position, rooftop,
student, constellations) touched.**

- **SECTION A — the structural gap the prior 3 lighting sessions (42/44) missed = BLEND MODE,
  not another value tune.** Sessions 42/44 only ever re-tuned a SINGLE, NORMAL-blended radial
  div (colour, opacity, size, stops). A normal-blended translucent gradient is by definition a
  shape laid OVER the rooftop — it averages its colour with the pixels beneath, so it always
  reads as "a flat hazy oval on the ground," never as emitted light. Paint can't emit; it can
  only veil. The fix that makes CSS gradients read as light is `mix-blend-mode: screen`
  (additive — brightens the rooftop's own pixels). Secondary gap: a real ambient pool has a
  bright fast-falloff CORE + a wide soft ambient SPREAD; one single-peak gradient can't be both.

- **SECTION B — two-layer screen-blended light pool (replaced the single glow div).**
  - LAYER 2 (outer ambient spread): kept the Session-44 values
    (`radial-gradient(ellipse at 50% 65%, rgba(228,234,252,0.34) 0%, rgba(185,200,235,0.18) 30%,
    rgba(150,172,215,0.07) 52%, transparent 72%)`, 60% × 26vh, bottom 2vh, z4) but ADDED
    `mixBlendMode:'screen'` + raised blur to `blur(8px)`.
  - LAYER 1 (inner bright core, NEW): `radial-gradient(ellipse at 50% 60%, rgba(235,238,255,0.42)
    0%, rgba(210,220,250,0.18) 55%, transparent 100%)`, 42% wide (~70% of outer) × 16vh (~60% of
    outer), `bottom: isMobile ? '4vh' : '5vh'` (closer to the seated figure's base than the outer
    pool's 2vh), `mixBlendMode:'screen'`, `blur(4px)`, z4. `.js-cam` already has
    `isolation:'isolate'`, so screen blends within the camera group against the rooftop (not the
    page). Stops kept at the brief's recommended values since the prior problem was the glow being
    too FAINT/eaten; screen is additive so they read brighter than the same alphas did under normal
    blend — final fine-tuning wants a real browser.

- **SECTION C — warm-foreground contrast boost (completes the depth differential).** Atmospheric
  depth is a DIFFERENCE between layers; the cool city-haze already pushes the background cool, so
  added a sibling overlay inside `.js-city` (z5, just above the rooftop layer z4) to push the
  FOREGROUND warm/higher-contrast WITHOUT editing the rooftop's locked filter (additive-only):
  `linear-gradient(180deg, transparent 0%, rgba(255,200,140,0.06) 100%)`, `mixBlendMode:'overlay'`,
  `height:100%`, `pointerEvents:'none'`. Transparent at top → warm only on the flat roof/parapet,
  never the distant skyline. **City-haze re-verified:** its `height:54vh` fully covers the 52vh
  `.js-city` skyline zone (fades out ≈45vh, above the skyline top), so the cool haze already spans
  the building-dense lower band — no widening needed.

- **SECTION D — rim-light: anchor RE-VERIFIED, no correction needed.** The rooftop asset was NOT
  replaced since the rim was anchored (Session 42): rooftop layer is still
  `bottom:-14px / width:100% / height:auto`, and Sessions 43–46 touched sound, haze/glow, scoring,
  and ScrollToTop — never the rooftop. So `bottom:41%` remains the correct parapet anchor. ONLY
  raised the peak alpha 0.35→**0.45** (shoulders 0.15→0.20) so the warm rim still reads against the
  now-brighter screen-blended glow.

**Verification:** `npm run build` → 493 modules, 0 errors. Scene 1 is GSAP-pinned (headless preview
reports a 0×0 viewport — documented limitation Sessions 38/40/42/44), and `screen`/`overlay` blend
results specifically need the pinned scene rendered in a real browser to judge — flagged for Aman.
The changes are static blend-mode + gradient values, build-confirmed.

---

### Session 46 — ScrollToTop: fix pages loading pre-scrolled to bottom (2026-06-20)

**`frontend/src/components/ScrollToTop.jsx` (new), `frontend/src/App.jsx` (RootLayout wrapper).
`npm run build` → 493 modules (was 492; +1 for ScrollToTop.jsx), 0 errors.**

- **Bug:** Every route change in the SPA left the new page scrolled to wherever the previous
  page was — classic React Router client-side routing issue (browser does not reset scroll on
  pushState navigations by default).
- **Fix:** `ScrollToTop.jsx` — a zero-render component using `useLocation` + `useNavigationType`.
  On every `pathname` change, calls `window.scrollTo(0, 0)` — but only when `navType !== 'POP'`
  (i.e. skips browser back/forward, where native scroll restoration is correct behaviour).
- **Integration:** Added a `RootLayout` wrapper in `App.jsx` (using `Outlet` from react-router-dom)
  that renders `<ScrollToTop />` and then `<Outlet />`. This single root layout wraps the entire
  route tree — public, auth, and protected routes are all covered without adding ScrollToTop to
  each page individually. `AppShell.jsx` unchanged.
- **Landing.jsx unaffected:** ScrollToTop only fires on `pathname` changes; it does not interfere
  with GSAP ScrollTrigger's internal scroll management within a single page.

---

### Session 45 — Career match scoring: kill the "~50 careers tied at 60%" bug + adaptive tier filtering (2026-06-20)

**`score_assessment.py` (scoring rewrite), `frontend/src/utils/matchTiers.js` (new),
`frontend/src/pages/Careers.jsx` (tier filter), and the three identical `scoreToPercent`
copies in `Careers.jsx` / `Dashboard.jsx` / `Results.jsx`. `npm run build` → 492 modules
(was 491; +1 for matchTiers.js), 0 errors.**

- **DIAGNOSIS — it was a CODE bug, not a data bug (real numbers).** Ran the matcher for real
  student 16 across all **221** career_profiles: only **5 distinct raw scores {0,2,3,5,8}** →
  **5 percentages {48,56,60,68,80}%**, with **46 careers tied at exactly 60%** (and 66 at 68%) —
  confirming Aman's "~50 at 60%". Root cause was in the math, not the data (career_profiles is
  well differentiated: 5/5/4/4 distinct numerical/verbal/discipline/study thresholds, 6/6 distinct
  primary/secondary traits). The old integer point system failed three ways: (1) it compared
  **0–100 normalized** aptitude/discipline/study scores against the careers' **1–5** thresholds, so
  every comparison **saturated to a per-student CONSTANT** (always-pass or always-fail) and stopped
  differentiating careers; (2) `aptitude_scores.get("verbal")` read a **non-existent key** (the real
  key is `verbal_reasoning`) → verbal was a constant −2 for every career; (3) the only surviving
  differentiator was a **binary "trait in top-2"** bonus (+3/+2) → 4 levels. For student 16
  (numerical=100, verbal=100, discipline=0, study=70, exam=70) every non-trait term is constant, so
  total = constant(0) + trait{0,2,3,5} — exactly the observed clumps.

- **FIX (code) — continuous 0–100 weighted match.** Replaced the per-career integer block with a
  graded percentage on a shared 0–100 scale: **interest 50%** (`0.65·fit(primary)+0.35·fit(secondary)`,
  where `fit = 0.5·absolute RIASEC + 0.5·relative standing within the student's own profile`),
  **aptitude 30%** (numerical + verbal each graded vs `required×20` with a linear shortfall penalty),
  **readiness 20%** (discipline + study + exam-tolerance-vs-difficulty, same grader; CA Foundation
  floored at 60 to preserve the old exam-exemption intent without a hard cliff). Rounded to 1 dp. No
  new arbitrary rounding scheme — the spread is what the weighted calc naturally produces.

- **POST-FIX DISTRIBUTION (re-ran the same diagnostic).** Real students now fan out:
  student 17 → **34 distinct %**, range **56–90%**, largest tie 34 (60% now holds just **9** careers,
  not 46); student 12 → **29 distinct %**, range 58–88%, largest tie 31. Student 16 still clusters
  (all RIASEC = 80.0 — a flat test account with genuinely no interest signal); that is the exact
  case the adaptive tiers below handle.

- **Downstream rescales (same file):** `top_careers` filter `>= -5` (old integer scale) → top 2 of
  the sorted list; admission-probability `career_fit_score = career_score*10+50` → `clamp(career_score,
  30, 95)` since `career_score` is now already a 0–100 %.

- **Frontend `scoreToPercent` (×3, identical):** the engine now returns a 0–100 % directly, so all
  three copies became `max(5, min(99, round(score)))` instead of the old `(score+12)/25*100` rescale.

- **`frontend/src/utils/matchTiers.js` (new) — adaptive tier classification.** Standard: Good ≥60,
  OK 40–59, Other <40. **Fail-safe:** if NO career ≥60% **and** ≥5 scored careers, tiers recompute
  from the student's OWN ranked distribution (Good = top 20%, OK = next 30%, Other = rest), expressed
  as percentage cutoffs so each career is still classified by its own %. `ceil` on the Good count
  guarantees a non-empty Good tier. Returns `{mode, caption, goodThreshold, okThreshold, tierOf}`;
  caption = `'Showing relative match quality'` only in adaptive mode. Unit-tested both paths.

- **`Careers.jsx` — tier filter.** New All / Good / OK / Other pill row (with per-tier counts,
  matching the existing category-pill tokens), computed once from the FULL score distribution via
  `computeTiers` so labels stay stable while searching/filtering; the caption renders under the pills
  when adaptive mode is active. Tier filter composes with the existing search + RIASEC-category
  filters. Empty-state copy updated to mention whichever filters are active.

---

### Session 44 — Landing Scene 1: fix the flat purplish-grey band + the invisible ground-glow (2026-06-20)

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 491 modules, 0 errors.
No locked layout value (skyline sizing/position, rooftop, student, constellations) touched —
diagnostic + fix on the lighting layer only.**

- **Flat band artifact — ROOT CAUSE = Section C city-haze.** Its gradient was
  `linear-gradient(to top, rgba(70,90,150,0.08) 0%, rgba(90,110,160,0.12) 100%)`. Two faults:
  (1) density was BACKWARDS — most opaque (0.12) at the TOP edge, lighter at the bottom; (2) NO
  transparent terminating stop — at the div's top boundary (54vh ≈ just above the 52vh `.js-city`
  skyline top) opacity sat at its max 0.12 and abruptly cut to 0 above the div. That 0.12→0
  discontinuity at a fixed horizontal line = the hard-edged "dull purplish-grey band where the
  buildings meet the upper sky" (rgba(90,110,160) over dark navy reads purplish-grey). It painted
  over the skyline because it is DOM-rendered after `.js-city` at the same z=1.
  **FIX:** flipped the density (densest at bottom/horizon) and fade to FULLY TRANSPARENT well
  before the top edge, with intermediate stops:
  `linear-gradient(to top, rgba(70,90,150,0.13) 0%, rgba(80,100,155,0.09) 28%, rgba(88,108,158,0.04) 58%, transparent 84%)`.
  The div's top edge is now transparent → no hard edge anywhere. height 54vh unchanged (the
  gradient fades out ≈45vh, long before the top). z=1 unchanged.

- **Invisible ground-glow — CAUSE = opacity/coverage, not stacking.** Stacking was already correct
  (glow z=4 sits above the entire `.js-city` stacking context z=1 incl. the rooftop img, and below
  the student z=5). Two real causes: (1) peak 0.20 pale-blue-white too faint now that the haze +
  the z=8 vignette darken the rooftop beneath; (2) the vignette (`transparent 48% → rgba(4,6,26,0.35)`)
  darkens toward all edges incl. the BOTTOM-centre where the glow sits, and being z=8 paints OVER
  the z=4 glow, eating it.
  **FIX:** core 0.20→**0.34** (within the brief's 0.28–0.35 guidance), added a mid stop for a softer
  falloff, enlarged 52%→**60%** wide / 22vh→**26vh**, bottom 3vh→**2vh**, still fades to fully
  transparent (72%) so it has no hard edge of its own:
  `radial-gradient(ellipse at 50% 65%, rgba(228,234,252,0.34) 0%, rgba(185,200,235,0.18) 30%, rgba(150,172,215,0.07) 52%, transparent 72%)`.

- **Sections B (rim-light) & E (vignette): untouched** — warm blurred amber rim and cool-navy
  vignette were not the band (the band was purplish-grey, hard-edged, flat — the haze's signature).

**Final values:** haze = `to top, 0.13/0.09/0.04/transparent at 0/28/58/84%`, height 54vh, z=1.
Glow = core 0.34, mid 0.18@30% / 0.07@52% / transparent@72%, 60% × 26vh, bottom 2vh, z=4.

**Verification:** `npm run build` → 491 modules, 0 errors. (Scene 1 is GSAP-pinned; headless preview
reports a 0×0 viewport — documented limitation Sessions 38/40/42 — so live pinned-scene screenshots
aren't meaningful; the fix is purely static gradient values, which the build confirms compile.)

---

### Session 43 — SoundManager: replace synthesized playDust + playChime with real audio files (2026-06-20)

**Only `frontend/src/components/SoundManager.jsx` changed. `npm run build` → 491 modules, 0 errors.
No changes to `Landing.jsx` or any other file — `playDust`/`playChime` call signatures are identical.**

Two synthesized sounds replaced with real `.mp3` files loaded via `HTMLAudioElement`:

- **Task 1 — `playDust()` → `dust-chime.mp3` (Sunovia silver chime).**
  Old implementation: white-noise `AudioBufferSourceNode` + `highpass(2kHz)` + `bandpass(5kHz, Q0.7)`
  gain chain (~70ms, peak 0.05) — removed entirely. New implementation: clone strategy
  (`new Audio(dustRef.current.src)`) on each call, `volume = 0.22`. Kept quiet (0.22) so the
  real chime doesn't read as a notification ding at the 200ms throttle rate Landing.jsx already
  enforces. Clone per call ensures overlapping rapid triggers never cut each other off — no
  audible click/pop even if the chime file is longer than 200ms.

- **Task 2 — `playChime()` → `star-chime.mp3` (soft/magical chime).**
  Old implementation: two sine oscillators at 900/920 Hz, gain 0.09, decay 200ms — removed
  entirely. New implementation: same clone strategy, `volume = 0.18`. Slightly quieter than dust
  since multiple constellation hover-enters can overlap; stays ambient rather than alert-like.

- **Task 3 — cleanup + lazy-load pattern.**
  `dustRef` and `chimeRef` refs added alongside `windRef`. All three `HTMLAudioElement` instances
  are created in a single `unlocked` useEffect (same lazy-load gate as wind-ambient — never before
  first user gesture). The base instances pre-cache the files; `playDust`/`playChime` clone from
  `ref.current.src` on each invocation. No shared synthesis helpers existed for dust/chime (their
  synthesis was fully inline) — no dead helpers to remove. `ensureCtx` / `ctxRef` retained (still
  used by `playClick`, `playWhoosh`, `playHover`, which remain Web Audio synthesis — untouched).

**Overlapping-playback strategy:** clone (`new Audio(src)`) for both sounds. Reasoning: the 200ms
throttle in Landing.jsx prevents >5 dust triggers/sec, but if the chime file's natural duration
exceeds 200ms a shared-instance `currentTime=0` reset would cause an audible click. Cloning
eliminates that risk with zero added complexity vs. a pool.

**Final volumes:** dust = 0.22, chime = 0.18.

**Unchanged:** `playClick` (420+210Hz synthesis), `playWhoosh` (noise→bandpass), `playHover`
(1100Hz sine), `startWind` (wind-ambient.mp3 loop) — byte-identical. No Landing.jsx changes.

---

### Session 42 — Landing Scene 1: lighting/atmosphere colour-correction + scroll-limbo outline attempt 2 (2026-06-20)

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 491 modules, 0 errors.
No locked positional/size value on any existing element changed.**

Four additive lighting elements added inside `.js-cam` as absolute siblings (no layout impact):

- **SECTION A — Ground-glow light pool (colour-corrected).** Previous purple/magenta
  (`rgba(180,170,230)`) → cooler blue-white matching the skyline's `hue-rotate(8deg)` lean:
  `radial-gradient(ellipse at 50% 70%, rgba(225,232,250,0.20) 0%, rgba(170,190,225,0.09) 35%,
  transparent 70%)`. Ellipse 52% viewport wide, `bottom:3vh`, z=4. Reads as moonlight/starlight.

- **SECTION B — Warm amber rim-light (position re-verified).** Colour unchanged
  (`rgba(255,211,155,0.35)`) — warm vs. cool contrast is correct. Position re-anchored to
  new rooftop asset geometry (SESSION 41): flat-roof-band top = 60% × 960px = 576px from
  rooftop image top; at 1440×900 viewport → parapet ≈ `bottom:41%`. Horizontal bar 3px
  tall, `filter:blur(4px)`, fades at both ends, z=3.

- **SECTION C — Cool city haze (verified unchanged).** `rgba(90,110,160,0.12)` top,
  `rgba(70,90,150,0.08)` base — already blue-leaning, never the purple source. `height:54vh`,
  z=1.

- **SECTION E — Vignette (verified unchanged).** `rgba(4,6,26,0.35)` = --void token = cool
  dark navy. Full-inset radial gradient, z=8.

- **SECTION F — Scroll-limbo outline, attempt 2.** `willChange:'transform'` was already
  present. `transformStyle:'flat'` → `transformStyle:'preserve-3d'` on `.js-cam`; added
  `perspective:'1000px'` to `.scene-1` (parent). This is a different compositing strategy
  (3D context vs. flat layer) that can resolve edge artifacts flat/isolate alone doesn't catch.
  Which child's bounding box the artifact aligns with requires real-browser devtools during
  a slow scroll — flagged for Aman to check. If still not resolved, the next diagnostic step
  is identifying the specific child element (`.js-city`, ConstellationLayer wrapper, or `.js-cam`
  itself) and targeting compositing hints there.

### Session 41 — Landing Scene 1: mobile gap, rooftop rework, constellation scatter, scroll-outline (2026-06-20)

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 491 modules, 0 errors.
DESKTOP SKYLINE LOCKED, UNCHANGED** — `.js-city`/`SKYLINE_LAYERS` far/mid/near sizing, position,
`objectPosition 50% 30%`, filters, masks, and scroll parallax (−4/−10/−18) and camera scale 1.82
are all byte-identical to Session 40 (grep-verified). Five scoped fixes:

- **FIX 1 (mobile-only) — hero copy gap.** Hero wrapper `top: isMobile ? '8%' : '12%'` →
  `'16%' : '12%'`. Mobile branch only; desktop `'12%'` untouched.
- **FIX 2 — rooftop geometry rework (Aman chose this over the literal 'top center').** Alpha +
  width analysis of `layer-rooftop.png`: top 0–25% transparent sky, water tank narrow on the LEFT
  (≈8–22% wide) at y≈25–60%, full-width flat roof solid at y≈60–100%, no bottom padding. `'top
  center'` would anchor the empty top and crop the roof off → invisible rooftop (Session-37 bug),
  and no short cover-window can hold both the tank and the flat roof (~45% apart). Reworked to
  NATURAL aspect: `width:100%, height:'auto', bottom:'-14px'` (objectFit/objectPosition removed),
  so the whole rooftop renders full-width with the flat surface flush at the bottom and the
  transparent top overlapping the skyline. Rooftop scroll parallax `yPercent:-26` → `y:-12`
  (bounded px) so the tall element's bottom can't lift off mid-pull-back. **Trade-off flagged:**
  the flat roof band is now taller than the old 16vh — "full width + visible tank + thin roof" is
  impossible for this asset; accepted per the chosen rework, tunable via a maxWidth cap.
- **FIX 3 — bottom seam.** PNG opaque to its last row (no transparent padding — brief's theory
  disproven); `bottom:'-14px'` + bounded parallax seat the roof flush past the viewport bottom.
- **FIX 4 — constellation scatter (both breakpoints).** `CONST_ITEMS` redefined with organic,
  varied positions clear of the TopBar logo/Begin corners (airplane moved out from behind Begin →
  top12%/right6%), the hero text zone, and the skyline; stethoscope moved to the RIGHT margin to
  clear FIX 2's now-raised left-side water tank. Mobile values tuned independently (top strip above
  the ~92%-wide mobile hero).
- **FIX 5 — scroll-limbo square outline.** No painted border/outline/box-shadow anywhere on the
  chain (all `'none'`), so it's a GPU compositing edge during the `.js-cam` scale. Added pure
  compositing hints to `.js-cam`: `backfaceVisibility:'hidden'`, `transformStyle:'flat'`,
  `isolation:'isolate'`. Resting + full-pull-back appearance unchanged; no locked value touched.

**Verification note:** the GSAP-pinned Scene 1 is not screenshot-able in the headless preview
(0×0 viewport — documented since Session 30+), so the rooftop rework's exact on-screen proportions
and the scroll-transition outline artifact should be eyeballed by Aman in a real browser; values
are isolated and easy to tune.

### Session 40 — Landing Scene 1: skyline "hard top-cut" line — root cause found & fixed (2026-06-19)

**Only `frontend/src/pages/Landing.jsx` changed — far/mid/near `objectPosition` `50% 100%` →
`50% 30%`, nothing else. `npm run build` → 491 modules, 0 errors. `.js-city` sizing, the
per-layer filters, the masks, the rooftop layer, and the student/shadow were left UNTOUCHED.**

Fresh diagnosis after Aman confirmed two prior mask-widenings did NOT remove the cut (so it was
not a mask problem). Section A worked top-to-bottom with hard evidence:

- **Point 1 (parent clipping) — RULED OUT.** Live ancestor `overflow` chain: SkylineLayers
  `visible`, `.js-city` `visible`, `.js-cam` `visible`, `.scene-1` `hidden` (the pin →
  `position:fixed`, clip box = viewport, top edge `y=0`). But the skyline's masked top measures
  `y≈177` (scale 1.82) / `y≈432` (rest) — never at `y=0`, so no clip boundary coincides with the
  cut.
- **Point 2 (background seam) — RULED OUT.** `.js-city` / `.js-cam` / SkylineLayers / `.scene-1`
  all computed `background-color: rgba(0,0,0,0)`; only `.page-serif` (gradient) and `<body>`
  (`#04061A`) paint. No container draws a rectangle edge.
- **Point 3 (sub-pixel artifact) — not the cause** (would shift on resize; mask-% changes would
  have moved it).
- **Point 4 (mask vs photo contrast) — CONFIRMED, precise mechanism.** `object-fit:cover` makes
  each 1536×1024 PNG render ~960px tall at 1440px wide, but `.js-city` is only 52vh (~468px). With
  `object-position:50% 100%` (bottom center) only the bottom ~49% of the source shows; the top
  ~51% is cropped. Pillow alpha bands: the jagged roofline (the natural silhouette) sits at source
  y = 21% (near) / 29.5% (mid) / 38.9% (far) — ALL inside the cropped-off top. So the roofline was
  never visible and the layer's top edge was solid building mass (≥98% opaque; pixels are very
  dark, RGB ~2–29 ≈ page colour). The mask was feathering a hard-topped solid block with no
  silhouette / no transparent sky in its window — exactly why widening it twice did nothing.

- **FIX:** shifted the visible window up — far/mid/near `objectPosition` → `50% 30%` — so each
  layer's transparent sky + jagged roofline land inside the masked fade zone and the mask now
  dissolves a real sky→silhouette→buildings transition. Building mass still fills the lower half,
  so this is NOT the Session-34 `top center` regression that emptied near/mid. Rooftop stays
  `50% 100%` (it is the foreground surface, carries no mask). Section C (bottom-crop + nudge)
  evaluated but not used — it would only relocate the same solid-block edge, not restore the
  silhouette. Section D: mobile checked independently — narrow mobile's `cover` is height-driven
  so the full roofline already shows (30% is a no-op there); wide-mobile is width-driven and
  benefits like desktop. Both verified edge-free.
- **Verified:** build clean; live computed `object-position: 50% 30%` on far/mid/near (rooftop
  `50% 100%`), masks intact, 0 console errors. Isolated-clone full-width screenshots (brightness-
  boosted to reveal the dim skyline) show `50% 100%` = a solid foreground block (the cut) vs
  `50% 30%` = the full jagged skyline dissolving into the sky with no line, on both desktop (52vh)
  and mobile (40vh). The GSAP-pinned Scene 1 itself isn't screenshot-able headless (documented
  limitation); the clone replicates the exact cover/objectPosition/mask/container geometry.

### Session 39 — Scene 2 figure: 4th real-asset attempt (proportion math + symmetry + CSS-filter colour) — ATTEMPTED, REJECTED; hand-traced figure stays ACTIVE (2026-06-19)

**Scope: Scene 2 only. NO code changed in `frontend/src/pages/Landing.jsx` — the active figure
remains `StudentFigureTraced` (Session 36). `npm run build` → 0 errors (still 491 modules).**

The brief asked for a 4th attempt at compositing the 15 `/assets/figures/animated/*.svg` part
files, this time using anatomical-reference proportions (head 13 / torso 30 / thigh 24 … per 100
height) instead of naive viewBox-ratio scaling, left/right aspect-ratio averaging for true mirror
symmetry, and per-part CSS `filter` recolouring for hair/shirt/skin/trouser separation. This was
the most sophisticated approach proposed yet and was taken seriously.

**Decisive new diagnostic — I actually RASTERISED the parts (qlmanage) and the reference and
looked at them**, which no prior session did. This surfaced facts that invalidate the brief's core
premise that "viewBox dimensions = part bounds" and that the limb pairs are mirror twins:

- **The drawn content does NOT fill the viewBoxes.** `head.svg` (217×265) draws the head in only
  the top-left ~half of its box; the rest is empty. `torso.svg` (218×237) fills only the left ~55%.
  Every part is a small silhouette floating at an arbitrary offset inside an oversized, inconsistently
  padded box. Scaling the *box* to an anatomical proportion therefore renders the *content* at the
  wrong effective size and wrong position — the proportion math operates on padding, not anatomy.
- **A part is mislabeled/mis-traced:** `left-forearm.svg` actually renders an **open hand**, not a
  forearm. The exports cannot be trusted by filename.
- **The head faces the WRONG way** (right) vs the reference (left), and `head.svg` includes a
  neck/shoulder stub — it is not a clean isolatable head, so it cannot butt cleanly against a torso.
- **Limb pairs are different poses, not mirrors:** `left-thigh` (44×125) is a narrow vertical blob;
  `right-thigh` (88×154) is a wide blob. `left-forearm` (94×78, a hand) vs `right-forearm` (87×164,
  a vertical limb) — different content entirely. Averaging the aspect ratios normalises a bounding
  box but distorts the actual silhouettes; it cannot reconcile genuinely different poses/content.
- **All 15 share one flat `#2b2856`** and are jagged auto-traces. CSS filters can re-hue them, but
  re-hueing jagged mono blobs that float in empty boxes and face the wrong way does not yield a
  coherent figure.

**Verdict (honouring the brief's explicit honesty clause): the 4th attempt cannot beat the current
figure, so the current figure stays live and Landing.jsx is unchanged.** The defects are intrinsic
to the traced source art (floating content, mislabeled/mismatched parts, wrong facing, mono fill)
and can only be fixed by redrawing the assets — which is exactly what the **active**
`StudentFigureTraced` already is: clean hand-authored cubic-bezier geometry purpose-built to match
`student-design-sheet.jpg` (correct left-facing profile, riggable nested joints, per-part colour:
tee `#6a60a4`, trousers `#262350`, hair `#211e44`, skin `#8378b6`). This is the same conclusion
Sessions 29 and 32 reached for the compositing approach, now confirmed with direct visual evidence.

- **ACTIVE figure: `StudentFigureTraced`** (rendered in `.js-lone`, `Landing.jsx:1454`), driven by
  the unchanged `tl2` rig (`#sc2-body` −58 / svgOrigin `108 248`; `#sc2-arm` 146 / `90 150`;
  `#sc2-fore` 104 / `92 206`). No changes to scenes, rig, timing, or any other code.
- **`npm run build`** → 0 errors. No files modified except these two docs.

### Session 38 — Landing Scene 1: preview-vs-real-browser parity (2026-06-19)

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 491 modules, 0 errors.**
The dev-tool preview rendered Scene 1 correctly; a real browser differed in size, placement,
top-edge dissolve, and showed a flat tint rectangle. Made the real browser match the preview.

- **A/B — root cause of the size/placement mismatch: `maxHeight` cap × `vh`.** `.js-city` was
  `height:52vh, maxHeight:480px`; `52vh === 480px` at viewport height 923px. The preview renders in
  a SHORT fixed internal viewport (~800px) so `52vh ≈ 416px` stays under the cap and the vh value
  governs (52% of viewport — the approved look). A real browser on a taller window (>923px — 1080p
  or any tall monitor) makes `52vh` exceed 480px, so the cap clamps the skyline to a fixed 480px
  (~44% of viewport, less on taller screens) → it renders proportionally smaller and lower while
  the vh-based student/shadow keep scaling → placement drifts. Rooftop had the same trap
  (`16vh, maxHeight:150px`). **FIX = vh-only:** removed BOTH caps (`.js-city` `52vh`/mobile `40vh`;
  rooftop `16vh`), so the skyline holds a constant viewport fraction at every window size and
  matches the preview's proportions. Student (7vh) + shadow (6vh) already vh-based → stay in register.
- **C — blue tint moved from overlay div to per-image filters.** Deleted the `mixBlendMode:'color'`
  overlay div (rendered as a flat tint rectangle in a real browser). Baked the grade into each
  layer filter: far `brightness(0.42) saturate(0.6) hue-rotate(8deg) sepia(0.06)`, mid
  `brightness(0.58) saturate(0.72) hue-rotate(8deg) sepia(0.05)`, near `brightness(0.72)
  saturate(0.85) hue-rotate(8deg) sepia(0.04)`, rooftop `brightness(0.8) hue-rotate(8deg)
  sepia(0.04)`.
- **D — softer top dissolve; WebkitMaskImage verified identical to maskImage on all three layers.**
  Pushed the transparent→black stops lower so the fade spans more distance: far `28%→72%` (was
  30/60), mid `18%→62%` (was 20/50), near `10%→52%` (was 10/40).
- **E — Scene 2 crowd fade.** The crowd `<svg>` (`<CrowdBackground />`) had no class, so it was the
  one Scene-2 element absent from the 0.78 fade-out (which covered `.js-copy2`, `.js-lone`,
  `.js-dim-const`). Added `.js-crowd` to that svg and appended it to the same tween at 0.78,
  ease `none`, duration 0.22.
- **Verified (live browser computed styles):** all 4 filters as above, `maskImage`===
  `WebkitMaskImage` on the masked layers, `.js-city` computed `max-height:none`, 0 overlay divs
  with `mixBlendMode:color`, `.js-crowd` present, 4 PNGs load (naturalWidth 1536), 0 console errors.

### Session 37 — Landing skyline correction: restore 3 layers, blue tint, Scene 2 fade-out (2026-06-19)

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 491 modules, 0 errors.**
A correction of Session 34's over-applied "cap skyline at 50vh" change — not a redesign.

- **SECTION A/B — root cause of the vanished near/mid layers: `objectPosition:'top center'`
  (data-proven).** Alpha analysis of the four 1536×1024 skyline PNGs (Pillow, per-10%-band
  opacity) showed the transparent SKY is the TOP ~40–50% of every frame and the solid BUILDINGS
  are the BOTTOM 50–60% (far `[0,0,0,2,29,98,100,100,100,100]`, near `[0,0,10,49,100,…]`, rooftop
  opaque only in its bottom ~40%). Session 34 set `objectPosition:'top center'` on far/mid/near
  (its stated rationale — "keep building tops, crop from the bottom" — was wrong for these
  assets): with `height:100%`+`objectFit:cover` in a short container it anchored the TRANSPARENT
  sky into view and cropped the buildings off the bottom → near/mid rendered empty/transparent,
  with only a faint far sliver. The other two hypotheses were ruled out: brightness filters were
  intact (far 0.42/0.6, mid 0.58/0.72, near 0.72/0.85 — still differentiated) and the layers had
  `height:'100%'` (not collapsing to 0). **FIX: `objectPosition:'bottom center'` on all four
  layers** (the value used pre-Session-34) — building mass anchors to the container bottom, the
  jagged roofline sits at the top where the mask gradient dissolves it into the sky. Rooftop also
  corrected to `'bottom center'` (its opaque surface is in the PNG's bottom ~40%; `'top center'`
  showed its transparent top → an invisible rooftop). **NOTE: the brief specified `'top center'`,
  but the alpha data proves that keeps the bug, so `'bottom center'` was used instead and flagged.**
  Container `.js-city` raised to `height:'52vh', maxHeight:'480px'` (desktop; mobile unchanged at
  40vh/360px), `overflow:'visible'` retained. Masks unchanged (far `0%/30%→60%`, mid `0%/20%→50%`,
  near `0%/10%→40%`). Parallax verified (far −4, mid −10, near −18, rooftop −26).

- **SECTION C — unified blue colour grade.** Added ONE overlay div inside `.js-city` (sibling to
  the layers, `zIndex:5` above rooftop's z4): `position:absolute, inset:0`,
  `background:linear-gradient(180deg, rgba(70,90,180,0.16) 0%, rgba(40,60,140,0.22) 100%)`,
  `mixBlendMode:'color'`, `pointerEvents:'none'`. `mixBlendMode:'color'` tints all four layers
  toward one cool blue hue while preserving each layer's own luminance/contrast, so the
  depth-via-brightness from Section B is untouched. Alpha **0.16 → 0.22** (within the 0.12–0.28
  range); hue in the --violet blue-violet family.

- **SECTION D — stray blue box: none found.** Searched `Landing.jsx`, `AppShell.jsx` (Landing is
  a standalone public route, NOT wrapped in AppShell), `index.html`, `index.css`, and
  `tokens.css`. Every scene background is `transparent`, soft gradient, or `'none'`; the starfield
  and student canvases are transparent. NO separate solid blue/teal rectangle exists. The prior
  "solid colour block" artifacts were already removed in Sessions 26/29 (the old `.js-rooftop`
  overlay). The only solid colour that could appear at the page bottom is the intentional global
  `body { background-color: var(--void) }` (#04061A) — covered by the `.page-serif` gradient +
  fixed starfield, so it doesn't show. Most likely the screenshot's "blue box" was the dim,
  near-uniform band produced by the Section-A cropping bug itself (the masked-opaque bottom of a
  brightness-dimmed layer), which the Section-A fix resolves. Nothing was deleted.

- **SECTION E — Scene 2 had NO fade-out tween (confirmed) → added one.** `tl2` (the pinned scene-2
  scrub) only faded copy IN, dimmed constellations, folded the figure, and faded the hint star IN;
  it never faded scene-2 content out, so when the pin released the scene simply stopped being
  visible with no overlap region — hence "still no transition between Scene 2 and Scene 3" (a
  different problem from Session 34's Scene-3 *exit* fix). FIX: appended three `.to(..., autoAlpha:0,
  ease:'none', duration:0.22)` tweens at position 0.78 of `tl2` for `.js-copy2`, `.js-lone` (the
  figure + its child hint star), and `.js-dim-const` — they fade out over the last quarter of the
  pinned scrub, overlapping Scene 3's existing scrub fade-in (`.js-scene3-content`, start 'top 80%')
  for a smooth cross-fade.

- **Verified:** `npm run build` → 491 modules, 0 errors. Vite preview DOM: all 4 PNGs load
  (naturalWidth 1536), `objectPosition` computed `50% 100%` (bottom center) on every layer,
  brightness filters intact, tint overlay present (mixBlendMode `color`, z5, correct blue
  gradient), zero console errors. (Headless preview reports a 0×0 viewport — the documented
  limitation — so rendered pixel heights and screenshots of the GSAP-pinned Scene 1 aren't
  meaningful; structural verification is via the DOM, consistent with prior sessions.)

### Session 36 — Scene 2 figure: third-attempt hand-traced rebuild, NOW ACTIVE (2026-06-19)

**Scope: Scene 2 only. `frontend/src/pages/Landing.jsx` only. `npm run build` → 491 modules,
0 errors. The new figure is now the ACTIVE Scene 2 figure — the first Scene-2-figure attempt
that beat the inline `StudentFigureSVG` and replaced it.**

- **Technique (genuinely different from the two prior attempts).** Attempt 1 = inline-generated
  primitives (`StudentFigureSVG`, active Sessions 29–35, acceptable but generic). Attempt 2 =
  compositing the separate `/assets/figures/animated/*.svg` part files (rejected twice, Sessions
  29 & 32, for intrinsic scale/colour mismatch — bobblehead head≈torso, flat monochrome fill,
  occluded near arm). Attempt 3 (this session) = DIRECTLY hand-trace new cubic-bezier path
  geometry against `student-design-sheet.jpg`, as ONE coherent SVG sharing a single coordinate
  system (viewBox `0 0 200 470`) with internal `<g>` joint groups. Single shared coordinate
  system = no scale mismatch (the flaw that killed Attempt 2); hand-authored beziers = closer to
  the reference than Attempt 1's primitives.

- **`StudentFigureTraced` (new component in Landing.jsx)** now renders in `.js-lone`
  (`<StudentFigureSVG />` → `<StudentFigureTraced />`). The old `StudentFigureSVG` is left in the
  file as a documented fallback (consistent with `Scene2FigureFallback.jsx`). Reference-faithful
  details vs the old figure: a true side-profile face (forehead → nose bump → lips → chin → jaw →
  back-of-skull beziers, not circle + triangle nose), messy tufted hair, rounded shoulders + tee
  volume, and **full-length navy trousers down to bare feet** (reference wears trousers; the old
  figure used shorts + thin stick legs with a knee seam). On-brand palette: tee `#6a60a4`,
  trousers `#262350`, hair `#211e44`, skin `#8378b6`. ONE arm (far arm implied behind the torso).

- **Rig (proven, nested SVG groups — most robust version yet).** `#sc2-legs` static lower body;
  `#sc2-body` folds at the hips; `#sc2-head` + `#sc2-arm` + nested `#sc2-fore` are children that
  inherit the fold automatically, so no joint can detach at any scrub value. The arm now hangs at
  the FRONT of the body, so its pivots moved (shoulder `106 150 → 90 150`, elbow `106 206 → 92
  206`) and the rotations were re-tuned so the hand reaches the FACE in the folded pose
  (`#sc2-arm` `132 → 146`, `#sc2-fore` `54 → 104`). Body fold unchanged (`-58` about `108 248`).
  `tl2` structure / timing / eases / ScrollTrigger pin+scrub otherwise identical to the proven rig.

- **Verified (Vite preview, isolated-clone method).** Rest pose = coherent upright side-profile
  student (matches the reference's left figure). Folded pose (rendered by applying the exact rig
  rotations as nested SVG `transform` attributes — composes identically to the GSAP rig) = torso
  curved forward, head dropped, hand covering the face (matches the reference's right figure), zero
  disconnection. Side-by-side vs the old inline figure: the new figure is clearly better (head
  proportion, continuous trousers vs stick-leg knee seam, arm reads as an arm vs a chest panel).
  Per the brief's honesty clause, kept ACTIVE because it is clearly better.

### Session 35 — Google OAuth end-to-end wiring (2026-06-19)

**`oauth.py`, `config.py`, `frontend/src/pages/GoogleAuthSuccess.jsx` (new),
`frontend/src/App.jsx`, `frontend/src/pages/auth/Login.jsx`,
`frontend/src/pages/auth/Register.jsx`, `frontend/src/pages/auth/GoogleButton.jsx` (new).
`npm run build` → 491 modules, 0 errors (was 489; +2 for GoogleAuthSuccess + GoogleButton).**

**WHAT EXISTED:** `oauth.py` was a complete stub wired into `api.py` via `app.include_router`.
`/auth/google` already redirected to Google consent correctly. `/auth/google/callback` already
exchanged the code, fetched the user profile, upserted the student (find-or-create by email,
`is_verified=TRUE`, `password_hash=NULL`), and issued Starship JWTs — but returned JSON instead
of redirecting to the frontend. `FRONTEND_URL` was also absent from `config.py`.

**CHANGES:**

- **`config.py`** — four new env vars loaded from `.env`:
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
  (default `http://localhost:8000/auth/google/callback`), `FRONTEND_URL`
  (default `http://localhost:5173`).

- **`oauth.py`** — added `FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")`.
  Changed the callback's final return from a JSON dict to:
  `RedirectResponse(f"{FRONTEND_URL}/auth/google/success?token={access_token}&refresh={refresh_token}")`.
  Error paths (token exchange failure, userinfo failure, no email) now also redirect to
  `{FRONTEND_URL}/login?error=<reason>` instead of returning JSON 502/400 — safe for the
  browser-navigation flow.

- **`frontend/src/pages/GoogleAuthSuccess.jsx` (new)** — public page at `/auth/google/success`.
  Reads `token` + `refresh` from URL search params. If no token: `navigate('/login', {replace})`.
  Otherwise: calls `setTokens({ access, refresh })` synchronously, then `login({ access, refresh })`
  (fetches `/profile`), then routes to `/dashboard` if `student.has_completed_assessment`, else
  `/onboarding`. Shows "Signing you in…" loading text while the async work completes.

- **`frontend/src/App.jsx`** — imported `GoogleAuthSuccess` and added
  `{ path: '/auth/google/success', element: <GoogleAuthSuccess /> }` as a public route (alongside
  `/login`, `/register`, etc.).

- **`frontend/src/pages/auth/GoogleButton.jsx` (new)** — shared component used by both Login and
  Register. Renders an "or" divider (hairline with centred "or" label in `--text-secondary`) +
  a full-width white button ("Continue with Google") with the standard 4-colour Google G SVG icon
  (24×24 viewBox, `#4285F4`/`#34A853`/`#FBBC05`/`#EA4335`). On click:
  `window.location.href = \`${apiBaseUrl}/auth/google\``. Hover: `opacity: 0.88`.

- **`frontend/src/pages/auth/Login.jsx`** — imports `API_BASE_URL` + `GoogleButton`; renders
  `<GoogleButton apiBaseUrl={API_BASE_URL} />` below the `<SubmitButton>` (outside the `<form>`).

- **`frontend/src/pages/auth/Register.jsx`** — same pattern as Login.

**Required `.env` additions:**
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
FRONTEND_URL=http://localhost:5173
```
For production: update `GOOGLE_REDIRECT_URI` to `https://starship-api.onrender.com/auth/google/callback`
and `FRONTEND_URL` to `https://your-vercel-domain.vercel.app`. Also add both redirect URIs to the
Google Cloud Console → Credentials → Authorized redirect URIs.

**Verified:** build clean (491 modules); DOM snapshot confirms "Continue with Google" button + "or"
divider present on both `/login` and `/register`; `/auth/google/success` route resolves without
error (no-token guard redirects correctly); zero console errors post-reload.

### Session 34 — Landing skyline scale + Scene 3 scrub fade-out fix (2026-06-19)

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 489 modules, 0 errors.**

Three surgical fixes. Skyline positioning, stacking, mask gradients, brightness, and all
parallax values are unchanged — only scale + objectPosition + the Scene 3 exit tween changed.

- **SECTION A — Skyline visual height capped at ≤50vh.**
  Root cause: far/mid/near used `height:'auto'` + `overflow:visible`. A 1536×1024 PNG at
  100% width on a 1440px screen renders at ~960px tall — the `30vh` container was irrelevant
  because the images escaped upward. Fix: container `height:'46vh' maxHeight:'420px'`
  (mobile `40vh/360px`); far/mid/near images `height:'100%' objectPosition:'top center'`.
  `top center` keeps the source TOP (sky + building tops) and crops from the BOTTOM only —
  building tops are never clipped. The mask gradient continues to dissolve the top edge of
  the rendered element for page blending. Rooftop layer unchanged.

- **SECTION B — Bottom anchoring verified; no offsets found.**
  All layers already had `bottom:0, left:0`. Switching to `height:'100%'` eliminates the
  gap the `height:auto` parallax motion introduced at the bottom edge.

- **SECTION C — Scene 3 abrupt disappear: root cause was `gsap.to()` capturing `opacity:0`
  as its from state at creation time** (the entrance `fromTo` immediately applies `opacity:0`
  at init, and the exit `to()` reads that as its own starting value, making it a no-op:
  `0→0`). Fix: exit tween changed to `gsap.fromTo('.js-scene3-content', {opacity:1,y:0},
  {opacity:0,y:-40,...,scrub:true})`. The explicit from state is applied at scrub progress=0
  (not captured at creation time), so the exit always scrubs fully-visible → transparent.

### Session 33 — Deployment configuration (2026-06-19)

**No code deployed. Config files and documentation created so Aman can deploy with minimal steps.
Backend: Render (free tier). Frontend: Vercel. Database: Supabase. `npm run build` → 489 modules, 0 errors.**

- **`requirements.txt` (new):** `fastapi`, `uvicorn[standard]`, `gunicorn`, `psycopg2-binary`,
  `python-dotenv`, `cohere`, `bcrypt`, `PyJWT`, `requests`, `httpx`. Gunicorn required to run
  FastAPI on Render (uvicorn.workers.UvicornWorker).

- **`render.yaml` (new):** Render Blueprint — single `web` service `starship-api`, Python runtime,
  build = `pip install -r requirements.txt`, start = `gunicorn api:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`.
  All 13 env vars listed with `sync: false` (values supplied in Render dashboard, NOT committed to
  the repo): `DATABASE_URL`, `COHERE_API_KEY`, `JWT_SECRET`, `ADMIN_KEY`, `MSG91_AUTH_KEY`,
  `MSG91_SENDER_ID`, `MSG91_TEMPLATE_ID`, `RESEND_API_KEY`, `FROM_EMAIL`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `FRONTEND_ORIGINS`.

- **`Procfile` (new):** Heroku-compatible fallback — identical start command.

- **`database.py` (updated):** Added `DATABASE_URL` env var support. If present, connects via
  `psycopg2.connect(DATABASE_URL, sslmode="require")` (Supabase requires SSL). If absent, falls
  back to the existing `DB_CONFIG` dict (local dev unchanged).

- **`frontend/vercel.json` (new):** `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`.
  Routes all paths to `index.html` so React Router client-side routing works on Vercel.

- **`frontend/.env.production` (new):** `VITE_API_BASE_URL=https://starship-api.onrender.com`.
  Aman should update this URL once the Render service is created. Does not affect local dev
  (Vite uses `.env` / `.env.local` for dev).

- **`docs/DEPLOY.md` (new):** Step-by-step deployment guide:
  1. Supabase DB setup (create project, run schema.sql + 6 migrations, copy DATABASE_URL)
  2. Render backend (connect GitHub repo, add 13 env vars, deploy)
  3. Vercel frontend (connect repo, set root = `frontend/`, set `VITE_API_BASE_URL`)
  4. Post-deploy checklist (health, register+OTP, assessment, results, counselor)
  5. Custom domain setup (links to Render/Vercel docs)
  6. Updating `GOOGLE_REDIRECT_URI`, `FRONTEND_ORIGINS`, and Google Console for production URLs.

**Free-tier note:** Render free services cold-start (~30s after 15 min idle). Upgrade to $7/month
to keep the API always warm for a real user base.

### Session 32 — Scene 2 figure: real-asset rebuild attempted, fallback kept active (2026-06-18)

**Scope: Scene 2 only. No other scene touched. `npm run build` → 489 modules, 0 errors.**

**Outcome: the inline-generated figure (`StudentFigureSVG` in `Landing.jsx`) REMAINS the
active Scene 2 figure. A standalone copy of it now exists as a saved alternative; the
real-asset (`/assets/figures/animated/*.svg`) rebuild was genuinely attempted, rendered,
and rejected as visibly worse — same conclusion Session 29 reached.**

- **STEP 1 — fallback preserved.** `frontend/src/components/Scene2FigureFallback.jsx` (new):
  a self-contained, byte-faithful copy of the working inline figure + its proven nested rig
  (`#sc2fb-body` folds at the hips, `#sc2fb-arm` child at the shoulder, `#sc2fb-fore` child at
  the elbow). Sets up its OWN `gsap.matchMedia` (desktop + no-reduced-motion) ScrollTrigger
  (pin + scrub) on its root, or against an optional `triggerRef`, using the exact tl2 values
  (`#…-body` rot −58 / svgOrigin `108 248`; `#…-arm` rot 132 / `106 150`; `#…-fore` rot 54 /
  `106 206`). **NOT imported/rendered anywhere** — saved reference only (header comment marks it).
- **STEP 2 — viewBox audit** of all 15 part files. Key fact: `head.svg` viewBox is **217×265**,
  essentially the same size as `torso.svg` **218×237** — so any faithful scaling renders the
  head ≈ as large as the torso (bobblehead).
- **STEP 3 — scale factors.** Uniform factor `k = 180/237 = 0.7595` (torso height 237 → 180px),
  each part = viewBox × k, native aspect preserved. (head → 164.8×201.3px, i.e. **taller than
  the 165.6×180px torso** — the proportion problem made concrete.)
- **STEP 4 — genuine assembly attempt.** Built a temporary `Scene2FigureReal` (real `<img>`
  parts, computed sizes, nested `#sc2-body`→`#sc2-arm`→`#sc2-fore` div rig, transformOrigin
  joints, plus a brightening filter just to make them visible), wired it into Scene 2, and
  rendered it in the Vite preview.
- **STEP 5 — verdict: real-asset version is clearly worse; reverted.** Rendered at-rest it
  showed: (1) **bobblehead** head≈torso proportions (per the viewBox data); (2) a **flat
  monochrome silhouette** — every part shares one fill `#2b2856`, so there is no skin/shirt/
  shorts/hair separation the inline figure has; (3) the **near arm fully occluded** behind the
  torso (the "hand to face" animation would have nothing to animate); (4) a **visible knee
  seam** from inconsistent limb trace scales (left limbs traced horizontal/foreshortened, right
  limbs vertical). These are intrinsic to the traced exports and can't be fixed without
  redesigning the SVGs (out of scope). Reverted Scene 2 to `StudentFigureSVG`; deleted the temp
  `Scene2FigureReal.jsx`. Confirmed in-preview the clean inline figure is back (legible
  side-profile student, multi-tone shading, on-brand violet).
- **Active = inline `StudentFigureSVG` (== `Scene2FigureFallback.jsx`). Alternative on disk =
  `Scene2FigureFallback.jsx` (the same figure as an importable standalone).** The real-asset
  approach is documented as not viable with the current part files.

### Session 31 — Landing skyline hard-cut + rooftop + Scene 2 bg + Scene 3 transition (2026-06-18)

**Four scoped fixes to `frontend/src/pages/Landing.jsx`. `npm run build` → 489 modules,
0 errors. Verified in the Vite preview via DOM inspection (all four skyline PNGs load,
masks applied, no clip wrappers, zero console errors).**

- **A — skyline hard-cut line (root cause + fix).** The far/mid/near layers were each
  wrapped in an `overflow:hidden` div (`inset:0`) holding a `height:130%` `<img>`, and
  **no `maskImage`/`WebkitMaskImage` existed anywhere in the file** (Session 29 dropped the
  masks Sessions 24/26 had). The `overflow:hidden` wrapper hard-clipped each image at the
  wrapper's top edge — *that clip was the hard horizontal cut*. FIX: removed the
  `overflow:hidden` wrappers entirely; the far/mid/near `<img>`s are now rendered directly
  (`position:absolute, bottom:0, width:100%, height:auto, objectFit:cover, objectPosition:
  bottom center`) with a **per-layer mask gradient** that dissolves the top of the PNG into
  transparency — `far` `transparent 0%/30% → black 60%`, `mid` `0%/20% → 50%`, `near`
  `0%/10% → 40%` — and `WebkitMaskImage` set identically alongside each. Depth via
  brightness/saturate: far `0.42/0.6`, mid `0.58/0.72`, near `0.72/0.85`. `.js-city`
  container lowered to `height:30vh / maxHeight:280px` (mobile 26vh/240px), `overflow:visible`.
  Independent scroll parallax retained (far −4, mid −10, near −18, rooftop −26) + cursor
  parallax on the img refs. (DOM-verified: 0 `overflow:hidden` wrappers, masks present on
  all three, naturalWidth 1536 on all four PNGs.)
- **B — rooftop full-width, cropped from the bottom.** Was `objectFit:contain` +
  `maxHeight:22vh` → letterboxed to a small element. FIX: `width:100%, height:16vh,
  maxHeight:150px, objectFit:cover, objectPosition:'top center', zIndex:4` — full viewport
  width always, height reduced by **cropping the bottom** of the source (top center keeps the
  water-tank/rooftop-surface detail at the top of the PNG). `display:none` → `onLoad`
  `block` robustness kept.
- **C — Scene 2 background continuity.** The `<section>` was already `background:'transparent'`,
  but a heavy `linear-gradient(...rgba(6,7,26,0.88)...)` overlay darkened it and hid the
  starfield — the perceived "darker override". FIX: replaced with a **very subtle dark
  vignette** `radial-gradient(120% 80% at 50% 55%, transparent 50%, rgba(4,6,26,0.18) 100%)`
  — clear centre, low opacity, so the single root gradient + fixed starfield show through
  for continuity with scenes 1 and 3.
- **D — Scene 3 snap/disappear transition.** Previous mechanism: a **pinned** ScrollTrigger
  timeline (`tl3`, `pin:true, end:'+=90%', scrub:1`) whose only tween faded `.js-copy3` IN
  once near the start — with **no fade-out**, so the pin released and the scene snapped away
  (and the pin-spacer left a dead-zone before Scene 4). FIX: removed the pin entirely; Scene 3
  now uses the **identical continuous-scrub pattern as scenes 4–6** — the `.scene-3` y-parallax
  plus a scrub fade-IN on `.js-scene3-content` (`opacity 0→1, y 40→0`, `start 'top 80%' end
  'top 30%'`) and a scrub fade-OUT (`opacity 1→0, y 0→-40`, `start 'bottom 70%' end 'bottom
  20%'`). Fades in as it enters, fades out as it leaves — no pin, no snap, no dead-zone.

### Session 30 — Landing structural fix: one continuous background + smooth scroll (2026-06-18)

**Five scoped fixes to `frontend/src/pages/Landing.jsx` (+ `playDust` in
`SoundManager.jsx`). `StarfieldCanvas.jsx` was NOT changed. `npm run build` →
489 modules, 0 errors.**

- **A — one continuous background.** The starfield was a child of `.js-cam` (Scene 1
  only) and each scene painted its own solid colour — the cause of "scenes look cut
  off" / "starfield only on hero". Now: a single `position:fixed` full-viewport
  `StarfieldCanvas` sits behind every scene as a direct child of the outermost
  `.page-serif` wrapper (`zIndex:0`); the dark-navy gradient lives **once** on that
  wrapper (`linear-gradient(to bottom, #04061A 0%, #06071A 50%, #0F0E2A 100%)` — the
  established `--void` / Scene-2 navy / `--deep` values, not invented); and scenes 2–6
  are `background:'transparent'` (Scene 1 already was) so the gradient + fixed
  starfield show through with zero colour cuts.
- **B — smooth scroll, scenes 3→6.** Removed the Framer `Reveal` (`whileInView`)
  component + the `framer-motion` import from Landing. Scenes 4/5/6 content now uses a
  plain `ScrollReveal` wrapper (`.js-scroll-reveal`) driven by GSAP ScrollTrigger
  **`scrub:true`** (`fromTo {opacity:0,y:40}→{opacity:1,y:0}`, `start 'top 80%'`,
  `end 'top 30%'`), gated to desktop+no-reduced-motion. Continuous scroll-linked
  motion instead of IntersectionObserver snaps.
- **C — Scene 1 skyline proportions.** Rooftop PNG constrained to
  `maxHeight:'22vh'` + `objectFit:'contain'` + `objectPosition:'bottom center'`;
  `.js-city` (far/mid/near skyline) raised to `height:'34vh'` (mobile 28vh) so the
  city is the dominant context above/behind the rooftop. Z-order far1→mid2→near3→
  rooftop4 unchanged. Student stays at `bottom:7vh`, within the 22vh rooftop.
- **D — dust sound.** (1) False triggering fixed: replaced the wrapper `onMouseMove`
  with a window proximity test that measures the figure's real (camera-scaled) box via
  `getBoundingClientRect()` on `.js-seated` and only fires within **70px**
  (`DUST_RADIUS`), 200ms throttle kept. (2) Timbre fixed in `SoundManager.playDust()`:
  was a 180Hz sine→lowpass "thunk"; now a ~70ms white-noise burst through a
  highpass(2kHz)+bandpass(5kHz,Q0.7) — airy "shh", peak ~0.05, 2ms attack/50ms decay.
- **E — constellations.** Repositioned all five into the upper sky only (top 2–24% /
  side margins); removed labels entirely (span + `label` data + all label tweens); and
  fixed the line-draw exit bug by tagging every connector (`<line>`/`<circle>`/`<path>`/
  `<polyline>`) with a **`.connect-line`** class at injection and selecting/killing by
  that class — so circular connectors revert on exit like straight ones.
- **Verified:** build clean (489 modules); in-preview DOM confirmed gradient on
  `.page-serif`, one fixed Landing starfield (the other fixed canvas is the unrelated
  transient `LoadingScreen`), all six scenes transparent, rooftop `maxHeight:22vh /
  objectFit:contain`, 66 `.connect-line` connectors, 0 labels, constellations at
  top 2–24%, 5 `.js-scroll-reveal` blocks, zero console errors. (Headless preview
  reports a 0×0 viewport — a documented limitation — so desktop GSAP pinning geometry
  and screenshots aren't meaningful there; structural verification is via the DOM.)

### Session 29 — Landing comprehensive fix (2026-06-18)

**ROOT CAUSE of the Scene 1 rendering failure (the "solid colour block + tiny rooftop"):**
`SKYLINE_LAYERS` in `Landing.jsx` referenced `layer-far.jpg` / `layer-mid.jpg` / `layer-near.jpg`,
but **every skyline asset on disk is `.png`** (transparent skies, 1536×1024). The three JPG
`<img>`s 404'd, leaving only the legacy dark `.js-rooftop` gradient overlay visible. **All four
srcs are now `.png`** (verified in-browser: all 4 load with `naturalWidth>0`). `npm run build` →
**489 modules, 0 errors.**

- **Scene 1 skyline rebuilt** (`Landing.jsx`): `.js-city` `height:38vh` / `maxHeight:340px`,
  `overflow:visible`, no background/border/shadow. far/mid/near each in an own `overflow:hidden`
  wrapper (`height:130%` + `objectPosition:bottom` → vertical crop from the top, full width);
  rooftop `height:auto` so the water tank is never clipped. Depth via brightness (opacity 1):
  far `0.4/0.65`, mid `0.55/0.75`, near `0.7/0.85`, rooftop `0.8`. Independent scroll parallax
  (`tl1`): far −4, mid −10, near −18, rooftop −26.
- **Scene 1 cleanup + reposition:** removed the `.js-rooftop` dark overlay block + edge line and
  the laptop "book-like rectangle" decoration. Particle student `bottom 18vh→7vh` (shadow →6vh)
  so the taller skyline reads behind it.
- **Scene 2 figure:** the real `/assets/figures/animated/*.svg` parts were traced in inconsistent
  poses/scales (front torso + profile head; mismatched arms; knee gap) and could not be rigged
  (the arm splayed up instead of covering the face — verified in-browser). Fell back (per the
  user) to a **clean inline-SVG side-profile rebuild** (`StudentFigureSVG`) keeping the reference
  details (hair, nose, profile, t-shirt/shorts, bare feet). Nested rig: `#sc2-body` folds at the
  hips, `#sc2-arm` child (shoulder), `#sc2-fore` child (elbow) → hand covers the face, nothing
  detaches. `tl2`: body −58°, arm 132°, forearm 54° (`svgOrigin` pivots).
- **Scene re-map (user-corrected names):** **Discovery (Scene 3)** now shows the **paths** image
  (`scene4-paths.jpg`, padding 1.5rem); **Possibility (Scene 4)** stays image-free (cards + stats
  unchanged); **Hope (Scene 5)** rebuilt as two-column — text-left (HOPE / headline / "Start your
  journey") + **stargazer** image right (`scene3-student-gazing.jpg`) with pulsing glow
  (`.js-scene5-glow`); **Contact** is now its own section (`.scene-6`) with `contact-student.jpg`
  + "Get In Touch" + `hello@projectstarship.in`.
- **Sounds (`SoundManager.jsx` unchanged — already complete & spec-compliant):** traced every
  call site and **added the missing `playClick` wiring** — Landing `CTA` + TopBar "Begin",
  AppShell wordmark/profile/logout, Profile retake. `playChime`/`playDust`/`startWind`/`playWhoosh`/
  `playHover` call sites all verified present.
- **Files:** `frontend/src/pages/Landing.jsx`, `frontend/src/layouts/AppShell.jsx`,
  `frontend/src/pages/Profile.jsx`.

### Session 27 — Real OTP delivery via MSG91 SMS + Resend email (2026-06-15)

**OTP delivery is now real. The hardcoded `"123456"` mock is gone. Backend code only —
no frontend or DB schema changes. All existing OTP validation logic is untouched.**

- **`notifications.py` (new):** Three delivery functions, all return bool, never raise:
  - `send_otp_sms(phone_number, otp)` — MSG91 Flow API (`/api/v5/flow/`). Normalises phone to
    `91XXXXXXXXXX`. Returns True when HTTP 200 + `"type":"success"`. No-op (returns False) when
    `MSG91_AUTH_KEY` or `MSG91_TEMPLATE_ID` are absent.
  - `send_otp_email(email, otp, name="")` — Resend.com (`/emails`). Subject: "Your Starship OTP".
    Returns True on 200/201. No-op when `RESEND_API_KEY` is absent.
  - `send_password_reset_email(email, reset_token, name="")` — Resend.com. Subject: "Reset your
    Starship password". Body includes reset link `https://projectstarship.in/reset-password?token=…`
    where the token is the OTP (verified at `/auth/reset-password`).

- **`config.py`:** Five new env vars loaded from `.env`:
  `MSG91_AUTH_KEY`, `MSG91_SENDER_ID` (default `STRSHP`), `MSG91_TEMPLATE_ID`,
  `RESEND_API_KEY`, `FROM_EMAIL` (default `noreply@projectstarship.in`).

- **`auth.py`:**
  - `generate_otp()`: `str(secrets.randbelow(900000) + 100000)` — real CSPRNG, 100000–999999.
  - New `deliver_otp(phone_number, email, otp, name="")`: SMS first, email fallback. Warns if
    both channels fail, but OTP is already saved to DB so manual verification still works.
  - Imports `send_otp_sms`, `send_otp_email`, `send_password_reset_email` from `notifications`.

- **`api.py`** (4 OTP delivery sites, internals only — no route/response changes):
  - `/auth/register`: `deliver_otp(req.phone_number, req.email, otp)` after DB insert.
  - `/auth/login` (OTP path): SELECT expanded to `email, phone_number`; `deliver_otp(s_phone, s_email, otp)`.
  - `/auth/resend-otp`: SELECT `email, phone_number` for student; `deliver_otp(s_phone, s_email, otp)`.
  - `/auth/forgot-password`: `send_password_reset_email(email, otp)` for email users;
    `send_otp_sms(phone, otp)` for phone-only users.

**Without API keys in `.env`, behaviour is identical to before except the OTP is now random
instead of `"123456"`. The OTP hash is always saved to DB — `SELECT otp_hash FROM students WHERE
student_id = X` lets you decode it for testing (compare with `hashlib.sha256(otp.encode()).hexdigest()`).**

Required `.env` additions (fill in real values):
```
MSG91_AUTH_KEY=your_msg91_auth_key_here
MSG91_SENDER_ID=STRSHP
MSG91_TEMPLATE_ID=your_template_id_here
RESEND_API_KEY=your_resend_api_key_here
FROM_EMAIL=noreply@projectstarship.in
```

### Phase 1 — Bug Fixes (Session 1)
- config.py rewritten to load DB_CONFIG from .env with sane defaults
- Hardcoded DB credentials removed from api.py, score_assessment.py, database.py
- current_class bug fixed: now fetched from students table; stale `current_class = []` deleted
- ai_chat.chat_with_ai() accepts precomputed result; api.py caches engine results (LATEST_RESULTS)
- .env removed from git tracking; .gitignore added

### Phase 2/3 — Database Reconstruction & Backend Stabilization (Session 2)

**AI migration (Part A)**
- Removed all OpenAI and Ollama references from the entire codebase
- AI provider: Cohere (command-r-plus-08-2024) via cohere SDK v5
- ai_chat.py: conversation memory (last 10 exchanges per session); student results injected
  as context on first message; system prompt passed as role="system" message
- ai_extract.py: migrated from OpenAI to Cohere; hardcoded DB creds replaced with config.DB_CONFIG
- config.py: OPENAI_API_KEY replaced with COHERE_API_KEY

**Database audit (Part B)**
- Confirmed current_class is character varying(50) — string comparisons in score_assessment.py correct
- Identified missing FKs: assessment_sessions.student_id, student_question_responses_v2.student_id
- Identified 7 missing indexes on hot query paths
- Identified orphan tables: careers (legacy), qs_rankings, university_rankings, scoring_dimensions,
  traits_v2 (trait_name stored as text in weights table, no FK enforced)

**Schema fixes (Part C)**
- migrations/002_schema_fixes.sql applied successfully
- FK: assessment_sessions → students (ON DELETE CASCADE)
- FK: student_question_responses_v2 → students (ON DELETE CASCADE)
- 7 indexes added: idx_sqr_v2_student_id, idx_sqr_v2_question_id, idx_qtw_v2_question_id,
  idx_universities_name, idx_ufs_field_id, idx_career_profiles_name, idx_assessment_sessions_student_id

**Backend stabilization (Part D — fully complete)**
- Installed: cohere, fastapi, uvicorn, psycopg2-binary, python-dotenv
- Server: python3 -m uvicorn api:app --host 127.0.0.1 --port 8000
- All 7 endpoints verified passing:

| Endpoint           | Method | Status                                    |
|--------------------|--------|-------------------------------------------|
| /                  | GET    | ✅ PASS                                   |
| /questions         | GET    | ✅ PASS — returns all 155 questions       |
| /start-assessment  | POST   | ✅ PASS                                   |
| /submit-answer     | POST   | ✅ PASS                                   |
| /submit-assessment | POST   | ✅ PASS — runs engine, returns results    |
| /career-roadmap    | POST   | ✅ PASS                                   |
| /chat              | POST   | ✅ PASS — Cohere live, reply verified     |

### Phase 4 — Assessment System Validation (Complete)

**4.1 — End-to-end flow test**
- Realistic test student created: Class 12, Rajasthan, 3L budget, 155 questions
- Full /submit-assessment run completed; 6 anomalies identified and documented

**4.2 — Scoring engine audit (6 bugs fixed)**
- Bug 1 FIXED: top_traits used full names vs short codes — trait match always failed;
  aptitude keys wrong (numerical vs numerical_reasoning). Scores now 5,5,3,2,0.
- Bug 2+6 FIXED: confidence thresholds iterated question_counts not normalized_scores —
  aptitude at 65% accuracy labeled "High" AND study_tolerance inverted. Rewritten:
  >=70 High, >=45 Average, <45 Low. Both now correct.
- Bug 3 PARTIAL: university fallback query added (budget+state). Returns [] until
  total_annual_cost_inr populated — blocked on Phase 7 scraping.
- Bug 4 FIXED: deduplication via used_career_names set; careers now in exactly one bucket.
- Bug 5: RIASEC dominant trait comment added explaining short-code and tie-breaking logic.

**4.3 — Data expansion**
- Career profiles: 5 → 25
- Scholarships: 11 → 45 (excluded: Byju's defunct, 3 unverified state schemes)
- Schema gap noted: salary columns + education_path missing from career_profiles — Phase 5
- University costs still NULL for most rows — blocked on Phase 7 scraping

**4.4 — API hardening**
- Global exception handler added; all errors return {"error": "..."}
- Input validation on /start-assessment; question existence check on /submit-answer
- Student existence + session ownership checks on /submit-assessment and /chat
- DRY helpers: get_conn(), student_exists()

**Phase 4 fully complete.**

### Phase 5 — Auth System (Complete)

**5.1 — Registration + Login**
- Email or phone as identifier; password as secondary option
- OTP mocked (always "123456", logs to console) — real SMS/email in Phase 7
- JWT access token (1hr) + refresh token (7 days)
- Students table migration (003_auth.sql): phone_number, email, password_hash,
  otp_hash, otp_expiry, refresh_token, last_login, is_verified

**5.2 — Google OAuth**
- /auth/google + /auth/google/callback implemented via authlib/httpx
- Upserts student record on callback; returns same JWT as email/phone login
- GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET placeholder in .env — wire up in Phase 7

**5.3 — Session protection**
- get_current_student JWT dependency on all protected endpoints
- student_id extracted from JWT — no longer passed as raw parameter
- Protected: /submit-answer, /submit-assessment, /chat, /career-roadmap, /profile
- Public: /, /questions

**5.4 — Account management endpoints**
- /auth/register, /auth/login, /auth/logout, /auth/verify-otp, /auth/resend-otp
- /auth/forgot-password, /auth/reset-password, /auth/refresh
- /profile GET and PATCH

**5.5 — Admin routes**
- /admin/students — ranked shortlist by aptitude + financial need
- /admin/students/{id} — full student profile
- Protected by X-Admin-Key header matching ADMIN_KEY in .env

**Smoke tests: all 13 passing**

**Phase 5 fully complete.**

### Phase 6 — Frontend (Session 6A: shared component library)

**Scaffold (frontend/)**
- New Vite 6 + React 18 + Tailwind v4 (@tailwindcss/vite) + Framer Motion app under
  frontend/ — kept separate from the Python backend at repo root. Node via /opt/homebrew/bin
  (not on the non-interactive shell PATH by default).
- Backend untouched.
- Verified: esbuild transform of every component, framer-motion exports present, barrel
  bundle (all imports resolve), full `npm run build` passes (385 modules).

**Design tokens — frontend/src/styles/tokens.css**
- Full palette (backgrounds, purple/teal ramps, semantic gold/coral, text tiers), gradients,
  RIASEC category colours, bubble-scale colours, typography (system stack, weights 400/500
  only), motion/shape/glow tokens, base styles + utility classes (.starship-gradient-text,
  .starship-caption), reduced-motion safety net.

**API client — frontend/src/api/client.js**
- axios instance; baseURL from .env (VITE_API_BASE_URL); JWT from localStorage injected as
  Bearer on every request; 401 interceptor clears tokens + redirects to /login (loop-guarded).
  Exports setTokens/clearTokens/getAccessToken + TOKEN_KEY/REFRESH_KEY.

**10 shared components — frontend/src/components/ (barrel at index.js)**
- StarfieldCanvas (3-layer parallax canvas), OrbitRing (rotating SVG ellipse),
  CategoryBadge (+RIASEC_COLORS export), ProgressBar (3px top bar), StatCounter (in-view
  count-up), BubbleScale (5-bubble mechanic, +REACTIONS/reactionFor), ReactionToast,
  CareerCard, ScholarshipCard (gold scheme), AIOrb (pulse → spring chat panel).
- All reduced-motion aware via Framer useReducedMotion.
- NO product pages built. App.jsx is a throwaway dev shell (starfield + wordmark) only.

**Open items for 6A**
- ✅ Conventional (C) RIASEC colour (missing from the design doc) confirmed by user:
  --riasec-c-bg #2E5FA3 / --riasec-c-text #A8C4F0.
- ✅ GSAP installed (`gsap`; ScrollTrigger via `gsap/ScrollTrigger`) — resolves cleanly,
  not yet used; to be wired into page scroll storytelling in 6B.
- Temporary /gallery route (frontend/src/Gallery.jsx, switched in App.jsx) renders all 10
  components with mock data for visual verification — remove/replace when 6B pages land.

### Phase 6 — Frontend (Session 6A.1: design refinement + 6B component prep)

**Design refinement (approved direction: warmer, calmer, less "flashy space")**
- Removed OrbitRing entirely (component file, barrel export, all gallery usage).
- Removed gradient text: dropped .starship-gradient-text class + --gradient-text /
  --grad-text-* tokens. Career titles now solid white, match % / StatCounter now
  --stardust, CareerCard match bar now --gradient-brand. StatCounter `gradient` prop
  renamed → `accent`.
- Typography warmth: --font-sans simplified to -apple-system, "Segoe UI",
  "Helvetica Neue", Arial, sans-serif; --lh-body 1.7 → 1.8; new --ls-heading 0.01em
  applied to h1–h4.
- Colour softening (only these three): --violet #534AB7 → #5B52B8,
  --aurora #1D9E75 → #1E9E78, --glow #4DDFBD → #4DD9B8. Backgrounds, RIASEC and
  bubble tokens deliberately unchanged.
- Conventional (C) confirmed in place: --riasec-c-bg #2E5FA3 / --riasec-c-text #A8C4F0
  (tokens.css + CategoryBadge via CSS vars).

**New 6B components — frontend/src/components/ (added to barrel)**
- RIASECRadar (6-axis SVG hexagon; outline draws on via pathLength, vertices tinted
  per RIASEC; accepts a name/letter-keyed object or an R-I-A-S-E-C array).
- UniversityCard (violet scheme: cost + NIRF rank pill + programme tags + View button).
- ConstellationMap (career nodes as a star constellation; normalised 0–1 coords,
  hub-and-spoke links draw on, primary node glows, click-to-select).
- SpotIllustration (inline how-it-works spots: assess / analyze / match / fund / guide).
- Library is now 13 components (OrbitRing removed, 4 added). All reduced-motion aware.
- /gallery updated: OrbitRing section removed; RIASECRadar, ConstellationMap,
  UniversityCard, SpotIllustration added with mock data.
- Verified: `npm run build` passes (399 modules); /gallery renders with zero console
  errors (radar + constellation geometry and draw-on animations confirmed via DOM).

### Phase 6 — Frontend (Session 6B: router + public Landing page)

**Routing**
- react-router-dom v6 installed; BrowserRouter added in main.jsx.
- App.jsx is now a route table: / → Landing, /gallery → component gallery,
  /onboarding + /how-it-works → branded placeholders (real pages pending),
  * → redirect to /.

**Landing page — frontend/src/pages/Landing.jsx (single file)**
- Five scroll "chapters": 1 Rooftop · 2 Pressure · 3 Discovery · 4 Possibility · 5 Hope.
- Motion split (so the two engines never fight over a node): GSAP ScrollTrigger owns
  desktop-only pinning + scrubbed atmosphere (scenes 2 & 3 pinned ~+90% each; scene 4
  sky-expand scrub) plus two ambient loops (seated student's gaze, scroll cue); Framer
  Motion owns entry reveals in scenes 1/4/5. gsap.matchMedia() disables all
  pinning/scrub below 768px and under reduced-motion, so mobile scenes stack vertically.
  gsap.context() scopes the .js-* selectors and reverts everything on unmount.
- Reused untouched: StarfieldCanvas (one fixed shared night sky behind every scene),
  BubbleScale (scene 3 metaphor, disabled), CareerCard ×3, StatCounter (340/180/28),
  SpotIllustration. Buttons / RIASEC colours / tokens unchanged. No orbit rings.
- All illustrations are inline low-poly outline SVG, no faces: seated + standing student
  silhouettes, 5 constellations (microscope / airplane / scales / paintbrush /
  stethoscope), signposts, branching pathway lines, converging career paths.
- Copy locked: headline "Your future is out there. Let's find it.", sub "Free career
  guidance for every student across India.", final CTA "Start your journey" (--violet,
  full-width on mobile). No gradient text anywhere on the page.
- CTAs are react-router Links → /onboarding (assessment) and /how-it-works.
- Hero reveals use mount-based animate (not whileInView) — above-the-fold content must
  not depend on an IntersectionObserver firing at load.
- Verified: `npm run build` passes (409 modules); zero console errors; no horizontal
  overflow at 1280px or 390px; pin-spacers correctly absent (=0) on mobile. NOTE: the
  headless preview throttles requestAnimationFrame, which freezes Framer/GSAP mid-reveal
  in later screenshots; the initial active-tab render confirmed the full hero.

### Phase 6 — Frontend (Session 6B.1: immersive landing redesign)

**Goal (user):** make the landing more immersive — "feel like you're on that rooftop
with the student"; open zoomed in on the student and zoom out on scroll; replace the
signpost line-paths-to-text on scene 2 (a story should be *shown*, not told); keep the
constellations; make it as immersive / interactive / complete as possible.

**Scene 1 — rooftop "camera pull-back" (the headline change)**
- The whole scene-1 world now lives in one `.js-cam` layer. On desktop it is pinned
  (ScrollTrigger, end +=170%) and opens scaled to 1.82 with transform-origin near the
  seated student, then scrubs back to scale 1 — a literal camera pull-back from an
  intimate close-up to the full night sky. Hero copy, city and horizon-glow reveal as the
  camera settles; a gentle recede + fade hands off to scene 2.
- Depth layers (back→front): StarfieldCanvas → constellation sky (cursor-parallax via
  gsap.quickTo) → warm horizon glow → city skyline → rooftop + seated student.
- New `CitySkyline` (deterministic building roofline with warm window lights that twinkle
  via an ambient GSAP loop) and `RoofObjects` (water tank, vent) for place + depth.
- StarfieldCanvas gained an opt-in `shootingStars` prop (meteor streaks; off under
  reduced motion); enabled on the hero.
- Persistent fixed `TopBar` (STARSHIP wordmark + Begin) so it always reads as a product.

**Scene 2 — "show, don't tell" (replaces the signpost diagram)**
- Removed `PathwayLines` + `Signpost` (the line-paths-to-text the user disliked).
- New shown metaphor: a lockstep crowd of identical faceless figures flows across one
  track while the constellations overhead (the "potential") dim out of reach; one lone,
  brighter student holds still, leans back to look up, and a single star wakes above —
  bridging into Discovery. Verified scrub on desktop: crowd marches, dim 0.32→0.12, lone
  rotate 0°→−7°, hint star 0→1.

**Robustness fix (important)**
- The hero copy was previously stuck invisible: Framer mount-reveals inside a GSAP-pinned
  section get orphaned when ScrollTrigger re-parents the node into a pin-spacer. All of
  the hero + scene-2 storytelling is now GSAP-driven from safe, *visible* resting states,
  so critical copy can never get stuck hidden.
- Root-caused the "frozen animations / blank screenshots" seen in the headless preview:
  the preview tab is `document.hidden`, so (a) Framer Motion pauses all animations — hence
  scenes 4/5 (`Reveal`, `CareerCard`, `StatCounter`) show opacity 0 in the preview but
  animate normally for real users in a visible tab, and (b) programmatic `scrollTo` needs
  an explicit `ScrollTrigger.update()` for the scrub to advance, and `position:fixed`
  pinned content doesn't appear in captures. None of these are real bugs — verified the
  GSAP scrubs via telemetry and the composed scenes by rendering them un-pinned (<768px).

**Unchanged:** scenes 3 (Discovery / BubbleScale), 4 (Possibility / CareerCards +
StatCounter + sky-expand), 5 (Hope / SpotIllustration + gathering + final CTA) kept their
structure and Framer reveals. Constellations kept (now static SVG so they never stall;
entrance + hover-to-name driven by GSAP). Tokens / buttons / RIASEC colours untouched.
- `sceneStyle` padding switched to longhand to clear a React shorthand-conflict warning.
- Files: `frontend/src/pages/Landing.jsx` (rewritten), `frontend/src/components/StarfieldCanvas.jsx`
  (shootingStars).
- Verified: desktop 1280/1440 pull-back + scene-2 scrub via ScrollTrigger telemetry;
  static composition + mobile 375 via screenshots; 5 scenes + TopBar render, no runtime
  console errors.

### Data Integrity — Question bank consolidation (2026-06-12)

**`assessment_questions_v2` (155 rows) is the sole source of truth for assessment
questions. All v1 / original question data is VOIDED.**

- **Voided (not dropped):** the v1 tables `assessment_questions` (38), `assessment_options`
  (128), `student_assessment_answers` (38) are obsolete and no longer referenced by any
  code. Left in place per the "add columns, don't drop tables" rule, but treated as dead.
  No stale v1 question JSON file exists in the repo.
- **References repointed to v2:** `run_aptitude_test.py` (the only remaining v1 reference
  in the codebase) now reads `assessment_questions_v2` / `assessment_options_v2` and writes
  `student_question_responses_v2`. `api.py`, `score_assessment.py`, and the migrations were
  already v2-only (verified).
- **Canonical export:** `frontend/src/data/questions_v2.json` (155 questions, 725 options,
  trait weights) was exported directly from `assessment_questions_v2` (+ `assessment_options_v2`
  + `question_trait_weights_v2`), ordered by `question_id`. Ground truth came from the DB,
  not hand-authored. `question_bank_v2.json` (the importer seed) was verified byte-identical
  to the DB and left untouched.
- **API:** `GET /questions` now exposes each question's `id` (= `question_id`, retained for
  the `/submit-answer` contract). Still served live from `assessment_questions_v2`.
- **Verified:** `curl http://127.0.0.1:8000/questions | python3 -m json.tool | grep -c '"id"'`
  → **155**; response `total_questions` = 155, 155 distinct ids, all 7 sections present.

### Phase 6 — Frontend (Session 6B: authenticated product funnel)

**The full auth → onboarding → assessment → results → roadmap funnel is built and
verified end-to-end against the live backend.**

**Infra / wiring**
- `context/AuthContext.jsx` — `{ student, accessToken }`, `login(tokens, studentData)`,
  `logout()` (best-effort `POST /auth/logout` revoke), `refreshProfile()`, `isAuthenticated`.
  Initialises the token synchronously from localStorage (no flash-bounce), then rehydrates
  `student` via `GET /profile`. That mount call uses a **bare axios** instance on purpose so
  a stale-token 401 clears silently **without** the shared client's 401→/login redirect
  ("no redirect on mount"). `AuthProvider` wraps `BrowserRouter` in `main.jsx`.
- `components/ProtectedRoute.jsx` — `isAuthenticated ? <Outlet/> : <Navigate to="/login" replace/>`.
- `layouts/AppShell.jsx` — persistent top nav (STARSHIP wordmark, student name → /profile,
  logout) + dimmed `StarfieldCanvas` (opacity 0.4) backdrop + `<Outlet/>`.
- `api/client.js` — added `API_BASE_URL` + `getRefreshToken()` exports (everything else
  untouched).

**Pages built**
- `pages/auth/` — `AuthShell.jsx` (shared dark-card chrome + `Field`/`Select`/`FormError`/
  `Notice`/`SubmitButton` primitives, `toIdentifier`, `errorMessage`), `Login`, `Register`,
  `VerifyOtp` (mock-OTP 123456 reminder + resend), `ForgotPassword`, `ResetPassword`
  (student_id from `?student_id=` query). Inline field errors, violet accents, fw ≤ 500, no
  gradient text. Google OAuth UI intentionally skipped.
- `pages/Onboarding.jsx` — name, current_class (9/10/11/12/Dropper), state (28+8), annual
  budget → `PATCH /profile` (`name`, `current_class`, `preferred_state`,
  `annual_family_income_inr`) → `POST /start-assessment` → `/assessment`.
- `pages/Assessment.jsx` — `GET /questions` (bundled JSON fallback), one at a time,
  `ProgressBar`, slide on `--dur-question`. **Dual-mode** input (see gotcha below).
  Each answer `POST /submit-answer { session_id, question_id: q.id, selected_option_id }`
  + `ReactionToast`. Last → `POST /submit-assessment?session_id=…` → `/results`.
- `pages/Results.jsx` — scroll layout: RIASEC (`RIASECRadar` + top-3 `CategoryBadge`,
  derived from `confidence_scores` bands), career buckets (`CareerCard` primary/secondary/
  stretch), scholarships (graceful empty state — not in payload), universities
  (`UniversityCard`, cost-NULL safe), `StatCounter` row, `ConstellationMap` (click → /roadmap),
  floating counselor.
- Backend fix: riasec_scores + scholarships now returned in /submit-assessment payload. Results.jsx degraded states resolved.
- `pages/Roadmap.jsx` — `POST /career-roadmap` → top_careers + recommendations as chips;
  graceful empty states for salary + education_path (schema gaps).
- `pages/Profile.jsx` — `GET`/`PATCH /profile` view + edit.
- `components/CounselorOrb.jsx` — stateful wrapper around `AIOrb` → `POST /chat`, with
  rate-limit/error fallback messaging.
- `App.jsx` — public (`/ /login /register /verify-otp /forgot-password /reset-password`,
  kept `/gallery` + `/how-it-works`) vs protected (`ProtectedRoute` → `AppShell` →
  `/onboarding /assessment /results /roadmap /profile`).

**Backend changes required to make the funnel work (2 minimal, necessary fixes)**
- **CORS** (`api.py`): added `CORSMiddleware` allowing the Vite origin
  (`FRONTEND_ORIGINS` env, default `localhost:5173` + `127.0.0.1:5173`). Without it the
  browser blocked every cross-origin API call. This was listed as required 6B infra.
- **Scoring-engine crash fix** (`score_assessment.py:631`): `if comp <= 2` threw
  `TypeError` when a scholarship's `competitiveness_level` is NULL — a 500 at the funnel's
  terminal `/submit-assessment` step for realistic students. Guarded to `if comp is not None
  and comp <= 2` (NULL → "highly competitive" bucket). All logging preserved.

**Carry-forward gotchas discovered in 6B (important)**
- **`/submit-answer` expects `selected_option_id`, NOT a 1–5 value.** BubbleScale emits a
  1–5 value; the page resolves it to the option whose `value` matches and submits that
  option's real `option_id`.
- **The 155 questions are mixed: 105 likert (5 opts, values 1–5) + 50 mcq aptitude (4 opts,
  values [0,0,0,1]).** BubbleScale can only express likert, so Assessment is **dual-mode** —
  BubbleScale for likert, a 4-option picker (`McqChoices`) for mcq. Both submit `option_id`.
- **`/submit-assessment` takes `session_id` as a QUERY param** (`?session_id=`), not a body.
- **The engine result has no numeric RIASEC scores and no scholarships** — only
  `confidence_scores` (trait→High/Average/Low), career tuples, universities, financials.
  Results derives the RIASEC radar shape from the confidence bands and shows an honest
  scholarships empty state (the counselor can still surface them via `/chat`).
- **`/start-assessment` rejects `'Dropper'`** (only 9–12 pass) but only *validates* the
  value — the engine reads the real class from the students row. Onboarding sends `'12'` to
  that gate for Droppers while persisting `'Dropper'` via `/profile`.
- **`/career-roadmap` takes no body** (student-scoped via JWT); the chosen career is a
  frontend focus label. salary + education_path are not returned (schema gap) → empty states.

**Verified (live backend, Vite preview)**
- `npm run build` passes — **479 modules, zero errors**.
- Real run: register → verify-otp(123456) → onboarding → start-assessment →
  155× submit-answer → submit-assessment (200, real payload: Mechanical/Civil Engineer top
  matches, BITS Pilani ₹1.5L university, 6 interest bands) → Results renders every section
  from real data → CareerCard click → Roadmap (real data + empty states) → `/chat` returns a
  live Cohere reply → counselor orb opens. Protected redirect (`/onboarding`→`/login` when
  logged out) works. Zero console errors.
- Known preview artifact (not a bug): `StatCounter` shows 0 in the headless/hidden tab
  because its `useInView` count-up is paused when `document.hidden`; values (25/1/3) are
  wired correctly and animate for real users. The mcq picker UI was not auto-captured
  (hidden-tab timer throttling blocked advancing to q106), but its data path is verified.

### Phase 6 — Frontend (Session 6C: Results data wiring + How-it-works + cleanup)

**Three scoped tasks, each verified. Touched only Results.jsx, App.jsx, the new
HowItWorks.jsx, and deleted Gallery.jsx — Landing, auth, Assessment, and the backend
were not modified.**

**1. Real `riasec_scores` + `scholarships` wired into Results (`pages/Results.jsx`)**
- The `/submit-assessment` payload now carries both fields (engine `result` is returned
  verbatim under the response's `results` key — `api.py:717`; `Assessment.jsx:123` already
  unwraps it as the router state). Verified the exact shapes against `score_assessment.py`:
  - `riasec_scores` — `{ R, I, A, S, E, C }` letter-keyed floats 0–100 (normalized at
    `score_assessment.py:78`, returned at `:925`). Passed **directly** to `RIASECRadar`
    (its `normalize()` accepts a letter-keyed object). The previous `confidence_scores`
    band-derivation (`BAND_VALUE` 88/56/30) is **removed** — the radar and the top-3 list
    now show real numbers (the top-3 rows show the trait name + rounded score).
  - `scholarships` — `[{ name, amount_max_inr, competitiveness_level }]` (`:625`). Mapped to
    a `ScholarshipCard` list (`amount_max_inr` → card `amount` with `period="max"`, or
    "Amount varies" when NULL/0; `competitiveness_level` → a single eligibility tag via
    `competitivenessTag`: 1–2 "Less competitive", 3 "Moderately competitive", 4–5/NULL
    "Highly competitive" — mirrors the engine's bucketing). The old "we don't return
    scholarships yet" placeholder is gone; a **genuine** empty-array state remains (some
    students legitimately match none).
- Stats row, career buckets, universities, constellation, counselor orb all unchanged.

**2. Real How-it-works page (`pages/HowItWorks.jsx`, new) replaces the placeholder**
- Public `/how-it-works`. StarfieldCanvas backdrop (same `glowColor` as the old placeholder),
  a lightweight top bar (STARSHIP wordmark → `/`, "Start →" → `/onboarding`), hero
  ("How STARSHIP works" / "Five steps from uncertainty to clarity."), five steps, and a
  closing CTA ("Start your assessment" → `/onboarding`, react-router `Link`).
- Each step uses a `SpotIllustration` (`assess`/`analyze`/`match`/`fund`/`guide`) on the
  **left on desktop, top on mobile** (flex-wrap, verified: text stacks below the spot at
  375px) + step number + headline + 2–3 sentence description. Reveal on scroll via Framer
  `whileInView` (safe — this page is **not** GSAP-pinned, so the pin-spacer orphaning bug
  does not apply); the above-the-fold hero uses a mount `animate` instead of an observer.
- Brand-locked: dark void bg, token colours, font-weight ≤ 500, **no gradient text**
  ("STARSHIP" in the headline is solid `--stardust`, not a gradient).
- `App.jsx`: the `/how-it-works` element is now `<HowItWorks />`.

**3. Cleanup**
- Deleted `frontend/src/Gallery.jsx`; removed the `/gallery` route and its import from
  `App.jsx`. Confirmed zero remaining `Gallery` references in `frontend/src`. The now-dead
  `Placeholder` helper (and its sole-purpose `StarfieldCanvas` import) were removed from
  `App.jsx` too — every route now points at a real page.

**Verified**
- `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run build` → **480 modules, zero errors**.
- `/how-it-works` rendered in the Vite preview (desktop + mobile 375): hero, all five steps
  with their spots, correct desktop-left / mobile-top stacking, the `/onboarding` CTA, and a
  **clean console** (the transient `[vite] Failed to reload /src/Gallery.jsx` HMR messages
  were a stale dev-server artifact of deleting the file mid-session; they vanished after a
  dev-server restart and cannot recur on a fresh load — App.jsx no longer imports it).
- Results.jsx wiring verified by build + source-level payload-shape confirmation (engine →
  api.py → Assessment.jsx → Results.jsx); not re-run through the full 155-q funnel since the
  flow is identical to the 6B end-to-end run and only the data source for the radar +
  scholarships changed (onto already-verified components). Note: as in 6B, the headless/hidden
  preview tab pauses Framer Motion, so `whileInView`/mount reveals read `opacity:0` in raw
  screenshots — verified the real layout by forcing the resting state via inspection.

### Phase 7 — Data & Roadmap (Session 7A: career_profiles expansion → roadmap detail)

**The career roadmap now shows real salary, education path, recruiters, and growth outlook
for all 25 careers — the salary/education empty states from 6B are gone.**

**Schema + data (migrations 004 + 004b — already applied; do NOT re-run)**
- `migrations/004_career_profiles_expansion.sql` adds, via `ADD COLUMN IF NOT EXISTS`:
  `salary_min_inr INTEGER`, `salary_max_inr INTEGER`, `education_path JSONB` (shape
  `{"steps": [...]}`), `top_recruiters TEXT[]`, `growth_outlook VARCHAR(20)`
  (`'High' | 'Moderate' | 'Low'`).
- `migrations/004b_career_profiles_data.sql` populates all **25** career profiles with
  India-specific salary ranges, 4–5 step education paths, 5–6 top recruiters, and an
  outlook. Verified: 25/25 rows have all five fields non-null.

**API (`api.py` `/career-roadmap`)**
- The endpoint's SELECT now returns `salary_min_inr, salary_max_inr, education_path,
  top_recruiters, growth_outlook` for every career the engine scored, keyed by
  `career_name` under a new `career_details` map in the response (alongside the existing
  `top_careers` + `recommendations`). Still student-scoped via JWT and takes no body.

**Frontend (`pages/Roadmap.jsx`)**
- Reads `career_details[focusCareer || top match]` and renders: salary as
  "₹X,XX,XXX – ₹Y,YY,YYY / year" (Indian digit grouping via `toLocaleString('en-IN')`),
  education path as a numbered vertical `<ol>`, top recruiters as a pill/tag list, and
  growth outlook as a coloured badge — High = `--aurora`, Moderate = `--gold`,
  Low = `--coral`. Each field keeps a graceful empty state for any future profile missing
  data. The 6B salary/education placeholders are removed.

**Verified (7A)**
- `cd frontend && npm run build` → **480 modules, zero errors**.
- Live `POST /career-roadmap` (student 12, real 155-q assessment) returns all five fields
  for the engine's top matches (Mechanical Engineer / Doctor (MBBS) / Teacher / Professor);
  `career_details` carries all 25 careers.
- Visual spot-check (Vite preview, authenticated): Roadmap renders
  "₹3,50,000 – ₹15,00,000 / year" (Mechanical) and "₹6,00,000 – ₹25,00,000 / year"
  (Doctor), a 5-step numbered education list, 6 recruiter pills, and the outlook badge in
  the correct token colour — Moderate → gold (#EF9F27) and High → aurora (#1E9E78)
  confirmed live; Low → coral (#D85A30) by code + resolved token. Zero console errors.
- Note (`auth.py` gotcha): `auth.py` reads `JWT_SECRET` at import without loading `.env`,
  so to mint a token out-of-band you must `import config` (which calls `load_dotenv()`)
  **before** `from auth import create_access_token`, or the token won't match the server's.

### Phase 7 — Data & Roadmap (Session 7B: university costs + programs + token refresh)

**University affordability data, a real programme catalogue, and silent JWT refresh
are all in. The engine's budget fallback now returns real universities (the Phase 4
"Bug 3" blocker is cleared), and every career profile has programmes mapped to it.**

**Task 1 — University cost data (`scrapers/university_costs.py`, new)**
- Added `data_source VARCHAR(30)` to `universities` (`ADD COLUMN IF NOT EXISTS`); the 13
  pre-existing hand-seeded costed rows were tagged `'manual'`.
- Three-tier pipeline, all writes are **UPDATE … WHERE total_annual_cost_inr IS NULL**
  (never overwrites; re-runnable) and only INSERT genuinely new institutions:
  1. **NIRF live scrape** (`nirfindia.org/Rankings/2024`, server-rendered tables parsed
     with stdlib — no bs4). Enriches `nirf_rank` / `city` / `state` only (NIRF ranking
     tables don't publish fees). On this run NIRF returned **HTTP 504 (site-side gateway
     timeout)** for every page — the stage logged the failures and the run continued via
     the graceful fallback. The parser was verified against the real HTML structure
     beforehand; a future run will pick up NIRF data when the site is back up.
  2. **Curated published-fee table** (~221 entries): IITs, NITs, IIITs, IIMs, AIIMS, NLUs,
     IISERs, central universities, top private/deemed universities, top medical colleges,
     specialist institutes. Govt/standardised public fees tagged `'scraped'`; private/state
     representative figures tagged `'manual'`. → updated 46 existing rows, inserted 175.
  3. **Cohere fallback** (`command-r-plus-08-2024`): batched (20/call, ≤30 calls, sleep
     between calls for the trial limit, commit per call) fee-range estimates for remaining
     clean-named Indian universities; midpoint written, tagged `'ai_estimated'`. → 285 rows.
- **Result: 514 universities now have `total_annual_cost_inr`** (was 13; target was top
  500). Breakdown: `ai_estimated` 285 · `scraped` 178 · `manual` 51. Total rows
  9,375 → 9,550 (+175 inserted, 0 wiped). Existing seed costs verified preserved
  (IIT Bombay still ₹2.5L, not clobbered by the curated ₹2.3L — COALESCE-WHERE-NULL).

**Task 2 — Programs expansion (`migrations/005_programs_expansion.sql`, new)**
- `programs` **8 → 82** (74 generic templates added, `university_id` NULL — the engine's
  program query keys off `career_id`, not university). `fields` **12 → 40** (8 new
  top-level domains: Management, Architecture, Pharmacy, Agriculture, Education, Mass
  Communication, Design, Hospitality; + 20 sub-fields, parent-linked).
- Covers every brief domain: Engineering (all major branches), Medical, Dental, Nursing,
  Law, Management/MBA, Sciences (Physics/Chem/Bio/Math/CS/Stats), Arts & Humanities,
  Commerce/Finance, Architecture, Agriculture, Pharmacy, Education/B.Ed, Mass
  Communication, Hotel Management, Design.
- **Task 2c mapping:** `career_profiles` has **no `required_programs` column** — the
  program→career link IS `programs.career_id` (FK `fk_program_career` → `career_profiles`,
  the field the engine reads). Every new program is mapped to one of the **25** profiles by
  exact `career_name`; **all 25 careers now have ≥1 programme** (2–11 each). Migration is
  idempotent (staged in a temp table, inserted only when an identical generic row is
  absent — re-run inserts 0) and a built-in diagnostic confirmed 0 unmapped rows.

**Task 3 — Token refresh on 401 (`frontend/src/api/client.js`)**
- The 401 response interceptor now: (1) loop-guards the refresh call itself and
  already-retried requests (clear + redirect); (2) otherwise calls **`POST /auth/refresh`**
  with the stored refresh token (bare axios, so the interceptor doesn't re-enter);
  (3) on success stores the new access token via `setTokens` (exact response field:
  **`access_token`**) and retries the original request; (4) on failure clears tokens +
  redirects to `/login`. Concurrent requests that 401 during a refresh are parked in a
  **single-flight queue** (`isRefreshing` + `failedQueue`) and replayed once with the new
  token — never more than one refresh in flight.
- **Verified live** (backend :8000 + Vite preview :5173, real student): expired access +
  valid refresh → `GET /profile` silently refreshed and retried → **200 with real profile
  data**, access token swapped, refresh token preserved, **no /login redirect**. Concurrent
  test: 3 simultaneous expired-token requests → all 200, **exactly 1** `/auth/refresh` call
  (single-flight confirmed). Zero console errors.

**Verified (7B)**
- `cd frontend && npm run build` → **480 modules, zero errors**.
- `SELECT COUNT(*) FROM universities WHERE total_annual_cost_inr IS NOT NULL` → **514**.
- `SELECT COUNT(*) FROM programs` → **82**; all 25 career profiles mapped; `fields` → 40.
- Token refresh + single-flight queue verified in-browser (above).

**Phase 7B fully complete.**

### Session 8 — Funnel bug fixes (2026-06-13)

**Three reported bugs in the assessment funnel, fixed and verified end-to-end
(live backend :8000 + Vite preview :5173). `npm run build` → 482 modules, zero
errors (was 480; +2 for the new nav-guard context + confirm modal).**

**BUG 1 — assessment re-entry on a completed session (highest priority)**
- Schema fact (checked, not assumed): `assessment_sessions` is
  `(session_id, student_id, started_at, completed BOOLEAN DEFAULT false)` — there
  is **no `completed_at` / `status` column**. "Has completed" ==
  `EXISTS(... WHERE student_id = X AND completed = TRUE)`.
- `api.py` `GET /profile` now returns **`has_completed_assessment: bool`** (an
  EXISTS subquery in the same SELECT).
- New **`GET /results`** (`api.py`, JWT, **read-only**): returns
  `{status, results: run_career_engine(student_id)}` for a student who has a
  completed session, else **404** "No completed assessment found". `run_career_engine`
  performs **zero writes** (verified — no INSERT/UPDATE/DELETE/commit in
  `score_assessment.py`), so it's idempotent and can never overwrite a finished
  assessment. This was **required**, not optional: the report's redirect target
  `/results` previously bounced to `/onboarding` whenever it lacked router state,
  so a bare redirect there would infinite-loop. `GET /results` makes the page
  self-sufficient.
- Frontend gates (redirect a completed student to `/results`):
  `pages/Onboarding.jsx` (mount → `refreshProfile()` → if completed, `navigate('/results', {replace})`; minimal loader until the check resolves) and
  `pages/Assessment.jsx` (mount `gate` state → `GET /profile` → if completed
  redirect, else keep the original "no session → /onboarding" guard).
  `pages/Results.jsx` now **self-fetches `GET /results`** when there's no
  `location.state` (`status: loading|ready|empty|error`; `empty` → `/onboarding`,
  `error` → retry button — never a redirect loop).
- Verified: `/profile` → s12 `true`, s2 `false`; `/results` → s12 **200** with all
  10 engine keys, s2 **404**; calling `/results` twice left
  `completed_sessions`/`responses` row counts unchanged and returned a
  byte-identical payload (no overwrite). In-browser: completed s12 hitting
  `/onboarding` **and** `/assessment` both land on `/results` (which rendered real
  data via self-fetch); non-completed s2 stays on `/onboarding` (first-time flow
  intact).

**BUG 2 — progress protection (confirm before leaving an active assessment)**
- New `context/NavGuardContext.jsx`: holds `unsavedChanges` + a deferred
  `pendingAction`; exposes `requestLeave(fn)` / `confirmLeave` / `cancelLeave` /
  `isPrompting`. Also registers **`useBeforeUnload`** (native prompt for tab
  close / refresh / hard nav — the only thing that can interrupt a real unload).
- New `components/ConfirmLeaveModal.jsx`: on-brand dark card, `--violet` accents,
  exact copy **"Your progress may not be saved. Are you sure you want to leave?"**,
  "Leave anyway" / "Keep going" (backdrop-click & Esc = stay). **Not** an
  `alert()`.
- `layouts/AppShell.jsx` wrapped in `<NavGuardProvider>`; the wordmark, profile
  link, and logout button all route through `requestLeave` so a guarded action
  raises the modal mid-assessment; the modal renders in an `<AnimatePresence>`.
- `pages/Assessment.jsx` sets `unsavedChanges = true` after the first answer
  saves, `false` after `/submit-assessment` succeeds, and clears it on unmount.
- **Why not `useBlocker`:** the app mounts `<BrowserRouter>` (main.jsx), and
  react-router's `useBlocker` requires a **data router** (`createBrowserRouter`).
  Intercepting the specific shell controls (as the report asked) is the supported
  path here. Trade-off: the browser **Back** button mid-assessment is not
  blocked (would need a data-router migration); `useBeforeUnload` + the shell
  controls cover the reported cases.
- Verified in-browser: mid-assessment, clicking the wordmark intercepted the
  nav (stayed on `/assessment`) and showed the modal with the exact copy + both
  buttons; "Keep going" stayed, "Leave anyway" navigated to `/onboarding`.

**BUG 3 — misclick prevention (800ms confirm beat)**
- `pages/Assessment.jsx` only — **`BubbleScale.jsx` untouched** (its built-in
  filled/glow/dim-others selected state is the confirmed highlight). A `locked`
  state freezes every input for `ADVANCE_DELAY_MS = 800`; the chosen answer shows
  immediately (optimistic `setAnswers`), then save + an 800ms `pause` run in
  parallel (`await client.post(...)` then `await pause`) so the hold is never
  shorter than 800ms and never advances before the answer persists. MCQ options
  get a `✓` in the confirmed state.
- Verified in-browser: after selecting rating-5, the bubble showed
  `aria-checked=true`, **all inputs locked**, the page stayed on Q1 at 150ms and
  600ms, then advanced to Q2. (The measured wall-clock was longer than 800ms
  because the headless preview tab is `document.hidden` and throttles background
  timers — see the carry-forward note; the precise 800ms is fixed in code.)

**Carry-forward notes for next session**
- `assessment_sessions.completed` is a **BOOLEAN** (no `completed_at`/`status`).
- `run_career_engine` is **read-only**; `GET /results` is the safe way to
  reload a persisted result without a session/overwrite.
- Headless preview is `document.hidden` → **Framer pauses all tweens**, so
  `AnimatePresence` exit animations don't complete and a dismissed modal node
  **lingers in the DOM** (state `isPrompting` is correctly false; it unmounts
  normally in a visible tab). Background **timers are throttled**, so the 800ms
  beat measures longer than 800ms in the preview. Neither is a real-user bug.
- An "explicitly start a new assessment" escape hatch is **not built** — there's
  no UI to re-take, so completed students are simply kept in `/results`. If that
  button is ever added, the Assessment mount gate must allow a freshly-created
  session through (today it redirects on any completed session).

### Session 9 — Assessment engagement layer + Q128 fix (2026-06-14)

**Six scoped changes to the assessment experience. Only `pages/Assessment.jsx`
was rewritten on the frontend; `questions_v2.json` + the DB (`assessment_questions_v2`,
`assessment_options_v2`) were edited in lockstep for the question fix. Backend code
(api.py / engine) was NOT touched. `npm run build` → 482 modules, zero errors.**

- **TASK 1 — centred question text.** The shared `<h1>` (`q.question_text`, rendered
  for both likert and mcq) now has `textAlign: 'center'`.
- **TASK 2 — checkpoint overlays.** New `CheckpointOverlay` (dark `--deep` card,
  `--violet` border glow, drawing-constellation SVG reusing the star/`--stardust`
  motif, fw 500, no gradient). Fires once each on landing at q **25 / 50 / 75 / 100 /
  130** (keyed by `index+1`, deduped via a `shownCheckpoints` ref), auto-dismisses
  after **1.5s**, no interaction. Messages are the exact provided copy.
- **TASK 3 — light humour.** 15 hand-picked likert items (0-based likert-bank indices
  `0,4,8,14,23,29,32,36,44,58,73,76,88,98,100` — organised/procrastination/competitive/
  creative/leading/etc.) show a warm one-liner toast **below the question for 1.5s**
  when the student picks **5 ("That's me")**. Mapped at runtime by likert-bank position
  (`likertIndexById`), so it stays correct regardless of load order. The toast renders
  OUTSIDE the keyed question block so it survives the 800ms likert auto-advance.
- **TASK 4 — aptitude timer.** mcq questions (`question_type === 'mcq'`, the 50 objective
  items) get a thin 3px `--violet` `TimerBar` below the question that depletes over
  **45s** (no number — less stressful). On expiry the question **auto-advances with NO
  answer recorded** — the "skip" path simply does not call `/submit-answer` (that endpoint
  requires a non-null `selected_option_id: int` FK, so a real null can't be submitted;
  leaving no response row IS the skip). Timer resets per mcq question; **no timer on likert**.
- **TASK 5 — confirm button (mcq only).** mcq taps now set a *tentative* `mcqChoice`
  (no submit/advance); a "Confirm →" button commits it (or the timer expires). Likert
  keeps the existing 800ms auto-advance (`saveAnswer`'s confirm beat, BUG 3).
- **TASK 6 — Q128 fix.** `assessment_questions_v2.question_id = 128` (index 127, mcq
  logical) was broken: it said "**Five** students" but named only four. Fixed to "Four
  students"; the name **Aman → Namay** in the prompt and in option 615 (the only "Aman"
  / "shortest student" question in the bank). `question_id` / `trait_weights` / correctness
  unchanged — answer is still **Neel** (opt 617). DB UPDATEs run on both
  `assessment_questions_v2` + `assessment_options_v2`; `questions_v2.json` edited to match.
  Verified: 0 rows contain "Aman" in either table; JSON ↔ DB in sync.

**Verification note:** build is green and the DB↔JSON sync was verified directly. The
mid-assessment overlays/timer were NOT re-run through the live headless preview — it is a
`document.hidden` tab (Framer pauses tweens, background timers throttle, per the Session
6B/8 carry-forward notes), so a 45s countdown / 1.5s overlay can't be captured reliably
there; correctness was confirmed at the code + data level. The full auth→onboarding→
assessment funnel is otherwise unchanged from the verified 6B/8 runs.

### Session 28 — Landing Scenes 2/3/4 visual rebuild (2026-06-15)

**Scene 2 photograph removed; inline SVG crowd + inline SVG animated student built from scratch.
Scene 3 gets correct image + updated layout. Scene 4 stargazer checked (not found).
Scene 1 and Scene 5 untouched. GSAP ScrollTrigger structure untouched.
`npm run build` → 489 modules, zero errors.**

- **Scene 2 — crowd + student from scratch (no images)**
  - `crowd-pressure.jpg` `<img>` removed entirely. Background is `#06071A` only.
  - `CrowdBackground` (new): pure inline SVG; 15 front figures + 12 back figures (circle r=8 + rect
    w=18, h=40, rx=4); `rgba(29,158,117,0.12)` front / `rgba(29,158,117,0.07)` back;
    `preserveAspectRatio="xMidYMax slice"`, `position:absolute inset:0`, `z-index:0`.
  - `CompositeFigure` (loaded `/assets/figures/animated/*.svg` files) deleted.
  - `StudentFigureSVG` (new): fully inline SVG `viewBox="0 0 180 400"`, colour `#534AB7`.
    Parts as `<g>` elements with IDs: `sc2-head`, `sc2-torso`, `sc2-left-upper-arm`,
    `sc2-right-upper-arm`, `sc2-left-forearm`, `sc2-right-forearm`, `sc2-legs`.
    Each animated group has `style={{ transformBox:'fill-box', transformOrigin:'center top' }}`
    (head: `center bottom`). Ground shadow ellipse at cy=395.
  - `tl2`: `.js-student-back`/`.js-student-arms`/`.js-student-head` tweens replaced with
    `.to('#sc2-torso', { rotateX:40 })`, `.to('#sc2-left-upper-arm', { rotate:-100 })`,
    `.to('#sc2-right-upper-arm', { rotate:100 })`, `.to('#sc2-head', { rotateX:20 })`,
    `.to('#sc2-left-forearm', { rotate:-30 })`, `.to('#sc2-right-forearm', { rotate:30 })`;
    all `ease:power2.inOut`, `duration:1` (forearms at position 0.1).

- **Scene 3 — correct image + layout**
  - Was: `student-design-sheet.jpg` from `/assets/figures/` (design reference, wrong).
  - Now: `/assets/photos/scene3-student-gazing.jpg`.
  - Left column: `45%` width, `padding:3rem`. Right column: `55%`, `paddingLeft:3rem`, `maxWidth:440`.
  - Glow wrapper (`.js-scene3-glow`): `border:1px solid rgba(83,74,183,0.5)`, `borderRadius:18px`,
    `padding:6px`, `background:rgba(83,74,183,0.04)`. CSS hover `scale(1.03)` (transition 0.5s ease).
  - Image: `maxHeight:420px`, `borderRadius:16px`. GSAP glow: `duration:2` (was 2.5), alpha 0.15 (was 0.2).

- **Scene 4 — stargazer checked, not found**
  - Looked in `/assets/figures/` for stargazer/silhouette/student-gazing/student-looking-up.
  - Files found: `animated/` (SVG parts), `crowd-pressure.jpg`, `student-design-sheet.jpg`, `student-parts-sheet.jpg`.
  - None match → comment `{/* stargazer image — asset not found in /assets/figures/ */}` added above scene-4.
  - Career cards + stat counters untouched.

### Session 26 — Scene 1 surgical fixes: skyline dissolve, rooftop hide-until-PNG, dead code (2026-06-15)

**Scene 1 only. Scenes 2–5, StarfieldCanvas, and all GSAP ScrollTrigger timelines
untouched. `npm run build` → 489 modules, zero errors.**

**FIX 1 — Dead code removal**
- `SeatedStudent` SVG function, `const FILL`, and the dead `gsap.fromTo('.js-head', …)` ambient
  tween all deleted. `.js-head` targeted a class inside `SeatedStudent` which was defined but
  never rendered — the tween was a no-op in the DOM. No named components
  `RoofObjects`/`RooftopObjects`/etc. existed in the file (removed in Session 25).
- `StardustStudent` component and the student shadow div are **not touched** — they are the
  live particle student, outside the rooftop layer.

**FIX 2 — Skyline dissolve extended (no hard container edge)**
- Mask gradients strengthened so buildings emerge later from darkness:
  `far: transparent 0%→35%, black 65%` (was `20%, 50%`);
  `mid: transparent 0%→25%, black 55%` (was `15%, 40%`);
  `near: transparent 0%→15%, black 45%` (was `10%, 35%`).
  Rooftop PNG layer: no mask (PNG transparency handles blending).
- `.js-city` container: `border:'none'` and `boxShadow:'none'` added explicitly alongside
  `background:'none'`. `WebkitMaskImage` already mirrors `maskImage` via the existing spread.

**FIX 3 — Rooftop layer hidden until PNG file is present**
- Rooftop `<img>` initial `display:'none'`; `onLoad` handler sets `display:'block'`.
  `onError` keeps `display:'none'`. Missing PNG → invisible layer, no broken image.

### Session 25 — Scene 1 refinements: skyline scale, rooftop PNG, constellation exit fix, sound tuning, student shadow, mobile (2026-06-15)

**Scene 1 only. Scenes 2–5, StarfieldCanvas, and all GSAP ScrollTrigger timelines for
Scenes 2–5 untouched. `npm run build` → 489 modules, zero errors.**

**TASK 1 — Skyline height reduced to ~10% of viewport**
- `.js-city` container: `height:18vh` / `maxHeight:160px` (was 65vh). Mobile: `height:12vh` / `maxHeight:100px`.
- All layer images: `height:'100%', width:'100%'` filling the container exactly.
- Mask gradients unchanged (still handle sky blending on JPG layers).

**TASK 2 — Rooftop PNG with transparent background**
- `layer-rooftop.jpg` → `layer-rooftop.png` in `SKYLINE_LAYERS`. No `maskImage`/`WebkitMaskImage`
  on this layer — PNG transparency handles blending. `filter:brightness(0.85)` (mild, not the old
  `brightness(0.65) saturate(0.9)`). `objectFit:'contain'` so rooftop objects are never clipped.
- Scroll parallax (yPercent:-28) and cursor parallax unchanged. `mobileFilter:brightness(0.77)`.

**TASK 3 — Remove RoofObjects line-art**
- `RoofObjects` function (water tank + vent SVG) deleted from `Landing.jsx`. `<RoofObjects />` JSX
  removed from `.js-rooftop`. The dark gradient overlay and glowing edge line in `.js-rooftop` are kept.

**TASK 4 — Constellation stuck-lit exit fix (definitive)**
- `activeIndex` (single integer) replaced with `isActive[]` (boolean array per constellation).
- On exit: `gsap.killTweensOf(data.lines)` called BEFORE starting exit tween. This prevents any
  in-progress enter tween from overriding exit — the root cause of the stuck-lit bug.
- On enter: `gsap.killTweensOf(data.lines)` also called before enter tween (defensive).
- `visibilitychange` listener added inside rAF callback: fires `forceExitAll()` when tab becomes
  hidden — all active constellations immediately exit with short tweens + isActive reset to false.
- Unmount: `gsap.killTweensOf` on all targets (prevent stale callbacks).

**TASK 5 — Constellation positions (avoid text overlap)**
- Repositioned to avoid hero text zone (top ~55%, centre x):
  - microscope: `top:8%, left:4%` (far left, above text)
  - airplane: `top:6%, right:5%` (far right, above text)
  - scales: `top:55%, left:3%` (lower left, below text zone)
  - camera: `top:50%, right:4%` (lower right, below text zone)
  - stethoscope: `top:65%, right:18%` (bottom right, clear of heading)
- `transform:scale(0.65)` on each wrapper (desktop). Mobile: `scale(0.45)`, stethoscope hidden
  (`mobileHidden:true`), remaining 4 repositioned to corners. `ConstellationLayer` no longer
  gated by `!isMobile` — mobile now renders 4 constellations statically (no mousemove).
- `right` property support added to CONST_ITEMS + JSX (`transformOrigin:'top right'` for right-anchored).

**TASK 6 — Student rooftop shadow**
- Radial-gradient ellipse `<div>` at `bottom:18vh` (desktop) / `12vh` (mobile), `zIndex:4`,
  `blur(5px)`. `width:120px` desktop / `80px` mobile. Placed before student in DOM stack.

**TASK 7 — Sound tuning: softer chime**
- `playChime()` in `SoundManager.jsx`: freqs `1900/1940Hz → 900/920Hz` (lower pitch = softer),
  gain `0.18 → 0.09` (quieter), decay `140ms → 200ms` (warmer tail). setTimeout buffer: 200→250ms.

**TASK 8 — Dust repulsion sound**
- New `playDust()` in `SoundManager.jsx`: 180Hz sine → lowpass BiquadFilter 300Hz → gain
  ramp 0→0.06 over 8ms → exponential decay to 0.0001 over 130ms. Very soft low rumble.
  No-op if `soundEnabled=false` or AudioContext not unlocked.
- `playDust` added to `value` object in `SoundManagerProvider`.
- In `Landing.jsx`: `lastDustTimeRef` + `onMouseMove` on the student `js-seated` div calls
  `playDust()` throttled to 200ms.

**TASK 9 — Mobile scale**
- Student: `bottom:18vh` (desktop) / `12vh` (mobile). Size `182×221` on mobile (65% of `280×340`).
- Laptop decoration: `bottom:calc(18vh+1px)` (desktop) / `calc(12vh+1px)` (mobile).
- Skyline brightness: `mobileFilter` property on each layer (0.9× brightness multiplier on mobile).
- Hero headline: `fontSize:'clamp(2rem, 5vw, 4rem)'` — scales down on small screens.
- Shadow + student bottom track mobile skyline height (`12vh` on mobile).

### Session 24 — Scene 1: sky masking, layer depth, parallax, constellation timing (2026-06-15)

**Scene 1 only. Scenes 2–5, StarfieldCanvas, and all GSAP ScrollTrigger timelines for
Scenes 2–5 untouched. `npm run build` → 489 modules, zero errors.**

**FIX 1 — Remove mixBlendMode:** `mixBlendMode: 'screen'` removed from every skyline
`<img>`. Screen blend only works on pure-black backgrounds — these are colour photographs.

**FIX 2 — Sky removal via CSS mask (replaces blend mode):** each layer now has a
`maskImage` + `WebkitMaskImage` gradient that fades the top (sky portion) to transparent
and brings the buildings in smoothly from below. Per-layer gradients:
- far: `transparent 0%→20%, black 50%` (most sky to remove)
- mid: `transparent 0%→15%, black 40%`
- near: `transparent 0%→10%, black 35%`
- rooftop: `transparent 0%→5%, black 25%` (minimal sky)

**FIX 3 — Layer brightness via filter (not opacity):** each layer is at `opacity: 1` (no
ghostly transparency) and dimmed via `filter: brightness() saturate()`:
- far: `brightness(0.35) saturate(0.6)`
- mid: `brightness(0.45) saturate(0.7)`
- near: `brightness(0.55) saturate(0.8)`
- rooftop: `brightness(0.65) saturate(0.9)`

**FIX 4 — Layer stacking + container:** all 4 `<img>` layers are `position:absolute,
bottom:0, width:100%, height:auto` stacked by `zIndex` 1–4. The `.js-city` container
changed: `height: 60vh → 65vh`, `overflow: hidden → visible` (was clipping the rooftop
layer), `zIndex: 2 → 1`. Student (`js-seated`) + laptop decoration updated to `zIndex: 5`
(above rooftop layer at z:4 inside the container's stacking context). Rooftop layer gets
`maxHeight: 40vh`.

**FIX 5 — Scroll parallax depth:** four new `tl1.to()` tweens (at position 0, `ease:none`)
move each layer upward at a different rate during the camera pull-back:
- far: `yPercent: -6` (barely moves), mid: `-12`, near: `-20`, rooftop: `-28` (moves most)
Refs `farLayerRef`, `midLayerRef`, `nearLayerRef`, `rooftopLayerRef` defined in `Landing`
and passed to `SkylineLayers` via props — no `document.querySelector`.

**FIX 6 — Constellation scroll fade timing:** the constellation wrapper opacity tween moved
from position `0.58` to `0.7` in `tl1` (was `autoAlpha:0, duration:0.24`; now
`opacity:0, duration:0.3`). Constellations are now fully visible throughout Scene 1 and only
fade as the scene scrolls away. `ConstellationLayer` converted to `forwardRef` so `Landing`
can wire the ref directly (`constellationRef`) rather than using a class selector with
conflicting timing. The hover proximity system (draw-in / draw-out) is completely independent
of this scroll tween and operates on inner elements as before.

**FIX 7 — Cursor parallax on layers:** six `gsap.quickTo` instances (x + y per far/mid/near)
created inside the `mm.add` desktop block; rooftop layer is fixed (no cursor movement). Added
to the existing `onMove` handler alongside the existing constellation depth parallax:
- far: `deltaX × 0.006, deltaY × 0.006`
- mid: `deltaX × 0.013, deltaY × 0.013`
- near: `deltaX × 0.022, deltaY × 0.022`
`safeQuickTo` wrapper returns a no-op if the target element is null (e.g. image failed to
load via `onError`), keeping the handler crash-free.

**`SKYLINE_LAYERS` constant** changed from a string array to an array of per-layer objects
(`{ key, src, zIndex, filter, mask, maxHeight }`). `SkylineLayers` now accepts four named
refs (`farRef, midRef, nearRef, rooftopRef`) and maps them to the corresponding images.

### Session 23 — Scene 1 fixes: skyline blending + constellation animation (2026-06-15)

**Scene 1 only. Scenes 2–5, StarfieldCanvas, and GSAP ScrollTrigger timelines
untouched. `npm run build` → 489 modules, zero errors.**

**FIX 1 — Skyline layer blending (`SkylineLayers` + `.js-city` wrapper)**
- `mixBlendMode:'screen'` added to every skyline `<img>`. Screen blend makes
  dark/black pixels transparent, revealing the starfield behind; lit silhouettes
  (building edges, rooftop lines) remain visible. Previously the solid JPG
  backgrounds blocked the starfield entirely.
- `SKYLINE_LAYERS` constant converted from string array to per-layer style objects.
  Per-layer `maxHeight`: far 70vh, mid 55vh, near 45vh, rooftop 35vh.
  `layer-rooftop.jpg` uses `objectFit:'contain'` + `objectPosition:'bottom center'`.
- `.js-city` wrapper: `height:'44%'` → `'60vh'`; `background:'none'` explicit;
  `overflow:'hidden'`; `right:0` → `width:'100%'`.

**FIX 2 — Constellation draw animation (full `ConstellationLayer` rewrite)**
- **rAF before `getTotalLength()`** — `getTotalLength()` deferred to a
  `requestAnimationFrame` callback after `innerHTML` injection so elements have
  computed geometry. Fixes zero-length dasharrays that caused lines to never draw.
- **Stored lens** — `constData[i] = { lines, circles, lineGroup, labelEl, lens[] }`.
  Measured once in rAF; exit uses `(idx) => data.lens[idx]` function value.
- **Idle state** — lines: `strokeDasharray=len`, `strokeDashoffset=len`, `opacity:1`.
  `lineGroup`: `opacity:1` always (dashoffset is the draw gate). Circles: `opacity:0.35`.
- **Enter** — `gsap.to(data.lines, { strokeDashoffset:0, stagger:0.07, duration:0.4 })`.
- **Exit** — `gsap.to(data.lines, { strokeDashoffset:(idx)=>data.lens[idx], ease:'power2.in' })`.
  No `gsap.reverse()`.
- **Unmount kill** — `gsap.killTweensOf([...lines, ...circles, labelEl])` in cleanupFns.
  Prevents stuck-lit constellation on re-render.

### Session 19 — Sound layer: Web Audio API synthesis + ambient wind (2026-06-15)

**New `SoundManager` component + wired into Landing, Assessment, AppShell, and
main.jsx. Zero audio files needed for synthesised sounds. `npm run build` → 489
modules, zero errors.**

- **`frontend/src/components/SoundManager.jsx` (new).**
  `SoundManagerProvider` + `useSoundManager()` hook. Single `AudioContext`
  created lazily on the first `mousedown` or `touchstart` on `document` — never
  before (browsers block autoplay). `soundEnabled` persisted to
  `localStorage('starship_sound')` (default `true`). `unlocked` becomes `true`
  after the first gesture. Ambient wind via `HTMLAudioElement` (NOT Web Audio):
  `/assets/sounds/wind-ambient.mp3`, loop, volume 0 → 0.10 over 2 s; pauses on
  `visibilitychange: hidden`, resumes on `visible`; wrapped in try/catch so a
  missing file logs a warning and is silently skipped. Four synthesised sounds
  (all no-ops when `soundEnabled=false` or AudioContext not yet unlocked):
  - `playChime()` — two sine oscillators at 1900 Hz + 1940 Hz (slight detune →
    shimmer), each through its own GainNode (attack 4ms → exponential decay 140ms,
    peak 0.18), both through a shared master GainNode → destination. Total 150ms.
  - `playClick()` — 420 Hz sine (instant ramp → 0.22, decay 40ms) + 210 Hz
    triangle (ramp → 0.10, decay 25ms) → destination. Total 40ms.
  - `playWhoosh()` — 0.4s white-noise `AudioBufferSourceNode` → bandpass filter
    (600 Hz, Q 0.8) → GainNode (ramp 60ms → 0.28, decay 340ms). Produces soft
    airy whoosh.
  - `playHover()` — 1100 Hz sine, peak 0.08, 65ms. Very subtle.
  Also exports `startWind()` — called externally by Landing to trigger the fade-in.

- **`frontend/src/main.jsx`** — `<SoundManagerProvider>` wraps `<AuthProvider>`.

- **`frontend/src/components/index.js`** — barrel exports `SoundManagerProvider`
  and `useSoundManager`.

- **`frontend/src/layouts/AppShell.jsx`** — imports `useSoundManager`;
  `onMouseEnter={playHover}` on the wordmark Link and the profile Link; sound
  toggle button added to the right side of the nav between profile and log-out:
  24×24 inline SVG speaker icon, colour `--stardust`, opacity 0.55 idle → 1.0 on
  hover; two arc paths when unmuted, a slash-through `<line>` when muted. No text
  label, no border, no background. `onClick: toggleSound`.

- **`frontend/src/pages/Assessment.jsx`** — imports `useSoundManager`;
  `playClick()` called in `onLikert` (every BubbleScale selection) and in
  `onMcqSelect` (every MCQ option tap); `playWhoosh()` called in the checkpoint
  `useEffect` alongside `setCheckpoint()` when a CheckpointOverlay fires.

- **`frontend/src/pages/Landing.jsx`** — imports `useSoundManager`; `playChime`
  passed as `onChime` prop to `ConstellationLayer` (the call-site at proximity
  enter already existed); `useEffect` on `unlocked` adds a passive scroll listener
  that calls `startWind()` once `scrollY > window.innerHeight * 0.1`, then removes
  itself.

### Session 20 — Scholarship detail panels + flexible roadmap pathways (2026-06-15)

**Two independent frontend improvements. Backend query extended. `npm run build` → 489 modules, zero errors.**

**PART 1 — Scholarship cards: clickable inline detail panels**
- `score_assessment.py` scholarship SELECT extended to fetch `description`,
  `eligibility_criteria`, `provider`, `stream_tags`, `deadline_month`, `application_url`.
  `matched_scholarships` list now includes all these fields (keyed as `provider_name`,
  `stream_tags`, etc.). Internal engine loop updated to `for name, amount, comp, *_ in …`
  so the extra columns don't break existing tuple unpacking.
- `frontend/src/components/ScholarshipCard.jsx` rewritten:
  - Entire card is now clickable (`cursor: pointer`, chevron indicator; border highlights
    when expanded). Only one card open at a time — controlled by parent via `expanded`/`onToggle`.
  - `AnimatePresence` height-animated inline detail panel in normal document flow below
    the card. Panel: `--deep` bg, `1px --violet` border, shows description, eligibility
    text, provider name, stream tags as violet pills, deadline month, Apply button (if URL).
    Any null/missing field gracefully omitted. Esc key closes the panel.
- `frontend/src/pages/Results.jsx`: `expandedScholarship` state + `toggleScholarship`
  callback added; `ScholarshipCard` usage updated to pass all new detail + control props.

**PART 2 — Roadmap: flexible multi-pathway recommendations**
- No backend or DB changes.
- `frontend/src/pages/Roadmap.jsx`:
  - `AnimatePresence` added.
  - `PATHWAY_ALTERNATIVES` map (6 exam keywords → alternative route arrays):
    JEE, NEET, CLAT, CAT, GATE, UPSC. `getAlternatives(stepText)` scans each step
    case-insensitively.
  - `openPathwayStep` state (one step open at a time).
  - Steps mentioning an exam keyword now show a "▾ Other routes" chevron toggle.
    Expanding reveals the alternative routes as small violet pills via `AnimatePresence`
    `height:auto` animation. Steps without a keyword are unchanged.

### Session 21 — Landing Scenes 2–5 visual rebuild (2026-06-15)

**Visual overhaul of Scenes 2–5 in `frontend/src/pages/Landing.jsx` only. Scene 1,
StarfieldCanvas, and all GSAP ScrollTrigger pin/scrub setups were not touched.
`npm run build` → 489 modules, zero errors.**

**Scene 2 — Pressure:** Background `var(--deep)`. `crowd-pressure.jpg` bottom-aligned
(`max-width: 85vw`, `opacity: 0.45`, `zIndex: 1`). Dark gradient overlay above crowd
(`zIndex: 2`). Constellation dim layer at `zIndex: 3`; copy + figure at `zIndex: 4`.
tl2: `.js-student-back` `rotateX` 0→35 (`transformPerspective: 800`); `.js-student-arms`
`rotate` 0→-110; `.js-student-head` (new class) `rotateX` 0→15.

**Scene 3 — Discovery:** Full-bleed bg removed; `var(--deep)`. Two-column layout:
LEFT 48% = `student-design-sheet.jpg` in glow card (`border-radius: 16`, violet border +
boxShadow); RIGHT 52% = copy (`textAlign: left`, `maxWidth: 420`). Glow pulse
(`gsap.to('.js-scene3-glow', …)`) triggered via `ScrollTrigger.create({ once: true })`.
Mobile: stacks vertically, image on top, `height: 220`, `borderRadius: 12`.

**Scene 4 — Possibility:** No changes. Comment `{/* stargazer image — awaiting asset */}` added.

**Scene 5 — Hope + Contact:** Removed gathering JSX block (CROWD/StandingStudent already
removed). `paddingBottom 0 → 80`. Hope copy + "Start your journey" CTA kept exactly.
Divider `1px rgba(255,255,255,0.06)`. Two-column contact: LEFT 45% `contact-student.jpg`
(`border-radius: 12`, static violet glow border, CSS hover `scale(1.03)`); RIGHT 55%
"Get In Touch" / "Have questions?" / body / `mailto:hello@projectstarship.in` in `var(--aurora)`.

### Session 18 — Landing Scene 1: JPG skyline + interactive ConstellationLayer (2026-06-15)

**Scene 1 of `frontend/src/pages/Landing.jsx` only. Scenes 2–5, StarfieldCanvas,
and the GSAP pull-back ScrollTrigger are untouched. `npm run build` → 488 modules,
zero errors.**

- **Skyline replacement — `SkylineLayers` component (new, Scene 1 only).**
  Removed the deterministic `CitySkyline` SVG (programmatic buildings + `.js-window`
  twinkle) and its `CITY` constant. Replaced with 4 stacked `<img>` tags pointing at
  the existing `.jpg` assets under `/assets/skyline/`: `layer-far.jpg` (distant
  skyline+treeline) → `layer-mid.jpg` → `layer-near.jpg` → `layer-rooftop.jpg`
  (immediate surface). All images are `position:absolute, bottom:0, objectFit:cover`
  within the `.js-city` container (expanded to `height:44%` to cover the full
  bottom-to-rooftop zone). `onError` hides each layer silently — no broken-image
  icons; scene is acceptable with any combination of missing files.
  The `.js-window` ambient GSAP tween was removed (no longer any window elements).
  The `.js-city` GSAP reveal tween in `tl1` (`from autoAlpha:0`) is unchanged.

- **Constellation replacement — `ConstellationLayer` component (new, Scene 1 only).**
  Removed the inline `SKY`, `CONST_LABELS`, and the old `{!isMobile && ...}` block
  that rendered hardcoded geometric `Constellation` SVGs. `Constellation`,
  `CONSTELLATIONS`, and `DIM_SKY` are **kept** — still used in Scene 2.
  `ConstellationLayer` renders the outer wrapper with classes `js-sky-layer` (for the
  existing tl1 reveal tween: `.from('.js-sky-layer', { autoAlpha:0 }, 0.10)`) and
  `js-constellation-layer` (for the new scroll-fade tween added to `tl1` at position
  `0.58`: `.to('.js-constellation-layer', { autoAlpha:0, duration:0.24 }, 0.58)`).
  Inside, `js-depth` carries the cursor-parallax quickTo (unchanged).

  The 5 real SVG files (`/assets/constellations/constellation-{name}.svg`) are
  loaded inline via `fetch()` → `innerHTML` in a `useEffect` so GSAP can reach
  individual DOM elements. Each SVG uses `g.constellation-stars > circle` (star
  nodes) and `g.constellation-lines > line` (connect lines).

  **Idle state:** circles at `opacity:0.35`; `g.constellation-lines` at `opacity:0`;
  each `<line>` gets `stroke-dasharray = stroke-dashoffset = getTotalLength()`.

  **Proximity (< 130 px from bounding-box centre):** circles → `opacity:1` +
  `drop-shadow(0 0 4px rgba(255,255,255,0.9))`; lines draw in via GSAP
  `strokeDashoffset → 0` (duration 0.35, stagger 0.07/line, ease power2.out);
  label `opacity → 1` (200ms). Optional `onChime` prop called if provided.

  **Exit (> 160 px):** lines reverse-draw (`dashoffset → full len`, 0.25s);
  `g.constellation-lines` fades to `opacity:0`; circles back to `0.35`; label `→ 0`.

  **Reduced motion:** no GSAP, no mousemove listener; circles set to `opacity:0.5`,
  lines group permanently `opacity:0`.

  **Positions (left% / top%):** microscope 12/15, airplane 72/8, scales 8/38,
  camera 80/30, stethoscope 45/5.

  The old `mouseenter`/`mouseleave` hover block in `useLayoutEffect` is removed;
  proximity detection is self-contained inside `ConstellationLayer`.

### Session 17 — Data expansion: careers / scholarships / universities (2026-06-15)

**Three new idempotent expansion scripts under `scrapers/`. Scholarships and
universities succeeded; careers generation FAILED this run (0 inserted). Backend
code, engine, and frontend were NOT touched — only the new scripts, the three
target tables (data + additive columns), and these docs.**

- **`scrapers/scholarships_expand.py` (new) — ✅ DONE.** `scholarships` **45 → 96**
  (**51** inserted, 2 already existed). Curated REAL schemes (NOT AI-generated, so
  names/amounts/URLs are accurate): NSP family (CSSS, Post-Matric SC/OBC, Merit-cum-Means
  & Pre-Matric minorities, Top Class SC), AICTE Pragati/Saksham/Swanath, DST INSPIRE,
  PMSS, Ishan Uday, IG single-girl-child, HDFC Parivartan ECSS, Tata Capital Pankh,
  Buddy4Study, Reliance/Sitaram Jindal/Aditya Birla/Vidyasaarathi/FFE, 14 state schemes
  (MH, TN, KA, UP, WB, RJ, GJ, BR, KL, MP, TG, AP, PB, OD), Khelo India + GoSports,
  CBSE/Begum Hazrat Mahal/L'Oreal girl-child, NMMSS/NTSE, ONGC/Airtel/Mahindra/IOCL.
  Mix: government 34 / private 11 / ngo 6. Added via `ADD COLUMN IF NOT EXISTS`:
  `description`, `amount_min_inr`, `eligibility_criteria`, `deadline_month`,
  `stream_tags TEXT[]`, `provider_type`, `data_source`. New rows tagged
  `data_source='curated'`. **Idempotent via case-insensitive existence check** — there is
  NO unique constraint on `scholarship_name` (PK only), so `ON CONFLICT (name)` is
  impossible; SELECT-before-INSERT + per-batch commit is the safe equivalent.

- **`scrapers/universities_expand.py` (new) — ✅ DONE.** `universities` **9,550 → 9,718**
  (**168** inserted — India 123, Abroad 45 — 301 of the 469 curated entries already existed
  and were skipped). Curated REAL institutions: all IITs (23), NITs (31), IIITs (25),
  IIMs (20), IISERs/IISc (8), NLUs (22), AIIMS + top medical (22), 45 central universities,
  50 state universities, 40 private/deemed (BITS, VIT, SRM, Manipal, Amity, Symbiosis,
  Christ, Ashoka, Thapar, etc.), 29 specialist (NID/NIFT/SPA/FTII/IIMC/XLRI/SPJIMR/DTU/ISI/
  IMU), 15 agri/open; abroad — USA (50), UK (28), Canada (18), Australia (15), Singapore (4),
  Germany (12), UAE (7), Hong Kong (5). Per row: name, city, state (NULL for abroad),
  country, nirf_rank (where known), total_annual_cost_inr (abroad tuition converted to INR),
  normalized_name, `data_source='curated'`. **Idempotent via case-insensitive existence
  check** — NO unique constraint on `university_name` and the table already held **326
  duplicate names**, so `ON CONFLICT (name)` was impossible. Batches of 50, commit per batch.
  Existing 514 costed rows untouched (existence check skips them).

- **`scrapers/careers_expand.py` (new) — ✅ DONE (re-run Session 17B).** `career_profiles`
  **25 → 221** (**196 inserted**, 0 skipped batches). Root cause of the original 0-insert
  failure was BATCH_SIZE=20 causing Cohere JSON truncation. Fixed by lowering
  `BATCH_SIZE` to **4** and adding a retry loop (up to 2 retries per batch) + 1.5s
  inter-batch sleep. All 49 batches parsed cleanly — zero retries needed. The script is
  engine-safe (populates all required columns on the 1–5 scale, derives `country_salary`
  deterministically for 9 regions, idempotent via existence check + per-batch commit).
  `data_source` breakdown: `ai_generated` 196 · `manual` 25.

### Session 16 — Aptitude score normalization fix (2026-06-14)

**Bug fixed in `score_assessment.py`. No frontend or DB changes. Build: 488 modules, zero errors.**

- **Root cause:** The normalization denominator was `question_counts[trait] * 5` for ALL traits,
  treating every question as having a maximum option_value of 5. MCQ aptitude questions
  (the 50 objective items) have option_value ∈ {0, 1}, so their max is 1, not 5. This
  caused aptitude scores to be reported at 1/5 = 20% of their true value, e.g.
  `{numerical 14.67, logical 16.0, verbal 14.0, analytical 16.0}` at ~75% accuracy instead
  of the correct `{numerical 73.33, logical 80.0, verbal 70.0, analytical 80.0}`.

- **Fix:** Added `max_possible_scores = defaultdict(float)`. In the accumulation loop, each
  question/trait pair now contributes `(1.0 if question_type == 'mcq' else 5.0) * weight`
  to `max_possible_scores[trait_name]`. The normalization step now divides by
  `max_possible_scores[trait]` instead of `question_counts[trait] * 5`.

- **Scope:** Only the normalization denominator changed. Raw score accumulation, RIASEC
  scoring, behavioral traits, career matching, and all other engine logic are untouched.
  RIASEC scores before/after: unchanged (`{R:62.86, I:82.86, A:71.43, S:80.0, E:60.0,
  C:71.43}`). All 12 result keys present and unchanged.

- **Frontend (`aptitudeMatch.js`):** no changes required. RIASEC_APTITUDE_WEIGHTS already
  sum to 1.0 per trait, so `getAptitudeMatch()` correctly returns 0–100 when given
  correctly-ranged aptitude_scores. The Dashboard and Careers aptitude bars now reflect
  real 0–100 values.

### Session 10 — Dashboard + Careers + counselor prominence + bubble tooltips (2026-06-14)

**Five frontend tasks plus a small ADDITIVE backend surfacing, all verified live
(backend :8000 + Vite :5173, real student 12 "Rahul Sharma"). `npm run build`
→ 486 modules, zero errors.**

**Backend — engine result surfacing (`score_assessment.py` only; `api.py` untouched)**
- `run_career_engine` now returns two ADDITIVE keys (already-computed values, NO
  recomputation, all logging preserved):
  - `aptitude_scores` — `{ numerical_reasoning, logical_reasoning,
    verbal_reasoning, analytical_reasoning }` (0–100 floats, from the existing
    aptitude-summary step).
  - `career_categories` — `{ career_name: primary_trait_letter }` (the
    `primary_trait` the matching loop already reads from `career_profiles`).
- Both reach the frontend verbatim under the `results` key of `/submit-assessment`
  and `/results` (api.py returns the engine result as-is) — so the aptitude
  sub-scores are surfaced through api.py's response with zero recomputation.
- Verified live: `GET /results` for s12 carries both; aptitude `{numerical 14.67,
  logical 16, verbal 14, analytical 16}`; 25/25 careers mapped to a RIASEC letter.

**TASK 1 — results in AuthContext (`context/AuthContext.jsx`, `Assessment.jsx`, `Results.jsx`)**
- AuthContext gains `results` + `setResults`. On mount, after the `/profile`
  rehydrate, a completed student's results are restored via a **bare-axios**
  `GET /results` (same no-redirect-on-mount pattern as the profile call); cleared
  on logout.
- Assessment: after `/submit-assessment` 200 → `setResults(data.results)`, then the
  cinematic transition navigates to **/dashboard** (was /results). The throwaway
  `resultsData` router-state hand-off was removed.
- Results: reads AuthContext `results` first, then `location.state`, then a
  self-fetch `GET /results` (which now also hydrates context).

**TASK 2 — Dashboard (`pages/Dashboard.jsx`, new; `/dashboard`, protected)**
- Sections: welcome ("Welcome back, {first}." / "Your future is clearer than
  yesterday."), top-3 careers (`CareerCard` + per-card **Interest Match %**
  [`scoreToPercent(score)`] + **Aptitude Match %** [weighted per RIASEC trait via
  `getAptitudeMatch`] + RIASEC category badge), RIASEC radar (size **280**) +
  strongest-areas list, four aptitude bars (Numerical/Logical/Analytical/Verbal
  from `aptitude_scores`), quick links (→/careers, →/results), Starship Scholars teaser.
- Data from AuthContext `results` with a self-fetch fallback (covers fresh login);
  loading / empty(→/onboarding) / error(retry) gates mirror Results. Relies on
  AppShell's dimmed StarfieldCanvas (no duplicate canvas).
- Completed-student redirects in `Onboarding.jsx` + `Assessment.jsx` now → /dashboard.

**TASK 3 — Careers (`pages/Careers.jsx`, new; `/careers`, protected)**
- Full ranked `career_matches`, client-side name search, and a RIASEC-category
  filter (chips built from the `career_categories` letters present, R-I-A-S-E-C
  order, `CategoryBadge` + `RIASEC_COLORS`). Each card = `CareerCard` +
  Interest/Aptitude % (per-career weighted), click → /roadmap. Keeps the floating
  `CounselorOrb`.
- Verified live: "engineer" → Mechanical/Civil/Software Engineer; Investigative
  filter drops Mechanical (Realistic), keeps Doctor/Data Scientist/Software Eng.

**TASK 4 — counselor prominence (`components/AIOrb.jsx`, `components/DashboardCounselor.jsx` new)**
- AIOrb gained optional **CONTROLLED** `open`/`onOpenChange` + `draft`/`onDraftChange`
  props. With none passed (every existing `CounselorOrb` usage), behaviour is
  identical — so the floating orb on all other pages is unchanged.
- `DashboardCounselor` renders the prominent card (top-right on desktop, wraps
  below the welcome header on mobile): "Your AI Counselor" / "Ask me anything about
  your results." + input + send, with a slow **3s `--violet`** border-glow pulse.
  Card send opens the controlled AIOrb panel with the typed message
  **pre-populated** in its input; chat wired to POST /chat like `CounselorOrb`.
- Verified live: card send opens the panel pre-filled and clears the card input.

**TASK 5 — bubble tooltips (`components/BubbleScale.jsx` only)**
- Per-bubble hover/tap tooltips above each bubble (1 "Not really me" · 2 "A little
  like me" · 3 "Sometimes" · 4 "Quite like me" · 5 "That's me"): dark rounded box
  (radius 8, `1px rgba(200,184,255,.3)`, `rgba(6,7,26,.92)` + `blur(8px)`,
  fs-body-sm, white, padding `6px 12px`, down arrow, z-index 50), Framer fade 0.15s.
  Touch shows the tooltip 400ms before the tap registers (guarded against the
  trailing synthetic click + emulated mouseenter). Bubble values / option_ids /
  submission logic and the "Not me" / "That's me" end labels are UNCHANGED.
- Verified live (real assessment, throwaway student): every tooltip style value
  matched spec exactly; tooltip follows the hovered bubble; end labels intact.

**Carry-forward (Session 10)**
- AuthContext now OWNS `results`; completed students land on **/dashboard** (not
  /results — still reachable via the quick link).
- Engine result carries `aptitude_scores` + `career_categories` (additive; api.py
  verbatim passthrough). `run_career_engine` is still read-only.
- `AIOrb` is controllable via `open`/`draft` props (backward compatible — pass
  nothing for the old uncontrolled floating-orb behaviour).

### Session 12 — Re-take assessment flow (2026-06-14)

**End-to-end flow for a completed student to clear and re-take the assessment.
Backend: `api.py` only. Frontend: `Profile.jsx` + `Dashboard.jsx`.
`npm run build` → 487 modules, zero errors.**

- **`DELETE /assessment` (`api.py`, JWT-protected, new):** deletes all
  `assessment_sessions` rows for the student — the `ON DELETE CASCADE` FK to
  `student_question_responses_v2` removes response rows automatically. Pops
  `LATEST_RESULTS[student_id]` from the in-memory cache. Returns
  `{"status": "cleared"}`. A 404 is returned if the student record doesn't exist.
- **`pages/Profile.jsx`:** replaced the old plain text link with a proper re-take
  flow. A coral outline button ("Re-take assessment") triggers an inline confirmation
  box. The confirmation copy: "This will clear your results and career matches.
  This cannot be undone." Buttons: "Yes, re-take" (coral outline) + "Cancel".
  On confirm: `DELETE /assessment` → `setResults(null)` → `setStudent` marks
  `has_completed_assessment: false` → `navigate('/assessment')`. The wrapper div
  always has `min-height: 112px` so the layout doesn't jump when the button
  swaps for the confirmation box. No `position: fixed`.
- **`pages/Dashboard.jsx`:** small text link at the very bottom of the page
  ("Want to start fresh? Re-take the assessment →", coral). Same inline
  confirmation pattern (min-height: 116px, violet border, dark card). Identical
  `handleRetake` logic: `DELETE /assessment` → clear context → navigate.

### Session 11 — Per-career weighted aptitude match (2026-06-14)

**Pure frontend change. No backend or score_assessment.py touched.
`npm run build` → 487 modules, zero errors.**

- **`frontend/src/utils/aptitudeMatch.js`** (new) — exports `getAptitudeMatch(career_name,
  career_categories, aptitude_scores)` returning 0–100. Uses RIASEC-primary-trait weights:
  R: numerical 60%/logical 40%; I: logical 50%/analytical 30%/numerical 20%;
  A: verbal 60%/analytical 40%; S: verbal 70%/analytical 30%;
  E: verbal 50%/logical 30%/analytical 20%; C: numerical 50%/analytical 30%/logical 20%.
  Falls back to a flat mean if the career has no category mapping.
- **`pages/Dashboard.jsx`** — top-3 career cards now call `getAptitudeMatch(name, …)`
  per card instead of the global flat mean. The module-level `aptitudeAverage` helper
  and `aptAvg` memo are removed.
- **`pages/Careers.jsx`** — same replacement across the full ranked career grid.
  `aptitudeAverage` + `aptAvg` removed.
- Result: each career card shows a **distinct** Aptitude % that reflects the cognitive
  profile that matters most for that career's Holland code, rather than the identical
  flat mean shown on every card before.

### Session 14 — Data router migration + back-nav guard (2026-06-14)

**Pure frontend change. No backend or engine touched.
`npm run build` → 488 modules, zero errors (count unchanged).**

**Why**: `useBlocker` (React Router v6 data API) requires `createBrowserRouter` /
`RouterProvider`. The app was on `BrowserRouter`, which doesn't expose the blocker API.

**`frontend/src/main.jsx`**
- Removed `BrowserRouter` import and wrapper. `AuthProvider` still wraps `<App />` (safe:
  `AuthProvider` uses no router hooks — it calls bare `axios` directly for `/profile` and
  `/results` rehydrate).

**`frontend/src/App.jsx`**
- Replaced `<Routes>` with `createBrowserRouter([…])` + `export default function App() { return <RouterProvider router={router} />; }`.
- Route tree is byte-identical to the old `<Routes>` tree:
  - Public: `/`, `/how-it-works`
  - Auth: `/login`, `/register`, `/verify-otp`, `/forgot-password`, `/reset-password`
  - Protected (nested `<ProtectedRoute>` → `<AppShell>`): `/onboarding`, `/assessment`,
    `/dashboard`, `/careers`, `/results`, `/roadmap`, `/profile`
  - Catch-all: `*` → `<Navigate to="/" replace />`

**`frontend/src/pages/Assessment.jsx`**
- Added `useBlocker` to the react-router-dom import.
- Added `unsavedChanges` to the `useNavGuard()` destructure (was only `setUnsavedChanges`).
- `const blocker = useBlocker(unsavedChanges)` — activates whenever the student has saved
  at least one answer and hasn't submitted yet (the exact window to protect).
- Early-return render path: when `blocker.state === 'blocked'` → renders **`BlockerModal`**
  (new sub-component at the bottom of the file). The modal sits between the `showTransition`
  check and the main assessment JSX, so it can only appear while the assessment is active.
- **`BlockerModal`** design (matches Session 12 re-take modal style):
  - **Normal-flow faux-viewport** — outer `div` has `minHeight: calc(100vh - 58px)`,
    `background: rgba(4,6,26,0.88)`, `backdropFilter: blur(4px)`. No `position:fixed`.
  - Inner card: `width: min(420px, 100%)`, `background: var(--deep)`,
    `border: 1px solid var(--violet)`, `borderRadius: var(--radius-card)`,
    `boxShadow: 0 0 40px rgba(91,82,184,0.30)`.
  - Copy: *"If you go back now, your progress will be lost."*
  - Buttons: **"Stay"** (violet filled, `autoFocus`) → `blocker.reset()`;
    **"Leave anyway"** (outline) → `blocker.proceed()`.
  - `Esc` key also triggers Stay (via `useEffect` + `keydown` listener).
- **NavGuardContext + ConfirmLeaveModal untouched.** The two guards are complementary:
  NavGuard handles SPA navigation via AppShell shell controls (wordmark/profile/logout);
  `useBlocker` handles the browser Back button and any other programmatic navigation
  away from `/assessment`. Both key off `unsavedChanges`.

### Session 13 — Country-specific salary data on Roadmap (2026-06-14)

**Backend: additive schema + query change. Frontend: new util + Roadmap rewrite.
`npm run build` → 488 modules, zero errors.**

**Schema & data (`migrations/006_country_salaries.sql` — applied; do NOT re-run)**
- Added `country_salary JSONB` column to `career_profiles` (`ADD COLUMN IF NOT EXISTS`).
- Populated for all **25** careers × **9 regions**: India (IN), USA (US), UK (GB),
  Canada (CA), Australia (AU), Singapore (SG), Hong Kong (HK), UAE (AE), Europe (EU).
- Schema per entry: `{ min_inr, max_inr, min_local, max_local, currency_symbol,
  currency_code, growth_outlook }`. India entry matches the existing `salary_min_inr` /
  `salary_max_inr` columns exactly. Figures are realistic mid-career absolutes, NOT
  currency conversions of the India figure (e.g. US Doctor $200k–$350k, not a ₹→$ swap).
  `growth_outlook` is country-specific — e.g. Software Engineer is "Very High" in US/SG/CA,
  "High" in IN/GB/AU. "Very High" is a new valid outlook value (joins High/Moderate/Low).
- Migration uses PostgreSQL dollar-quoting (`$json$...$json$::jsonb`) for clean JSONB
  literals. Built-in DO block confirms 0 missing rows; migration verifies itself.

**API (`api.py` `/career-roadmap` — minimal additive change)**
- SELECT now includes `country_salary`; the result dict carries it under the same key.
  `career_details[career_name].country_salary` is the JSONB keyed by country code.
  No other endpoints changed.

**Frontend**
- **`frontend/src/utils/salaryData.js`** (new) — exports `COUNTRIES` (9-item array:
  `{ code, label, flag, currencySymbol, currencyCode }`) and `getSalaryForCountry(
  careerName, countryCode, careerDetails)` which reads `career_details[name].country_salary[code]`.
- **`pages/Roadmap.jsx`** rewritten (additive; structure unchanged):
  - `selectedCountry` state (default `'IN'`).
  - Horizontal pill-toggle (9 country chips with flag emoji) above the salary section.
    Active chip: `--violet` border glow + tinted background; no heavy shadows.
  - Salary display: India → full Indian number format `₹X,XX,XXX – ₹Y,YY,YYY / year`
    (unchanged). Other countries → `$120k–$200k/yr  or  ₹1.01Cr–₹1.68Cr/yr`
    (local compact + INR compact with Cr/L suffixes). Falls back to `salary_min_inr`/
    `salary_max_inr` columns when `country_salary` is absent.
  - `OutlookBadge` updated: "Very High" → `--glow` (teal), added alongside existing
    High/Moderate/Low colours. Badge reflects the selected country's `growth_outlook`.
  - Disclaimer line below the salary figures: *"Figures are approximate mid-career
    estimates and vary by employer, city, and experience."*
- Verified: build passes (488 modules, 0 errors). No runtime console errors on preview.

### Session 15 — University cutoffs expansion (2026-06-14)

**`university_cutoffs` went from 3 hand-seeded rows to 507 (504 AI-estimated + 3 manual)
spanning 49 universities — and, crucially, the data is now actually consumable by the
engine's admissions-guidance join. Backend code (engine / api.py) and the frontend were
NOT touched; only `scrapers/university_cutoffs.py` (new), the `university_cutoffs` + `exams`
tables (data), and these docs changed.**

- **Engine binding (verified before writing).** `score_assessment.py` reads cutoffs via
  `JOIN exams e ON uc.exam_id=e.exam_id WHERE u.university_name=… AND e.exam_name=
  career_profiles.required_exam AND uc.field_id=programs.field_id`, plus a second
  `competitiveness_level` lookup by `university_name`. So a cutoff is only ever read if its
  `exam_id` resolves to an `exam_name` that EXACTLY equals a `career_profiles.required_exam`
  string AND its `field_id` is a `programs.field_id`. Unique key:
  `(university_id, exam_id, field_name)`.
- **`scrapers/university_cutoffs.py` (new).** Pipeline:
  1. `ensure_schema` — `ADD COLUMN IF NOT EXISTS university_cutoffs.data_source
     VARCHAR(30)`; the 3 pre-existing rows tagged `'manual'`.
  2. `ensure_exams` — the `exams` table only shipped 4 rows, but the engine's
     `required_exam` values are mostly compound strings ("JEE Main / JEE Advanced",
     "JEE / GATE (optional)", "CLAT", "CA Foundation", …) that weren't in it, so cutoffs
     keyed to them would be DEAD data. The scraper idempotently seeds `exams` with every
     exam_name the engine queries (**20 newly seeded**, 2 already present;
     `exam_type='entrance'`, `country='India'`). The exam/field anchors were derived
     directly from the live `(programs.field_id, career_profiles.required_exam)` pairs.
  3. Per university, Cohere (`command-r-plus-08-2024`, `cohere.ClientV2`) returns which
     broad categories it offers + `(min_board_percentage, min_exam_score,
     competitiveness_level 1–5)` per category; each is expanded into its concrete leaf
     `(field_id, field_name, exam_name)` rows and written with
     `INSERT … ON CONFLICT (university_id, exam_id, field_name) DO NOTHING,
     data_source='ai_estimated'`.
- **Safety / idempotency:** `ON CONFLICT DO NOTHING` never overwrites; exams seeding is
  insert-if-absent; commits **per university** so a Cohere rate-limit can't lose earlier
  work and a re-run resumes (universities that already have cutoffs are skipped). Targets
  the **top 50 costed universities ordered by name** (`--limit` configurable).
- **Run result:** 504 rows inserted across 46 universities; 4 (Alagappa, B. R. Ambedkar
  Bihar, Banasthali, Bankura) returned an unparseable Cohere format and were skipped — a
  re-run retries them. Final: **507 cutoff rows, 49 distinct universities, competitiveness
  1–5, avg board ≈ 62%.**
- **Verified:** the engine's exact join returns real rows for sampled
  university/exam/field combos (e.g. Aligarh + "JEE Advanced" + field 7 →
  `(85,150,4,'ai_estimated')`; Amrita + "NEET UG" + field 10 → `(85,600,5,…)`); the
  `competitiveness_level`-by-name lookup also resolves. A reachability check (cutoffs whose
  `(exam,field)` is queried by ≥1 career) returns a healthy count, confirming the rows are
  wired to the engine, not orphaned.

### Session 22 — Global UI polish pass (2026-06-15)

**Pure visual/spacing pass. No behaviour changes, no component deletions, no backend
changes. `npm run build` → 489 modules, 0 errors (unchanged count).**

**Task 1 — Button audit (all authenticated pages)**
- New tokens added to `frontend/src/styles/tokens.css`:
  `--radius-md: 10px` (standard interactive border-radius),
  `--btn-py: 10px`, `--btn-px: 20px`, `--btn-py-sm: 6px`, `--btn-px-sm: 16px`,
  `--moonstone: rgba(255,255,255,0.55)`.
- Every button/pill across all pages migrated from `--radius-pill` → `var(--radius-md)`
  and from ad-hoc padding → `var(--btn-py) var(--btn-px)` (default) or
  `var(--btn-py-sm) var(--btn-px-sm)` (small/secondary).
- Hover states: opacity shift to 0.88 (primary) or inline `onMouseEnter/Leave` opacity on
  ghost/outline buttons. No colour inversion anywhere.
- Files touched: `AuthShell.jsx`, `AppShell.jsx`, `Assessment.jsx`, `Dashboard.jsx`,
  `Careers.jsx`, `Results.jsx`, `Roadmap.jsx`, `Profile.jsx`, `HowItWorks.jsx`.

**Task 2 — Landing below-fold layout pass (Scenes 2–5)**
- Copy blocks capped at `maxWidth: 600` on Scenes 2–5 (was 560–680); all centered with
  `margin: '0 auto'` and responsive padding via `clamp()`.
- `Landing.jsx` TopBar "Begin" link: upgraded from a plain caption link to a `--violet`
  filled button with `var(--radius-md)` and a `--glow-violet` box-shadow on hover (no fill
  change on hover). `useState` for hover state already present in the component.

**Task 3 — Auth pages warmth (`AuthShell.jsx` only)**
- Added atmospheric radial gradient overlay behind the card:
  `radial-gradient(ellipse at 50% 0%, rgba(83,74,183,0.12) 0%, transparent 70%)`.
- Card border changed to `1px solid rgba(255,255,255,0.08)` + `boxShadow: 0 0 40px rgba(83,74,183,0.15)`.
- STARSHIP wordmark: `fontSize: clamp(1.1rem, 2vw, 1.4rem)`, `letterSpacing: 0.12em`,
  `color: var(--stardust)`, `fontWeight: var(--fw-medium)`.
- `SubmitButton`: padding → `10px 20px`, radius → `var(--radius-md)`, hover opacity 0.88.

**Task 4 — Typography rhythm**
- Section headings: `margin-bottom: 1.5rem` before first paragraph (was `22–26px`).
- Body copy: `lineHeight: 'var(--lh-body)'` (1.8) everywhere — all `lineHeight: 1.6`,
  `1.7`, and `1.8` literals replaced with the token.
- Card titles (`CareerCard.jsx`): `fontSize: 18` → `var(--fs-body)` (fw 500 kept).

**Task 5 — Mobile spacing (375px)**
- Dashboard + Careers card gaps: `18` → `clamp(12px, 3vw, 18px)` (12px at 375px).
- Roadmap country pill-toggle: `flexWrap: 'wrap'` → `flexWrap: 'nowrap', overflowX: 'auto',
  scrollbarWidth: 'none'` so all 9 chips scroll horizontally without wrapping on mobile.
- `HowItWorks.jsx`: added `useIsMobile()` hook; `SpotIllustration` size `132` → `isMobile ? 80 : 132`.

## In Progress
**Phase 7B — DONE (university costs, programs expansion, token refresh). Phase 6
(frontend funnel, 6A–6C) and Phase 7A (career roadmap data) are also DONE.** No phase is
actively in progress; the remaining items are optional / non-blocking. Handoff context is
in `docs/CURRENT_PHASE.md`.
- ✅ Done: Vite/React scaffold, design tokens, `api/client.js`, 13-component library,
  react-router, and the immersive public **Landing** (Session 6B.1, verified).
- ✅ Question bank consolidated (2026-06-12): assessment_questions_v2 is sole source of
  truth (155 questions). frontend/src/data/questions_v2.json exported from DB.
  run_aptitude_test.py repointed to v2 tables. v1 tables voided. GET /questions returns
  id (= question_id); POST /submit-answer consumes question_id — same value.
- ✅ Done (6B): auth context + `<ProtectedRoute>` + `AppShell`, CORS wiring, auth pages
  (Login/Register/OTP/forgot/reset — Google OAuth UI skipped), Onboarding, Assessment
  (155 q, dual-mode BubbleScale + mcq picker), Results (RIASECRadar/CareerCard/
  ConstellationMap/University cards/StatCounter), Career roadmap, AI Counselor
  (`CounselorOrb` → `/chat`), Profile. `/onboarding` is now the real page.
- ✅ Done (6C): real `riasec_scores` + `scholarships` wired into Results (confidence-band
  derivation and the scholarships placeholder both removed); real `/how-it-works` page
  (`HowItWorks.jsx`) replaces the placeholder; `/gallery` route + `Gallery.jsx` deleted.
  **Every route now points at a real page.**
- ✅ Done (post-6C cleanup): ScholarshipCard hides apply button when URL absent; Dropper
  workaround removed; budget_max_inr added to profile PATCH.
- ✅ Done (7B): university **cost** data (514 rows costed via curated + AI), **programs**
  expansion (8 → 82, all 25 careers mapped, 40 fields), and **token-refresh-on-401**
  (silent refresh + single-flight queue, verified live).
- ✅ Done (Session 15): university **cutoffs** expanded 3 → **507 rows** (504 AI-estimated,
  49 universities) via `scrapers/university_cutoffs.py`; the `exams` table seeded so the
  cutoffs are engine-consumable. The Phase 4 admissions-guidance gap is cleared.
- ⏳ Still open (optional / non-blocking): the optional **Admin UI**; cutoffs long tail
  (re-run the scraper with a higher `--limit` to extend beyond the top 50).
- Landing polish backlog (minor): mobile hero copy is tall and slightly meets the city
  skyline at ≤375px; desktop pull-back is the primary, tuned experience.

## Not Started
- **Optional / non-blocking leftovers:** the optional **Admin UI** (`/admin/students` +
  `/admin/students/{id}`, gated by `X-Admin-Key`). University **cutoffs** — ✅ DONE
  (Session 15): 3 → 507 rows via `scrapers/university_cutoffs.py`.
- **Backend niceties surfaced earlier — DONE (post-6C cleanup):** `/start-assessment` now
  accepts `'Dropper'`; `PATCH /profile` now has a `budget_max_inr` write path.
  NOTE: scholarships + numeric RIASEC scores are already in the `/submit-assessment`
  payload — wired into Results in 6C.
- **Phase 7A — DONE:** the `career_profiles` salary/education/recruiters/outlook migration
  (004 + 004b) is applied, `/career-roadmap` returns the detail, and `Roadmap.jsx` renders it.
- **Phase 7B — DONE:** university **cost** data (514 rows; `scrapers/university_costs.py`),
  **programs** expansion (8 → 82; `migrations/005_programs_expansion.sql`), and
  **token-refresh-on-401** (`frontend/src/api/client.js`). University **cutoffs** remain a gap.

## Data gaps (priority order)
1. University **cutoffs**: ✅ **DONE (Session 15)** — 3 → **507 rows** (504 AI-estimated, 49
   universities) via `scrapers/university_cutoffs.py`; the `exams` table was seeded so the
   cutoffs are engine-consumable (admissions guidance works). Re-run with a higher `--limit`
   to extend past the top 50. `university_field_strength` (16 rows) and
   `university_exam_requirements` are still sparse, so the engine still leans on its
   budget+state fallback for the long tail.
2. University **cost** — ✅ **mostly DONE (Phase 7B)**: 514 of ~9,550 rows costed (top ~500
   by name recognition / NIRF). Long tail still NULL; re-running `scrapers/university_costs.py`
   extends coverage (incl. NIRF `city`/`state`/`rank` once nirfindia.org is reachable — it
   returned 504 on the 7B run). Only 229/514 costed rows have `state` (curated set); the
   AI-estimated long tail mostly lacks it, so the non-relocating state filter favours the curated rows.
3. Programs — ✅ **DONE (Phase 7B)**: 8 → 82, all 25 careers mapped, 40 fields.
4. Career profiles salary + education_path — ✅ DONE (Phase 7A: migrations 004/004b;
   salary, education_path, top_recruiters, growth_outlook populated for all 25 + rendered in Roadmap)
5. Scholarships: 6 likely-real state schemes not yet verified/inserted (TN, Punjab, Manipur, NTPC, Vidyasaarathi, Byju's defunct)
