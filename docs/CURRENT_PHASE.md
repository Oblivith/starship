# Current Phase: SESSION 58 — Code splitting + performance (lazy loading, starfield worker, meta tags, robots.txt) — COMPLETE

## Status: SESSION 58 DONE. Sessions 1–57 also DONE.

**Changed: `frontend/src/App.jsx`, `frontend/src/components/StarfieldCanvas.jsx`,
`frontend/src/workers/starfield.worker.js` (new), `frontend/vite.config.js`,
`frontend/index.html`, `frontend/public/robots.txt` (new).
`npm run build` → 499 modules, 0 errors. 30+ separate chunks confirmed.**

### STEP 1 — React.lazy for Landing + Suspense wrapper
- Landing was the only statically-imported page in `App.jsx`. Converted to
  `React.lazy(() => import('./pages/Landing.jsx'))`.
- `<RouterProvider>` wrapped in `<Suspense fallback={<LoadingScreen />}>`.
  `LoadingScreen` imported normally (not lazy — it IS the fallback).
- All other pages already used the data router's `lazy` property (session 6A pattern);
  that approach is kept intact to avoid the "suspended while responding to synchronous
  input" warning that React.lazy + Suspense triggers inside a data router.
- **Build result:** `Landing-*.js` (158.68 kB) is now its own lazy chunk.

### STEP 2 — StarfieldCanvas off main thread (Web Worker + OffscreenCanvas)
- New `frontend/src/workers/starfield.worker.js` — receives
  `{ type:'init', canvas, width, height, dpr, density, reduceMotion, shootingStars, glowColor }`
  via `postMessage`, runs the three-layer star + shooting-star animation loop on an
  `OffscreenCanvas` using `requestAnimationFrame`. Also handles `resize`, `mousemove`,
  and `stop` messages.
- `StarfieldCanvas.jsx` — detects `typeof OffscreenCanvas !== 'undefined'` at runtime.
  If supported: `canvas.transferControlToOffscreen()` + `new Worker(new URL(...), {type:'module'})`;
  ResizeObserver + mousemove handlers postMessage to the worker instead of drawing directly.
  If NOT supported (Safari < 17, old Firefox): falls back silently to the existing
  main-thread `requestAnimationFrame` loop — zero visible difference.
- `vite.config.js` — added `worker: { format: 'es' }` so the worker chunk is bundled
  as an ES module.
- **Build result:** `starfield.worker-*.js` (2.69 kB) emitted as a separate chunk.

### STEP 3 — OG / SEO meta tags in index.html
Six tags added inside `<head>`:
`og:title`, `og:description`, `og:type`, `twitter:card`, `robots`, `canonical`.

### STEP 4 — /public/robots.txt
Created `frontend/public/robots.txt`:
- `Allow: /` (public pages crawlable)
- `Disallow: /dashboard`, `/assessment`, `/results`, `/admin` (auth-gated; no SEO value)

---

# Current Phase: SESSION 57 — Admin UI (/admin + /admin/students/:id) — COMPLETE

## Status: SESSION 57 DONE. Sessions 1–56 also DONE.

**New `frontend/src/pages/Admin.jsx` + `frontend/src/pages/AdminStudent.jsx`;
updated `frontend/src/App.jsx`. `npm run build` → 499 modules, 0 errors.**

### Admin.jsx (`/admin`)
- Public route, key-gated (not JWT). Password input → stores key in `sessionStorage('starship_admin_key')`.
- Fetches `GET /admin/students?limit=500` with `X-Admin-Key` header (raw `fetch`, not the JWT axios client).
- 401/403 → clears sessionStorage, shows "Invalid admin key", back to lock screen.
- Table: Name, Email, Phone, Class, State, Assessment (is_verified badge), Top Career (—), Score (—), Last Login.
- Client-side search by name/email; sort by name / email / last_login (clickable headers, asc/desc toggle).
- Row click → `/admin/students/{id}`. Sign-out button clears sessionStorage.

### AdminStudent.jsx (`/admin/students/:id`)
- Fetches `GET /admin/students/{id}` with `X-Admin-Key` from sessionStorage.
- No key → redirect `/admin`. 401/403 → clear key + redirect. 404 → error message.
- Profile grid: student_id, name, email, phone, class, state, income, is_verified badge, last_login.
- Placeholder sections (dashed border empty notes) for Assessment Results, Top 5 Career Matches,
  Scholarship Matches — pending a backend admin-results endpoint.
- Back button → `/admin`.

### App.jsx
- Two new public lazy routes added (above auth block):
  `/admin` → `Admin.jsx`, `/admin/students/:id` → `AdminStudent.jsx`.

---

# Current Phase: SESSION 56 — Frontend error + empty states across all authenticated pages — COMPLETE

## Status: SESSION 56 DONE. Sessions 1–55 also DONE.

**New `frontend/src/components/ErrorState.jsx` + `EmptyState.jsx`; updated barrel + Dashboard,
Results, Careers, Roadmap, Assessment, Login, api/client.js. `npm run build` → 497 modules, 0 errors.**

### ErrorState + EmptyState components
- `ErrorState` — dark card (480px max, compass SVG icon ~40px violet, title 17px fw-medium, message
  `--fs-body-sm`/`--moonstone`, optional "Try again" outline button).
- `EmptyState` — same card, dashed border, optional star/compass/map SVG icon, no retry.
- Both exported from `components/index.js` barrel.

### Per-page error/empty handling
- **Dashboard** — network error → `<ErrorState onRetry>`, empty career_matches → centred `<EmptyState icon="star">`.
- **Results** — fetch error → `<ErrorState onRetry>`; scholarships empty → inline `<EmptyState icon="star">`; universities empty → inline `<EmptyState icon="map">`.
- **Careers** — fetch error → `<ErrorState onRetry>`; filtered-empty → `<EmptyState icon="compass">` with context-aware message.
- **Roadmap** — error AND missing career_details each → `<ErrorState onRetry={fetchRoadmap}>`; edu-steps empty → `<EmptyState icon="map">`.
- **Assessment** — questions-fetch error → full-page `<ErrorState onRetry={refetchQuestions}>`; session-gate failure → inline top banner (above `<ProgressBar>`, no full-page takeover); submit failure → inline banner, does NOT navigate away.

### api/client.js 401 double-refresh
- Already handled (`isRefreshCall` guard). Extended: `redirectToLogin(reason)` appends `?reason=...`; double-401 + refresh failure pass `'session_expired'`. Login.jsx reads `?reason=session_expired` via `useSearchParams` and pre-fills error state with "Your session has expired. Please sign in again."

---

# Current Phase: SESSION 55 — LoadingScreen simplified to single pulsing star — COMPLETE

## Status: SESSION 54 DONE. Sessions 1–53 also DONE.

**`ai_chat.py`, `api.py` (`/chat`), `frontend/src/components/CounselorOrb.jsx`,
`frontend/src/components/AIOrb.jsx`, `frontend/src/pages/Roadmap.jsx`. `npm run build` → 493
modules, 0 errors. `python3 -m py_compile ai_chat.py api.py` clean.**

### BUG A — counselor answered about the #1 match, not the career page being viewed
- **Root cause = failure point (a): the current career was never passed in the first place.**
  `Roadmap.jsx` mounted `<CounselorOrb />` with no props → `CounselorOrb` posted only `{ message }`
  → `chat_with_ai` built context only from `run_career_engine` (top match = e.g. Journalist). On the
  Mechanical Engineer page, "Why is this career good for me?" was answered about Journalism.
- **Fix:** `Roadmap.jsx` passes a `careerContext` (name + salary/outlook/recruiters/education-steps)
  for the career the page actually shows → `CounselorOrb` sends it as `career_context` on `/chat`
  AND templates the example prompts against the career name → `api.py` `ChatRequest.career_context`
  (`Optional[dict]`) → `ai_chat._build_career_context_prefix` prepends a "this career = <name>, do
  NOT default to the #1 match" instruction to **only the final user turn sent to Cohere** (not stored
  in history). No `career_context` (Dashboard/Profile/general orb) → old top-match fallback intact.

### BUG B — replies appeared as a wall of text → progressive typing
- **Simulated typing chosen over true streaming (deliberate).** SDK 5.21.1 has `chat_stream`, but
  true streaming would force the axios `/chat` call (with its single-flight 401-refresh interceptor,
  shared by `CounselorOrb` + `DashboardCounselor`) onto raw `fetch()`/`ReadableStream` +
  `StreamingResponse` and a re-implemented auth/error path — disproportionate. Used the brief's
  sanctioned fallback.
- **Implementation:** `AIOrb` reveals the latest assistant message ~4 chars / 18ms (`setInterval`
  keyed on `typingIdxRef`); earlier messages render in full; `useReducedMotion` shows it instantly;
  scroll-to-bottom follows the reveal. Backend/axios/request cycle unchanged.
- **`AIOrb.send()` loading-guard from the previous session is intact** (`if (isLoading) return;`),
  along with the loading dots, controlled open/draft, and `friendlyError` handling.

---

# Current Phase: SESSION 53 — Landing Scene 1: ground-glow DOM order fix + build verification — COMPLETE

## Status: SESSION 53 DONE. Sessions 1–52 also DONE.

**Only `frontend/src/pages/Landing.jsx` changed (DOM order only — no value changes).
`npm run build` → 493 modules, 0 errors.**

Session 52 had the `js-ground-glow` div placed **after** the student figure in the DOM. The brief
specified it should sit **between** the rooftop layer and the student in the DOM so z-index ordering
and DOM order are consistent. Fixed: glow div moved to appear before `.js-seated` (student) in the
JSX. All values (bottom, width, height, gradient, mixBlendMode, filter, zIndex, pointerEvents) are
identical — no visual change, just correct DOM ordering. The GSAP tween in `tl1` at position 0.14
(`.from('.js-ground-glow', { autoAlpha: 0, duration: 0.44 }, 0.14)`) is unchanged.

**Final confirmed values:**
- `bottom: isMobile ? '5vh' : '7vh'` — matches student's bottom anchor exactly
- `width: isMobile ? 236 : 364` — ≈1.3× the 182px/280px student width
- `height: isMobile ? 110 : 150` — ≈0.44–0.50× the 221px/340px student height
- `radial-gradient(ellipse at 50% 70%, rgba(225,232,250,0.22) 0%, rgba(180,195,225,0.08) 45%, transparent 75%)`
- `mixBlendMode: 'screen'`, `filter: 'blur(6px)'`, `zIndex: 4`, `pointerEvents: 'none'`
- At 900px viewport, glow top = 7vh+150px = 213px from bottom (23.7%) — within bottom 25% zone.
- GSAP: invisible during initial zoom-in; fades in with the pull-back alongside `.js-city`.

---

# SESSION 52 — Landing Scene 1: revert PNG overlay → single conservative CSS ground-glow — COMPLETE

## Status: SESSION 52 DONE. Sessions 1–51 also DONE.

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 493 modules, 0 errors.
No locked layout value touched.**

### Decision
Session-51 PNG overlay failed visually — image too large/saturated, haze band covered the hero
headline/buttons, glow blob oversized and overly purple. Reverted to CSS, this time a single small
conservatively-scoped ground-glow only. All other lighting elements (rim-light, haze, vignette,
window-sparkle) deliberately omitted — evaluating this element in isolation first.

### STEP 1 — PNG overlay removed (fully, no dead code)
- `<img className="js-lighting-overlay">` element deleted.
- `.from('.js-lighting-overlay', ...)` tween removed from `tl1`.

### STEP 2 — single conservative ground-glow (`js-ground-glow`)
- `bottom: 7vh` desktop / `5vh` mobile — matches student's bottom anchor exactly.
- `width: 364px` desktop (≈1.3× the 280px student) / `236px` mobile (1.3× the 182px student).
- `height: 150px` desktop (≈0.44× student height 340px) / `110px` mobile.
- **Viewport coverage (desktop, 900px viewport):** glow top = 7vh+150px = 213px from bottom =
  **23.7% from bottom** — stays within the bottom 25% zone, nowhere near the hero text (top 12%).
- `radial-gradient(ellipse at 50% 70%, rgba(225,232,250,0.22) 0%, rgba(180,195,225,0.08) 45%, transparent 75%)`
- `mixBlendMode: screen`, `filter: blur(6px)`, `zIndex: 4` (above rooftop z=4, below student z=5).

### STEP 3 — pull-back reveal
- `.from('.js-ground-glow', { autoAlpha: 0, duration: 0.44 }, 0.14)` in `tl1` — invisible during
  initial zoom-in, fades in alongside the skyline during the pull-back (same position as `.js-city`).

---

# SESSION 51 — Landing Scene 1: CSS gradient lighting → single painted PNG overlay — COMPLETE (REVERTED in Session 52)

## Status: REVERTED. Sessions 1–50 also DONE.

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 493 modules, 0 errors (module
count unchanged — no new module; edit to existing file only). No locked layout value (skyline
sizing/position, rooftop, student, constellations) touched.**

### Decision
After three sessions (42/44/47) of CSS-gradient/blend-mode lighting attempts that all still read as
"a shape" rather than "light," the CSS-gradient-overlay approach was abandoned entirely. The problem
is structural: CSS gradients are geometric (perfect ellipses) and their `mix-blend-mode:screen`
effect brightens the scene but the source shape is still visible as a defined oval or hard line.
A new image asset (`/assets/skyline/lighting-overlay.png`) is a single transparent PNG containing
ground-glow, rim-light, haze, and window-bloom painted together as one cohesive lighting layer with
organic, irregular, painterly edges — the shape problem disappears because the source is not geometric.

### STEP 1 — removed CSS lighting elements (all fully deleted, no dead code)
- **Two-layer screen-blended glow** (LAYER 2 outer ambient spread + LAYER 1 inner bright core, both
  `mixBlendMode:'screen'` radial-gradient divs at z=4). Sessions 42/44/47.
- **Rim-light line** (`linear-gradient` div at `bottom:41%`, 3px tall, `blur(4px)`, z=3). Session 42.
- **City-haze overlay** (`linear-gradient(to top, ...)` div, `height:54vh`, z=1). Sessions 42/44.
- **Foreground-warmth overlay** (`linear-gradient` div inside `.js-city`, `mixBlendMode:'overlay'`,
  z=5). Session 47.
- **Vignette** (`radial-gradient(ellipse 130% 100%)` div, z=8, full-inset). Session 42.
- All associated multi-paragraph SESSION 42/44/47 comment blocks cleaned up.

### STEP 2 — single `<img className="js-lighting-overlay">` added
- `position: absolute, inset: 0, width: 100%, height: 100%`
- `objectFit: cover, objectPosition: bottom center`
- `zIndex: 4` (same slot the old two-layer glow occupied — above rooftop z=4 within `.js-city`
  stacking context, below student z=5 in `.js-cam`)
- `mixBlendMode: screen` (same additive principle as before; no shape artifact since source is painterly)
- `opacity: 0.85` (tune empirically in a real browser — reduce toward 0.6 if washed-out, raise to 1.0
  if too subtle)
- `onError` hides the element silently if the asset is not yet placed — scene still looks correct
  (just unlit) until the PNG is added

### STEP 3 — GSAP visibility fix
Added `.from('.js-lighting-overlay', { autoAlpha: 0, duration: 0.44 }, 0.14)` to `tl1` — same
scrub position as `.js-city`'s reveal (0.14). The overlay is invisible in Scene 1's initial
zoomed-in state and fades in alongside the skyline/rooftop during the pull-back scrub, matching the
brief's requirement that it only becomes visible as the camera pulls back.

**Asset needed:** place the painted PNG at `frontend/public/assets/skyline/lighting-overlay.png`.

---

# Current Phase: SESSION 50 — Universities gap-fill v2 (cost + state coverage, +332 real institutions) — COMPLETE

## Status: SESSION 50 DONE. Sessions 1–49 also DONE.

**New `scrapers/universities_expand_v2.py`. universities table 9,718 → 10,050 rows. Targets GAPS,
not raw count. Idempotent (run twice).**

### KEY DATA FINDING — corrects the brief's premise
India is split across TWO country labels: `country='India'` = 307 rows (Session-17 curated, already
100% cost + state), and the earlier global/QS import's **ISO-2 `'IN'`** = 357 rows, which hold the
real NULLs (31 NULL cost, 316 NULL state). Filtering on `='India'` alone hides every gap. So
"India universities" = `country IN ('India','IN')` (664 rows before). Surfaced rather than silently
following the wrong assumption.

### STEP 1 — before counts (India = India+IN)
total 9,718 · India 664 · cost filled 633 (95.3%) · state filled 348 (52.4%).

### STEP 2 — script (3 steps)
- **A — cost:** Cohere `command-r-plus-08-2024` (batched 20/call) estimated annual INR cost from
  name/tier/type for the 31 NULL-cost India rows; UPDATE-only. → **100.0%** (target ≥70%).
- **B — state:** Cohere inferred Indian state/UT from name (+city) for 316 NULL-state rows, rejecting
  any value outside the official 36 state/UT names. 311 filled across two runs → **99.5%** (target
  ≥60%). 5 left NULL (unidentifiable generic names — correctly not guessed).
- **C — +332 net-new REAL institutions** (target ≥300), `data_source='curated_v2'`: ~145 govt
  polytechnics, ~150 state private universities, ~45 govt engineering colleges, 25 govt medical
  colleges, + abroad 51-100. Curated names only; Cohere never invents names. Idempotent via
  case-insensitive existence check (no unique constraint on `university_name`).

### STEP 3 — after counts
total **9,718 → 10,050** (+332) · India 664 → 995 · cost **95.3% → 100.0%** · state **52.4% → 99.5%**.
`GET /stats` reads 10,050 once its 5-min cache expires (no endpoint change).

---

# Current Phase: SESSION 49 — Career match %: tier colour-coding + percentile context (display-only) — COMPLETE

## Status: SESSION 49 DONE. Sessions 1–48 also DONE.

**`frontend/src/components/CareerCard.jsx`, `frontend/src/pages/Careers.jsx`,
`frontend/src/utils/matchTiers.js`. `npm run build` → 493 modules, 0 errors (no new module).
DISPLAY/PRESENTATION ONLY — `score_assessment.py`, all match-percentage math, and every DB query
are UNTOUCHED.**

### TASK 1 — colour-code the match % by tier
- The CareerCard match-% NUMBER is coloured by tier using the SAME `tiers.tierOf` that drives the
  Careers tier-filter pills (incl. the adaptive-threshold fallback), so a green % is always the same
  career under the "Good match" tab.
- **Tokens used (all existing tokens.css values — no new hex):** `good → var(--mint)` (#5DCAA5),
  `ok → var(--gold)` (#EF9F27), `other → var(--coral)` (#D85A30). tokens.css has no
  `--success/--warning/--danger`, so the closest existing positive / amber / destructive tokens were
  re-used; `--coral` is the same coral the re-take-assessment + delete buttons already use.
- Colour applied to the number ONLY — card background, border, and the match bar are unchanged.

### TASK 2 — percentile context
- `matchTiers.js`: added `getPercentileRank(score, allScores)` (0–100 rank among the student's own
  scored careers) + `getPercentileCaption(percentile)` (returns `"Top N% of your matches"` only when
  percentile ≥ 70, i.e. genuinely top ~30%, else `null`).
- Careers.jsx computes this CLIENT-SIDE from the already-fetched `allPercents` distribution (no new
  endpoint) and passes it to each card; CareerCard renders it small + muted (`--text-tertiary`,
  `--fs-caption`) beneath the %, omitted when not distinguishing.

### Supporting changes
- `matchTiers.js`: `TIER_COLORS` map + `standardTierOf(percent)` (extracted absolute-threshold
  classifier, reused by `computeTiers` and as CareerCard's default tier).
- CareerCard `matchTier` + `percentileCaption` props are optional and backward-compatible — Dashboard
  + Results render unchanged and still get tier-coloured percentages via `standardTierOf`.

**Verification:** build 493 modules / 0 errors. Careers is auth + completed-assessment gated, so a
headless preview isn't meaningful; static display logic confirmed by the build — flagged for Aman.

---

# Current Phase: SESSION 48 — Live stats endpoint + Scene 4 Possibility live counters — COMPLETE

## Status: SESSION 48 DONE. Sessions 1–47 also DONE.

**`api.py` (new `/stats` endpoint) + `frontend/src/pages/Landing.jsx` (Scene 4 stat counters).
`npm run build` → 493 modules, 0 errors (module count unchanged).**

### STEP 1 — Backend: `GET /stats` (public, no auth)
- Returns `{ careers, scholarships, universities, states }` as live COUNT(*) queries.
- In-memory cache: module-level `_STATS_CACHE` dict (`data` + `ts`). Cache miss if `data is None`
  or age > `_STATS_TTL = 300` seconds. Cache hit skips all DB queries. Uses `time.monotonic()`.
- Real counts at time of implementation: **careers: 221, scholarships: 96, universities: 9,718,
  states: 34**. States query: `COUNT(DISTINCT state) WHERE state IS NOT NULL AND state <> ''`.

### STEP 2 — Frontend: Scene 4 (Possibility) live counters
- `import client from '../api/client.js'` added to `Landing.jsx`.
- `const [stats, setStats] = useState({ careers: 25, scholarships: 340, universities: 180, states: 28 })` —
  fallback placeholder values shown while in-flight; layout is stable (no flash/empty state).
- `useEffect(() => { client.get('/stats').then(({ data }) => setStats(data)).catch(() => {}); }, [])` —
  fires once on mount; silently keeps fallback values on fetch failure (no error shown on public page).
- **Four StatCounters** (was three): `careers+` / `scholarships+` / `universities+` / `states`.
  Careers counter added as first item.
- StatCounter already uses `en-IN` locale via `n.toLocaleString('en-IN')` — 9,718 renders as
  **"9,718"** (Indian grouping), no changes needed to the component.
- When the fetch resolves, `value` prop changes on each StatCounter; Framer `useInView` fires the
  count-up animation the first time the element scrolls into view — if it has already been seen, the
  display number jumps to the new value. This is correct behaviour (counters that haven't been seen
  yet animate up to the real value directly).

**Verification:** build 493 modules / 0 errors. Real DB counts confirmed via psycopg2 direct query.
StatCounter `en-IN` locale confirmed in source (line 57: `n.toLocaleString('en-IN')`).

---

# Current Phase: SESSION 47 — Landing Scene 1: two-layer screen-blended light pool + warm-foreground contrast — COMPLETE

## Status: SESSION 47 DONE. Sessions 1–46 also DONE.

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 493 modules, 0 errors (no new
module — lighting-layer edit only). No locked layout value touched.**

### SECTION A — the structural gap (honest re-assessment)
The prior 3 lighting sessions (42/44) only ever re-tuned a SINGLE, NORMAL-blended radial div. A
normal-blended translucent gradient is a shape laid OVER the rooftop (it averages colour with the
pixels beneath) → always reads as "a flat hazy oval," never as emitted light. The missing piece is
**`mix-blend-mode: screen`** (additive — brightens the rooftop's own pixels), plus a **two-layer**
structure (bright fast-falloff core + wide soft spread) that a single-peak gradient can't provide.

### SECTION B — two-layer light pool
- **Layer 2 (outer spread):** kept Session-44 values (core 0.34, 60%×26vh, bottom 2vh, z4) +
  `mixBlendMode:'screen'` + `blur(8px)`.
- **Layer 1 (inner core, NEW):** `rgba(235,238,255,0.42)→0.18@55%→transparent`, 42%×16vh,
  bottom 5vh (4vh mobile), `screen`, `blur(4px)`, z4. `.js-cam` `isolation:'isolate'` keeps screen
  blending within the camera group. Brief values kept (prior problem was the glow too faint); final
  fine-tune wants a real browser.

### SECTION C — warm-foreground contrast (both ends of the differential)
Sibling overlay inside `.js-city` (z5, above rooftop z4):
`linear-gradient(180deg, transparent, rgba(255,200,140,0.06))`, `mixBlendMode:'overlay'`,
`height:100%` — warms only the foreground flat roof, NOT the rooftop's locked filter. City-haze
re-verified: `54vh` fully covers the `52vh` skyline zone — no widening needed.

### SECTION D — rim-light anchor RE-VERIFIED (no correction)
Rooftop asset unchanged since Session 42 (still `bottom:-14px/width:100%/height:auto`), so
`bottom:41%` is still the correct parapet anchor. Only raised peak alpha 0.35→**0.45**
(shoulders→0.20) to read against the brighter screen-blended glow.

**Verification:** build 493 modules / 0 errors. Scene 1 is GSAP-pinned (0×0 headless viewport —
documented limitation); `screen`/`overlay` results need a real browser to judge — flagged for Aman.

---

# Current Phase: SESSION 46 — ScrollToTop: fix pages loading pre-scrolled to bottom — COMPLETE

## Status: SESSION 46 DONE. Sessions 1–45 also DONE.

**`frontend/src/components/ScrollToTop.jsx` (new), `frontend/src/App.jsx`.
`npm run build` → 493 modules, 0 errors.**

- New `ScrollToTop` component: `useLocation` + `useNavigationType`; calls `window.scrollTo(0,0)`
  on every `pathname` change, skipping `POP` (back/forward) navigations so native scroll
  restoration is not broken.
- Integrated via a new `RootLayout` function in `App.jsx` that wraps the entire route tree with
  `<ScrollToTop /><Outlet />` — single integration point, covers all public/auth/protected routes.
  `AppShell.jsx` unchanged. Landing.jsx GSAP ScrollTrigger unaffected (fires on pathname changes
  only, not intra-page scroll events).

---

# Current Phase: SESSION 45 — Career match scoring fix (kill "~50 tied at 60%") + adaptive tier filtering — COMPLETE

## Status: SESSION 45 DONE. Sessions 1–44 also DONE.

**`score_assessment.py`, `frontend/src/utils/matchTiers.js` (new), `frontend/src/pages/Careers.jsx`,
and the `scoreToPercent` copies in `Careers.jsx`/`Dashboard.jsx`/`Results.jsx`.
`npm run build` → 492 modules (was 491), 0 errors.**

### STEP 1 — Diagnosis: CODE bug, not data bug
Real student 16 across all 221 careers produced only **5 distinct raw scores {0,2,3,5,8}** →
**5 percentages {48,56,60,68,80}%**, with **46 careers tied at exactly 60%** — confirms the report.
The data is well differentiated (5/5/4/4 distinct thresholds, 6/6 traits); the integer scorer threw
it away by (1) comparing 0–100 normalized scores against 1–5 thresholds → every term saturates to a
per-student **constant**; (2) `aptitude_scores.get("verbal")` reading a missing key (real:
`verbal_reasoning`) → verbal constant −2; (3) binary "trait in top-2" being the only differentiator
→ 4 levels.

### STEP 2 — Fix: continuous 0–100 weighted match
Per-career score = **0.50·interest + 0.30·aptitude + 0.20·readiness**, all graded on a shared 0–100
scale. Interest = `0.65·fit(primary)+0.35·fit(secondary)`, `fit = 0.5·absolute RIASEC + 0.5·relative
standing in the student's own profile`. Aptitude/readiness grade each student value vs `required×20`
with a linear shortfall penalty (CA Foundation floored at 60). Rounded to 1 dp — no arbitrary
rounding. Downstream rescaled: `top_careers` = top 2; admission `career_fit_score = clamp(score,30,95)`.
The three frontend `scoreToPercent` now just `round`+clamp the already-0–100 value.

**Post-fix distribution (same diagnostic):** student 17 → **34 distinct %, 56–90%**, 60% holds **9**
careers (was 46); student 12 → **29 distinct %, 58–88%**. Student 16 still clumps because it is a
flat test account (all RIASEC = 80.0, no interest signal) — handled by the adaptive tiers.

### STEP 3 — Adaptive tier filtering (`matchTiers.js` + `Careers.jsx`)
Standard tiers Good ≥60 / OK 40–59 / Other <40. **Fail-safe:** if no career ≥60% and ≥5 careers,
Good = top 20% by rank, OK = next 30%, Other = rest (Good never empty). All/Good/OK/Other pill row
with counts (existing tokens), computed from the full distribution; caption *"Showing relative match
quality"* shown only in adaptive mode. Composes with the search + RIASEC-category filters.

---

# Current Phase: SESSION 44 — Landing Scene 1: fix the flat purplish-grey band + invisible ground-glow — COMPLETE

## Status: SESSION 44 DONE. Sessions 1–43 also DONE.

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 491 modules, 0 errors.
Locked layout (skyline sizing/position, rooftop, student, constellations) UNTOUCHED — this was a
diagnostic + fix on the lighting layer only.**

### SECTION A/B — the flat band artifact: identified + fixed
- **Culprit = Section C city-haze overlay** (`bottom:0, height:54vh, z=1`). Old gradient
  `linear-gradient(to top, rgba(70,90,150,0.08) 0%, rgba(90,110,160,0.12) 100%)` was (1) densest
  at its TOP edge (backwards) and (2) had NO transparent terminating stop, so at the div's top
  boundary (54vh ≈ just above the 52vh `.js-city` skyline top) opacity hit max 0.12 then cut to 0
  → a hard 0.12→0 line = the "dull purplish-grey hard-edged band where buildings meet the sky."
  rgba(90,110,160) over dark navy reads purplish-grey; it overpaints the skyline (DOM-rendered
  after `.js-city`, same z=1).
- **Fix:** density flipped to densest-at-bottom, fading to FULLY transparent before the top edge
  with intermediate stops:
  `linear-gradient(to top, rgba(70,90,150,0.13) 0%, rgba(80,100,155,0.09) 28%, rgba(88,108,158,0.04) 58%, transparent 84%)`.
  No hard edge anywhere. height 54vh / z=1 unchanged. (Sections B rim-light + E vignette were NOT
  the band — warm / cool-navy, not purplish-grey — left untouched.)

### SECTION C — invisible ground-glow: cause + fix
- **Cause = opacity/coverage, NOT stacking.** Stacking verified correct: glow z=4 is above the
  whole `.js-city` stacking context (z=1, incl. rooftop img) and below the student (z=5). But
  peak 0.20 was too faint against the now haze- + vignette-darkened rooftop, and the z=8 vignette
  (`transparent 48% → rgba(4,6,26,0.35)`) darkens the BOTTOM-centre where the glow sits and paints
  OVER it.
- **Fix:** core 0.20→**0.34**, added a mid stop, enlarged 52%→**60%** / 22vh→**26vh**, bottom
  3vh→**2vh**, fades fully transparent at 72%:
  `radial-gradient(ellipse at 50% 65%, rgba(228,234,252,0.34) 0%, rgba(185,200,235,0.18) 30%, rgba(150,172,215,0.07) 52%, transparent 72%)`.

**Final values:** haze = `to top, 0.13/0.09/0.04/transparent @ 0/28/58/84%`, 54vh, z=1.
Glow = core 0.34 / 0.18@30% / 0.07@52% / transparent@72%, 60% × 26vh, bottom 2vh, z=4.

**Verification:** `npm run build` → 491 modules, 0 errors. Scene 1 is GSAP-pinned (headless preview
0×0 viewport — documented limitation Sessions 38/40/42); fix is static gradient values, build-confirmed.

---

# Current Phase: SESSION 43 — SoundManager: synthesized playDust + playChime replaced with real audio files — COMPLETE

## Status: SESSION 43 DONE. Sessions 1–42 also DONE.

**Only `frontend/src/components/SoundManager.jsx` changed. `npm run build` → 491 modules, 0 errors.**

- **`playDust()`** — old noise-burst Web Audio synthesis removed. Now plays
  `/assets/sounds/dust-chime.mp3` (Sunovia silver chime) at `volume = 0.22` via clone
  strategy (`new Audio(ref.src)` per call). Throttled to 200ms by Landing.jsx.

- **`playChime()`** — old 900/920Hz dual-oscillator synthesis removed. Now plays
  `/assets/sounds/star-chime.mp3` (soft/magical chime) at `volume = 0.18` via clone
  strategy. Fires once per constellation hover-enter (ConstellationLayer).

- **Lazy-load pattern:** `dustRef` + `chimeRef` HTMLAudioElement instances created in
  the same `unlocked` useEffect as `windRef` — never before first user gesture. Base
  instances pre-cache the files; each play call clones from `ref.current.src`.

- **Unchanged:** `playClick`, `playWhoosh`, `playHover`, `startWind` — byte-identical.
  No Landing.jsx or other call-site changes required.

---

# Current Phase: SESSION 42 — Landing Scene 1: lighting/atmosphere colour-correction + scroll-limbo outline attempt 2 — COMPLETE

## Status: SESSION 42 DONE. Sessions 1–41 also DONE.

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 491 modules, 0 errors.
No locked positional/size value on any existing element was touched.**

### Changes made

- **SECTION A (colour-corrected) — ground-glow light pool.** Previous purple/magenta values
  (`rgba(180,170,230)`) replaced with cooler blue-white matching the skyline's
  `hue-rotate(8deg)` lean: centre `rgba(225,232,250,0.20)`, mid `rgba(170,190,225,0.09)`.
  Reads as moonlight/starlight on the roof surface. Anchored at `bottom:3vh` (just below
  the student's `bottom:7vh`), 52% viewport wide, `border-radius:50%`, z=4, no blur
  (the radial gradient is its own soft edge). Geometry of new rooftop asset verified before
  anchoring (see Session 41 notes and the inline comment for the full calculation).

- **SECTION B (position re-verified) — warm amber rim-light.** Colour unchanged
  (`rgba(255,211,155,0.35)`) — warm rim from city glow is intentionally warm against the
  cool sky. Position re-anchored from the new rooftop asset's geometry: flat-roof-band top
  (the parapet ledge) = 60% of 960px rendered image height = 576px from rooftop top; at
  1440×900 viewport → parapet ≈ `bottom:41%` of viewport. Set to `bottom:41%`, height 3px,
  blurred 4px for soft glow, fades to transparent left/right (no hard edge at sides). z=3.

- **SECTION C — cool city haze overlay.** Values (`rgba(90,110,160,0.12)` →
  `rgba(70,90,150,0.08)`) were already blue-leaning and never the source of the colour
  mismatch; left unchanged per the brief. Position: `bottom:0, height:54vh` (over full
  skyline zone), z=1.

- **SECTION D — window-light sparkle.** Not implemented — brief explicitly gave discretion
  to omit if not convincing; no prior implementation to reference.

- **SECTION E — vignette.** Value (`rgba(4,6,26,0.35)`) was already cool dark navy
  (= --void token), never purple; left unchanged per the brief. Full-inset radial gradient,
  z=8, overlays all `.js-cam` content.

- **SECTION F — scroll-limbo outline, second attempt.** Two compositing strategy changes:
  1. `willChange:'transform'` was ALREADY present on `.js-cam` (no change needed).
  2. `transformStyle:'flat'` → `transformStyle:'preserve-3d'` on `.js-cam` — a different
     compositing strategy than the previous `flat/isolate` approach; combined with
     `perspective:'1000px'` added to `.scene-1` (the immediate parent). The `flat` strategy
     creates a flat compositing layer whose edges can show during intermediate scales;
     `preserve-3d` + parent perspective promotes `.js-cam` into a 3D rendering context
     which can resolve the edge-detection artifact differently in some browsers.
  3. Which element's bounding box the artifact aligns with (diagnostic point 3 from the
     brief) cannot be determined without a real browser slow-scroll + devtools — this requires
     Aman to inspect live. If `preserve-3d` does not fully resolve it, the next diagnostic
     step is to identify whether the "square" edges match `.js-city`, the ConstellationLayer
     wrapper, or `.js-cam` itself, then target compositing hints at that specific child.

**Verification:** `npm run build` → 491 modules, 0 errors. No locked positional/size value
changed (verified: `bottom:-14px` on rooftop, `width:100%, height:auto` on rooftop,
`height:52vh/40vh` on `.js-city`, `objectPosition:50% 30%` on far/mid/near, `bottom:7vh`
on student, all parallax values, camera scale 1.82 — all byte-identical). All new elements
are pure siblings with no-op layout impact on existing children.

---
# Current Phase: SESSION 41 — Landing Scene 1: mobile gap, rooftop rework, constellation scatter, scroll-outline artifact — COMPLETE

## Status: SESSION 41 DONE. Sessions 1–40 also DONE.

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 491 modules, 0 errors.
DESKTOP SKYLINE LOCKED, UNCHANGED — every `.js-city`/`SKYLINE_LAYERS` dimensional, positional,
filter, mask, and far/mid/near parallax value is byte-identical to Session 40 (grep-verified:
far/mid/near filters + masks intact, objectPosition `50% 30%`, `.js-city` `40vh/52vh`, parallax
−4/−10/−18, camera scale 1.82).**

- **FIX 1 — mobile hero gap (mobile-only).** The hero copy wrapper sat too high on mobile,
  leaving a void above the skyline. `top: isMobile ? '8%' : '12%'` → `'16%' : '12%'`. ONLY the
  mobile branch moved; desktop `'12%'` untouched; no skyline/rooftop/student value touched.

- **FIX 2 — rooftop GEOMETRY REWORK (chosen by Aman over the literal 'top center' instruction).**
  Pillow alpha + per-band width analysis of `layer-rooftop.png` (1536×1024) proved the literal
  instruction would BREAK the rooftop: source TOP 0–25% is fully TRANSPARENT sky (alpha≈0); the
  WATER TANK is a NARROW element on the LEFT (≈left 8–22%) at source y≈25–60%; the FULL-WIDTH flat
  tiled roof is the SOLID bottom (y≈60–100%, alpha 180–255); last row opaque (no padding).
  `'top center'` at 16vh+cover would anchor the empty transparent top and crop the solid roof off
  the bottom → invisible rooftop (Session-37 regression). And because the tank top (≈25%) and flat
  roof (60–100%) are ~45% of the height apart, NO short cover-window can contain both. The only way
  to show the tank AND keep full viewport width is NATURAL aspect: rooftop now `width:100%,
  height:'auto'` (objectFit/objectPosition removed), so the whole rooftop — tank, parapet, flat
  surface — renders full-width, flat roof flush at the bottom, transparent top overlapping the
  sky/skyline. **Final rooftop values: `width:100%, height:'auto', bottom:'-14px'` (no objectFit /
  objectPosition).** TRADE-OFF flagged: natural aspect makes the flat-roof band ≈30%×(100vw/1.5)
  tall — taller than the old fixed 16vh; "full width + visible tank + thin flat roof" is
  geometrically impossible for this asset, so per the chosen rework this is the accepted cost
  (tunable via a maxWidth cap). Rooftop scroll parallax changed `yPercent:-26` → `y:-12` (bounded
  px) so the now-tall element's bottom can't lift off the viewport mid-pull-back. This is part of
  the rooftop-layer rework, NOT a far/mid/near change.

- **FIX 3 — bottom seam.** PNG is opaque to its last row (NO transparent padding — the brief's
  padding theory disproven), so the reported gap was a sub-pixel/rounding seam. Final fix:
  rooftop `bottom:'-14px'` seats the opaque roof edge flush past the viewport bottom, and the
  bounded −12px parallax keeps it flush throughout the scrub.

- **FIX 4 — constellation scatter (both breakpoints).** `CONST_ITEMS` redefined with organic,
  non-uniform positions clear of: TopBar logo (top 0–8%/left 0–14%) and Begin button (top 0–8%/
  right 0–14% — the airplane was the one rendering behind Begin, now dropped to top 12%/right 6%),
  the hero text zone (top 10–55%/left 25–75%), and the skyline/rooftop. Desktop:
  microscope top15%/left5%, airplane top12%/right6%, scales top3%/left18%, camera top7%/right17%,
  stethoscope top40%/right5% (moved to the RIGHT to clear FIX 2's now-raised left-side water-tank
  column). Mobile: microscope 8%/4%L, airplane 8%/4%R, scales 2%/30%L, camera 2%/30%R, stethoscope
  hidden — all in the top strip ABOVE the ~92%-wide mobile hero.

- **FIX 5 — scroll-limbo "square outline" artifact.** No element has any painted outline/border/
  box-shadow (`.js-city` and the skyline imgs all set border/boxShadow `'none'`), so it is a
  GPU compositing-layer edge surfacing during the `.js-cam` scale (1.82→1) over masked children.
  Fix = pure compositing HINTS on `.js-cam`: `backfaceVisibility:'hidden'` (+ Webkit),
  `transformStyle:'flat'`, `isolation:'isolate'`. These do NOT alter the resting (scale:1) or
  full-pull-back (scale:1.82) appearance — only stabilise mid-transform rasterisation. No locked
  dimensional/positional value changed. (If the artifact persists, it was reported as a
  hint-based remedy, not a locked-value workaround — flag for a follow-up.)

# Current Phase: SESSION 40 — Landing Scene 1: the skyline "hard top-cut" line — ROOT CAUSE FOUND & FIXED — COMPLETE

## Status: SESSION 40 DONE. Sessions 1–39 also DONE.

**Only `frontend/src/pages/Landing.jsx` changed (far/mid/near `objectPosition` only).
`npm run build` → 491 modules, 0 errors. `.js-city` sizing, the per-layer filters, the masks,
the rooftop layer, and the student/shadow were all left UNTOUCHED, as instructed.**

Fresh diagnosis (prior mask-widenings did nothing — confirmed by Aman — so it was NOT a mask
problem). Worked Section A top to bottom with live computed-style + Pillow alpha + isolated-clone
screenshot evidence:

- **Point 1 — PARENT CLIPPING: RULED OUT (measured).** Live ancestor `overflow` chain from a
  skyline `<img>` up: SkylineLayers div `visible`, `.js-city` `visible`, `.js-cam` `visible`,
  `.scene-1` **`hidden`** (it is the ScrollTrigger pin, so `position:fixed`, clip box = the
  viewport with its top edge at `y=0`), pin-spacer `visible`, `.page-serif` `visible`. BUT the
  skyline's masked top sits at `y≈177px` (scale 1.82) / `y≈432px` (rest) — it never reaches the
  `y=0` clip boundary. No clip edge coincides with the cut, so `.scene-1`'s overflow:hidden is
  not responsible.
- **Point 2 — BACKGROUND/STACKING SEAM: RULED OUT (measured).** Computed `background-color` of
  `.js-city`, `.js-cam`, the SkylineLayers wrapper, and `.scene-1` are ALL `rgba(0,0,0,0)`. Only
  `.page-serif` (the gradient) and `<body>` (`#04061A`) paint. No container draws its own
  rectangle, so there is no container-edge seam.
- **Point 3 — SUB-PIXEL ARTIFACT: NOT the cause.** A 1px sub-pixel seam would shift on resize and
  the earlier mask-% changes would have moved it; neither matched the report. Secondary at most.
- **Point 4 — MASK-MEETS-PHOTO-CONTRAST: CONFIRMED, with the precise mechanism prior sessions
  missed.** `object-fit:cover` renders each 1536×1024 PNG ~960px tall at 1440px wide, but
  `.js-city` is only 52vh (~468px). With `object-position:50% 100%` (bottom center) the BOTTOM
  ~49% of the source fills the layer and the TOP ~51% is cropped. Pillow alpha bands show each
  PNG's jagged ROOFLINE (the natural soft silhouette) lives at source y = **21% (near) / 29.5%
  (mid) / 38.9% (far)** — ALL inside that cropped-off top half. So the roofline was never
  on-screen and the visible top edge was SOLID building mass (≥98% opaque; building pixels are
  also very dark, RGB ~2–29, ≈ page colour). The per-image mask was therefore feathering a
  hard-topped solid block with **no silhouette and no transparent sky in the masked window** —
  which is exactly why widening the mask twice changed nothing.

- **FIX (Section B, point-4 path — but the data forced the real remedy):** the brief's point-4
  suggestion ("shift the mask earlier into the sky") cannot work when the sky/roofline are cropped
  OUT of the window, so instead the visible window itself was shifted up: far/mid/near
  `objectPosition` `50% 100%` → **`50% 30%`**. Now each layer's transparent sky + jagged roofline
  land inside the masked fade zone, so the mask dissolves a REAL sky→silhouette→buildings
  transition. Building mass still fills the lower half of every layer, so this is NOT Session 34's
  `top center` (0%) regression that emptied near/mid. Masks, filters, sizing all unchanged.
- **Section C (bottom-crop + nudge-up): evaluated, NOT used.** Since the cause is the cropped
  roofline (not a clip/stacking boundary at a fixed pixel), nudging the container would only move
  the same solid-block edge — it would not restore the silhouette. The objectPosition reframe
  fixes the actual cause, so the nudge is unnecessary.
- **Section D (mobile, checked independently):** on narrow mobile the `cover` is HEIGHT-driven
  (e.g. 375×812, 40vh) so the full source height — including the roofline — already shows and
  `50% 30%` is a no-op there; on wide-mobile widths near the 768px breakpoint `cover` is
  width-driven and `50% 30%` helps exactly as it does on desktop. Both breakpoints verified free
  of the hard edge.
- **Verified:** `npm run build` → 491 modules / 0 errors. Live computed styles confirm
  far/mid/near `object-position: 50% 30%` (rooftop still `50% 100%`), masks intact, 0 console
  errors. Isolated-clone full-width screenshots (brightness-boosted to see the dim night skyline)
  show `50% 100%` rendering only a solid foreground building block (the cut) vs `50% 30%`
  rendering the full jagged skyline silhouette dissolving into the sky with no horizontal line —
  on BOTH desktop (52vh) and mobile (40vh). (The GSAP-pinned Scene 1 still can't be screenshotted
  directly in headless preview — documented limitation — so the isolated clone, which replicates
  the exact cover/objectPosition/mask/container geometry, is the faithful proxy.)

# Current Phase: SESSION 39 — Scene 2 figure: 4th real-asset attempt ATTEMPTED & REJECTED; hand-traced figure stays ACTIVE — COMPLETE

## Status: SESSION 39 DONE. Sessions 1–38 also DONE.

**Scope: Scene 2 only. `frontend/src/pages/Landing.jsx` UNCHANGED. `npm run build` → 0 errors.**

The brief requested a 4th attempt at compositing the 15 `/assets/figures/animated/*.svg` part files
using anatomical-reference proportions (not naive viewBox-ratio scaling), left/right aspect-ratio
averaging for mirror symmetry, and per-part CSS `filter` recolouring. Taken seriously and evaluated.

**What was new this time: I rasterised the actual part files (qlmanage) and the reference and LOOKED
at them** — and that overturned the brief's core premise. The drawn content does NOT fill the
viewBoxes (head fills ~top-left half of its 217×265 box; torso fills ~left 55%; every part floats at
an arbitrary offset in an oversized, inconsistently padded box), so scaling each box to an anatomical
proportion scales the padding, not the anatomy. Worse: `left-forearm.svg` actually depicts an **open
hand**; `head.svg` **faces right** (reference faces left) and carries a neck/shoulder stub so it
can't butt cleanly to a torso; limb "pairs" are genuinely different poses/content, not mirrors
(left-thigh narrow-vertical vs right-thigh wide-blob), so averaging boxes distorts rather than
reconciles; all 15 are one flat `#2b2856` jagged auto-trace. CSS filters can re-hue mono blobs but
cannot make wrong-facing, mislabeled, floating fragments cohere.

**Verdict (brief's explicit honesty clause invoked): the 4th attempt cannot beat the current figure.
Current version kept live; no code changed.** The defects are intrinsic to the traced art and only a
redraw fixes them — which is exactly what the ACTIVE `StudentFigureTraced` (Session 36) already is:
clean hand-authored beziers matching `student-design-sheet.jpg`, correctly left-facing, riggable, and
colour-separated (tee `#6a60a4`, trousers `#262350`, hair `#211e44`, skin `#8378b6`). Same conclusion
as Sessions 29 & 32, now backed by direct rendered-pixel evidence. Rig/`tl2`/all scenes untouched.

# Current Phase: SESSION 38 — Landing Scene 1: preview-vs-real-browser parity (vh-only sizing, baked blue grade, softer dissolve, crowd fade) — COMPLETE

## Status: SESSION 38 DONE. Sessions 1–37 also DONE.

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 491 modules, 0 errors.**
Goal: the dev-tool preview rendered Scene 1 correctly (size/placement/dissolve/grade); a real
browser differed. Make the real browser match the preview.

- **A/B — ROOT CAUSE of the size/placement mismatch: the `maxHeight` cap × `vh` interaction.**
  `.js-city` was `height:52vh, maxHeight:480px`. `52vh === 480px` at a 923px-tall viewport. The
  dev preview renders in a SHORT fixed internal viewport (~800px) → `52vh ≈ 416px`, under the cap →
  the vh value governs → skyline = 52% of viewport (the approved look). A real browser on a taller
  window (>923px — 1080p, tall monitors) → `52vh` exceeds 480px → the cap CLAMPS the skyline to a
  fixed 480px (~44% of viewport, less on taller screens) → it renders proportionally SMALLER and
  LOWER while the vh-based student/shadow keep scaling → every element's size/placement/alignment
  drifts. The rooftop layer had the same trap (`16vh, maxHeight:150px`, clamps above 937px).
  **FIX = vh-ONLY (both caps removed):** `.js-city` `height:52vh` (mobile 40vh), rooftop `16vh`.
  A percentage viewport unit scales with the actual window, so the skyline holds a constant 52%/16%
  fraction at EVERY size — matching the preview's proportions in a real browser. Student (bottom
  7vh) + shadow (6vh) are already vh-based, so they stay in register with the now-vh rooftop.
- **C — blue tint moved from a flat overlay div to per-image FILTERS.** Deleted the separate
  `mixBlendMode:'color'` overlay div inside `.js-city` (it rendered as a visibly flat tint
  rectangle in a real browser). Baked the grade into each layer's own filter:
  far `brightness(0.42) saturate(0.6) hue-rotate(8deg) sepia(0.06)`;
  mid `brightness(0.58) saturate(0.72) hue-rotate(8deg) sepia(0.05)`;
  near `brightness(0.72) saturate(0.85) hue-rotate(8deg) sepia(0.04)`;
  rooftop `brightness(0.8) hue-rotate(8deg) sepia(0.04)`. (sepia gives the hue a faint warm base to
  rotate; hue-rotate(8deg) leans the whole skyline cool/blue — within the 4–14deg range.)
- **D — top dissolve made more gradual; WebkitMaskImage verified identical.** Both `maskImage` and
  `WebkitMaskImage` were already present and identical on far/mid/near (computed-style verified).
  Pushed the transparent→black range LOWER so the fade spans a longer distance and can't read as a
  hard cut: far `…transparent 28%, black 72%` (was 30/60), mid `18%, 62%` (was 20/50), near
  `10%, 52%` (was 10/40).
- **E — Scene 2 background crowd now fades with the rest.** The crowd is rendered by
  `<CrowdBackground />`, whose `<svg>` had **NO class** — so it was the one Scene-2 element missing
  from the 0.78 fade-out tween (which covered `.js-copy2`, `.js-lone`, `.js-dim-const`) and stayed
  visible after everything else faded. Added a `.js-crowd` class to that svg and appended it to the
  SAME tween at position 0.78, same easing (`none`) and duration (0.22).
- **Verified:** build 491 modules / 0 errors. Live browser computed styles (preview server): all 4
  filters exactly as above, `maskImage`===`WebkitMaskImage` on all three masked layers, `.js-city`
  computed `max-height: none`, 0 overlay divs with `mixBlendMode:color`, `.js-crowd` present, all 4
  PNGs load (naturalWidth 1536), 0 console errors. (Headless preview still reports a 0×0 viewport —
  documented limitation — so it resolves the mobile branch; the inline vh values + removed caps are
  what the fix turns on, and those are confirmed.)

# Current Phase: SESSION 37 — Landing skyline correction (restore 3 layers, blue tint, Scene 2 fade-out) — COMPLETE

## Status: SESSION 37 DONE. Sessions 1–36 also DONE.

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 491 modules, 0 errors.**
A correction of Session 34's over-applied "cap skyline at 50vh" — not a redesign.

- **A/B — WHY near/mid disappeared: `objectPosition:'top center'` (data-proven, fixed).** Pillow
  alpha analysis of the 1536×1024 PNGs: transparent sky = TOP ~40–50%, solid buildings = BOTTOM
  50–60% (far `[0,0,0,2,29,98,100,100,100,100]`, near `[0,0,10,49,100,…]`). Session 34's
  `'top center'` + `height:100%` + `cover` in a short container anchored the transparent sky and
  cropped the buildings off the bottom → near/mid rendered empty. Brightness filters were intact
  and heights were `100%` (not collapsed), so those weren't the cause. FIX → `objectPosition:
  'bottom center'` on all four layers (buildings rise from the bottom, roofline fades into the
  masked sky at top). Rooftop corrected too (opaque surface is its bottom ~40%). Container
  `.js-city` → `height:52vh, maxHeight:480px`, `overflow:visible`. Masks + parallax unchanged.
  **The brief asked for `'top center'`; the alpha data proves that keeps the bug, so `'bottom
  center'` was used and flagged.**
- **C — unified blue grade.** ONE overlay div inside `.js-city` (zIndex:5, above rooftop z4):
  `linear-gradient(180deg, rgba(70,90,180,0.16) 0%, rgba(40,60,140,0.22) 100%)`,
  `mixBlendMode:'color'`, `pointerEvents:none`. Alpha 0.16→0.22 (in the 0.12–0.28 range); keeps
  each layer's own luminance so depth-via-brightness survives.
- **D — stray blue box: NONE found.** No solid blue/teal rectangle exists in Landing.jsx,
  AppShell (Landing isn't wrapped in it), index.html, or global CSS. Old "solid block" artifacts
  were already removed in Sessions 26/29. The only page-bottom solid colour is the intentional
  `body{background:var(--void)}` (#04061A), hidden by the `.page-serif` gradient + fixed
  starfield. The screenshot's "box" was most likely the dim cropped band from the Section-A bug,
  which the A fix resolves. Nothing deleted.
- **E — Scene 2 had NO fade-out (confirmed) → added.** `tl2` only faded content IN; the pin
  released with no overlap = no cross-fade to Scene 3. Added `.to(autoAlpha:0, dur:0.22)` at pos
  0.78 for `.js-copy2`, `.js-lone`, `.js-dim-const`, overlapping Scene 3's scrub fade-in.
- **Verified:** build 491 modules/0 errors; DOM confirms all 4 PNGs load, `objectPosition 50%
  100%` on every layer, tint overlay present, 0 console errors. (Headless preview 0×0 viewport —
  documented limitation — so pixel screenshots of pinned Scene 1 aren't meaningful; DOM-verified.)

# Current Phase: SESSION 36 — Scene 2 figure: third-attempt hand-traced rebuild, NOW ACTIVE — COMPLETE

## Status: SESSION 36 DONE. Sessions 1–35 also DONE.

**Scope: Scene 2 only. No other scene touched. `frontend/src/pages/Landing.jsx` only.
`npm run build` → 491 modules, 0 errors.**

- **A genuinely new technique (Attempt 3) — and this time it WON.** Prior attempts:
  (1) inline-generated primitives (`StudentFigureSVG`, the figure that was active through
  Sessions 29–35 — acceptable but generic), (2) compositing the separate traced part files
  (rejected twice, Sessions 29 & 32, for scale/colour mismatch). Attempt 3: DIRECTLY hand-trace
  new cubic-bezier path geometry against `student-design-sheet.jpg` as ONE coherent SVG in a
  single shared coordinate system (viewBox `0 0 200 470`), with internal `<g>` groups per
  animatable joint. No separate files → no scale mismatch; hand-authored beziers → not generic.

- **New component `StudentFigureTraced`** (added alongside the old `StudentFigureSVG`, which is
  kept as a documented fallback — same pattern as `Scene2FigureFallback.jsx`). It is now the
  figure RENDERED in Scene 2 (`.js-lone` → `<StudentFigureTraced />`). Reference-faithful
  details the old figure lacked: a defined facial PROFILE (forehead → nose bump → lips → chin →
  jaw → back-of-skull, all beziers, not a circle + triangle), messy tufted hair, rounded
  shoulders with tee volume, and **FULL-LENGTH navy trousers down to bare feet** (the reference
  wears trousers — the old figure used shorts + thin stick legs with a visible knee seam).
  Palette on-brand: tee `#6a60a4` (violet), trousers `#262350` (navy), hair `#211e44`, skin
  `#8378b6`. ONE arm only (far arm implied behind the torso in profile) — matching the proven rig.

- **Same proven rig, nested SVG groups** (`#sc2-legs` static; `#sc2-body` folds at the hips;
  `#sc2-head`, `#sc2-arm`, and nested `#sc2-fore` inherit the fold automatically — no joint can
  visually disconnect at any scrub position). The arm hangs at the FRONT of the body (not
  centred), so its two pivots moved: shoulder `106 150 → 90 150`, elbow `106 206 → 92 206`, and
  the rotations were re-tuned so the hand lands on the FACE (face-palm) in the folded pose:
  `#sc2-arm` rotation `132 → 146`, `#sc2-fore` rotation `54 → 104`. Body fold unchanged
  (`rotation -58, svgOrigin 108 248`). `tl2` structure, timing, eases, and the ScrollTrigger
  pin/scrub are otherwise identical to the previously-proven version.

- **Verified in the Vite preview (isolated-clone method).** Rest pose: a coherent upright
  side-profile student matching the reference's left figure. Folded pose: torso curved forward,
  head dropped, hand covering the face — matching the reference's right figure — with zero
  disconnection (the folded pose was rendered by applying the exact rig rotations as nested SVG
  `transform` attributes, which compose identically to the GSAP nested rig). Side-by-side vs the
  old inline figure: the new one is **clearly better** (correct head proportion vs the old bobble
  head; continuous trousers vs the old stick legs + knee seam; arm reads as an arm vs a flat
  chest panel). Per the brief's honesty clause, since it is clearly better it is kept ACTIVE.

# Current Phase: SESSION 35 — Google OAuth end-to-end wiring — COMPLETE

## Status: SESSION 35 DONE. Sessions 1–34 also DONE.

**`npm run build` → 491 modules, 0 errors.**

- **`config.py`** — 4 new env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_REDIRECT_URI` (default `:8000/auth/google/callback`), `FRONTEND_URL`
  (default `http://localhost:5173`).
- **`oauth.py`** — `FRONTEND_URL` added; callback now redirects to
  `{FRONTEND_URL}/auth/google/success?token=…&refresh=…` instead of returning JSON.
  Error paths redirect to `{FRONTEND_URL}/login?error=<reason>`.
- **`frontend/src/pages/GoogleAuthSuccess.jsx` (new)** — reads tokens from URL, calls
  `setTokens` + `login()`, routes to `/dashboard` (completed) or `/onboarding` (first time).
- **`frontend/src/App.jsx`** — added public route `/auth/google/success`.
- **`frontend/src/pages/auth/GoogleButton.jsx` (new)** — "or" divider + white "Continue with
  Google" button (4-colour G icon, full-width). On click: hard-nav to `${apiBaseUrl}/auth/google`.
- **`frontend/src/pages/auth/Login.jsx`** + **`Register.jsx`** — each imports `API_BASE_URL` +
  `<GoogleButton apiBaseUrl={API_BASE_URL} />` below their submit button.

**Required `.env` additions:**
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
FRONTEND_URL=http://localhost:5173
```
For production: update both URIs + add them to Google Cloud Console → Authorized redirect URIs.

# Current Phase: SESSION 34 — Landing skyline scale + Scene 3 scrub fade-out fix — COMPLETE

## Status: SESSION 34 DONE. Sessions 1–33 also DONE.

**Only `frontend/src/pages/Landing.jsx` changed. `npm run build` → 489 modules, 0 errors.**

**Three targeted fixes:**

- **SECTION A — Skyline height capped at ≤50vh, building tops never clipped.**
  Root cause: far/mid/near layers used `height: 'auto'` with `overflow: visible` on the
  container. A 1536×1024 PNG at 100% viewport width renders at ~960px tall (e.g. at 1440px
  wide), filling the entire 100vh viewport — the container's `30vh` value was irrelevant
  because `overflow: visible` let the images escape upward. FIX:
  - `.js-city` container: `height: '46vh', maxHeight: '420px'` (desktop); `height: '40vh',
    maxHeight: '360px'` (mobile). Images are now constrained TO the container.
  - far/mid/near layers: `height: 'auto'` → `height: '100%'`; `objectPosition: 'bottom center'`
    → `objectPosition: 'top center'`. With `objectFit: 'cover'` + `objectPosition: 'top center'`,
    the source image's TOP (sky + building tops) fills the container's top, and any excess height
    is cropped from the BOTTOM — building tops are NEVER clipped. The mask gradient on the
    rendered element still dissolves the top edge into the page background. The two mechanisms
    are orthogonal: `objectPosition` controls which edge of the source is cropped; `maskImage`
    controls the soft opacity dissolve into the page — not in conflict.
  - Rooftop layer: unchanged (`height: '16vh', maxHeight: '150px', objectFit: 'cover',
    objectPosition: 'top center'` — already correct from Session 31).

- **SECTION B — Bottom gap/overlap.**
  All layers already had `position: 'absolute', bottom: 0, left: 0` with no offsets. The
  primary gap-elimination is structural: `height: '100%'` images fill the container exactly
  (no overflow past the bottom edge), eliminating the implicit gap the `height: auto` images
  introduced when they were repositioned by parallax.

- **SECTION C — Scene 3 abrupt disappear: root cause identified and fixed.**
  Root cause: the exit tween was `gsap.to('.js-scene3-content', { opacity: 0, y: -40, ...})`.
  The entrance `fromTo` tween applies `opacity: 0` to the element immediately at initialization
  (as the GSAP "from" state, because Scene 3 is below the viewport at page load). When the exit
  `to()` was subsequently created, GSAP captured this `opacity: 0` as the exit tween's own
  starting state — so it animated `0 → 0`, a no-op. The element's opacity never changed during
  the exit scrub, and then other state changes caused an abrupt visual snap.
  FIX: changed exit tween to `gsap.fromTo('.js-scene3-content', { opacity: 1, y: 0 }, {
  opacity: 0, y: -40, ... scrub: true })`. The explicit `{ opacity: 1, y: 0 }` from state
  is not captured at creation time — it is applied at scrub progress=0 — so the exit always
  animates fully-visible → transparent regardless of what the entrance tween has set. Both
  tweens use `scrub: true` (boolean, no smoothing lag), matching scenes 4–6's feel exactly.

# Current Phase: SESSION 33 — Deployment configuration — COMPLETE

## Status: SESSION 33 DONE. Sessions 1–32 also DONE.

**No code deployed. All files are config/documentation only. `npm run build` → 489 modules, 0 errors.**

- **`requirements.txt`** (new) — all backend packages including `gunicorn`.
- **`render.yaml`** (new) — Render Blueprint: `starship-api` web service, gunicorn start command, 13 env vars with `sync: false`.
- **`Procfile`** (new) — Heroku-compatible fallback, same gunicorn command.
- **`database.py`** (updated) — falls back to `psycopg2.connect(DATABASE_URL, sslmode="require")` when `DATABASE_URL` env var is set (Supabase); uses existing `DB_CONFIG` dict otherwise (local dev unchanged).
- **`frontend/vercel.json`** (new) — rewrites all paths to `/index.html` for React Router on Vercel.
- **`frontend/.env.production`** (new) — `VITE_API_BASE_URL=https://starship-api.onrender.com` (update after Render deploy).
- **`docs/DEPLOY.md`** (new) — full step-by-step guide: Supabase → Render → Vercel → post-deploy checklist → custom domain → OAuth/CORS update for production.

**Next step for Aman:** follow `docs/DEPLOY.md`. Start with Supabase (Step 1), then Render (Step 2), then Vercel (Step 3).

# Current Phase: SESSION 32 — Scene 2 figure: real-asset rebuild attempted, inline fallback kept active — COMPLETE

## Status: SESSION 32 DONE. Sessions 1–31 also DONE.

- **Scope: Scene 2 only.** No other scene touched. `npm run build` → **489 modules, 0 errors**.
- **ACTIVE FIGURE: the inline-generated `StudentFigureSVG` in `Landing.jsx`** (unchanged) — a
  clean side-profile student with multi-tone shading (skin/shirt/shorts/hair), driven by the
  proven nested svgOrigin rig (`#sc2-body` hips → `#sc2-arm` shoulder → `#sc2-fore` elbow;
  tl2 rotations −58 / 132 / 54). Verified back in place in the Vite preview after the trial.
- **SAVED ALTERNATIVE: `frontend/src/components/Scene2FigureFallback.jsx`** (new) — a
  self-contained, byte-faithful copy of that working figure + its rig (own
  `gsap.matchMedia` ScrollTrigger pin/scrub, optional `triggerRef`). NOT imported/rendered
  anywhere; exists purely as a re-importable reference.
- **REAL-ASSET REBUILD — attempted and rejected (worse).** Followed the brief end-to-end:
  audited all 15 `/assets/figures/animated/*.svg` viewBoxes, computed uniform scale
  `k = 180/237`, assembled the real `<img>` parts into the nested div rig, and rendered the
  at-rest pose in the preview. It looked clearly worse than the inline figure for reasons
  intrinsic to the traced files: **head.svg (217×265) ≈ torso.svg (218×237) → bobblehead
  proportions**; **all parts share one flat fill `#2b2856` → a monochrome silhouette with no
  skin/shirt/hair separation**; **the near arm is occluded behind the torso** (no hand-to-face
  motion possible); **a visible knee seam** from inconsistent limb trace scales. These can't be
  reconciled without redesigning the assets (out of scope). Same finding as Session 29.
  **Recommendation honoured: kept `StudentFigureSVG` / `Scene2FigureFallback.jsx` active.**

# Current Phase: SESSION 31 — Landing skyline hard-cut, rooftop, Scene 2 bg, Scene 3 transition — COMPLETE

## Status: SESSION 31 DONE. Sessions 1–30 also DONE.

- **SECTION A — skyline hard-cut line.** Root cause: the far/mid/near layers were each
  inside an `overflow:hidden` wrapper (`inset:0`) with a `height:130%` `<img>`, and there
  was **no `maskImage`/`WebkitMaskImage` anywhere in the file** — so each image was
  hard-clipped at the wrapper's top edge. *That `overflow:hidden` clip was the hard
  horizontal line.* FIX: removed the wrappers; the far/mid/near `<img>`s now render directly
  (`position:absolute, bottom:0, width:100%, height:auto, objectFit:cover, objectPosition:
  bottom center`) with a **per-layer mask gradient** dissolving the top of each PNG to
  transparency (far `transparent 0%/30%→black 60%`, mid `0%/20%→50%`, near `0%/10%→40%`),
  `WebkitMaskImage` set identically. Brightness/saturate depth (far 0.42/0.6, mid 0.58/0.72,
  near 0.72/0.85). `.js-city` → `height:30vh / maxHeight:280px`, `overflow:visible`. Parallax
  unchanged (far −4 / mid −10 / near −18 / rooftop −26 scroll; cursor parallax on img refs).
- **SECTION B — rooftop full-width, cropped from the bottom.** Was `objectFit:contain` +
  `maxHeight:22vh` (letterboxed → small). FIX: `width:100%, height:16vh, maxHeight:150px,
  objectFit:cover, objectPosition:'top center', zIndex:4` — full width always; bottom of the
  source cropped (top center keeps the water-tank detail). `display:none`→`onLoad` kept.
- **SECTION C — Scene 2 background.** Section already `background:'transparent'`; the heavy
  `rgba(6,7,26,0.88)` linear overlay was the perceived dark override. Replaced with a subtle
  `radial-gradient(120% 80% at 50% 55%, transparent 50%, rgba(4,6,26,0.18) 100%)` vignette —
  root gradient + starfield show through, continuity with scenes 1 & 3 preserved.
- **SECTION D — Scene 3 transition.** Previous mechanism: a **pinned** ScrollTrigger
  timeline (`pin:true, end:'+=90%', scrub:1`) with a single fade-IN tween and **no fade-out**
  → snapped on pin release + dead-zone before Scene 4. FIX: un-pinned; now the same
  continuous-scrub pattern as scenes 4–6 — `.scene-3` y-parallax + a scrub fade-IN on
  `.js-scene3-content` (`top 80%`→`top 30%`) and a scrub fade-OUT (`bottom 70%`→`bottom 20%`).
  Fades in on enter, out on leave — no snap.
- **`npm run build`** → **489 modules, 0 errors.** Preview: all 4 skyline PNGs load
  (naturalWidth 1536), masks applied, 0 `overflow:hidden` clip wrappers, no console errors.

# Current Phase: SESSION 30 — Landing structural fix (one continuous background, smooth scroll, skyline proportions, dust sound, constellations) — COMPLETE

## Status: SESSION 30 DONE. Sessions 1–29 also DONE.

- **SECTION A — one continuous background spanning the whole page.** Root cause of
  "scenes look cut off" / "starfield only on hero": `StarfieldCanvas` was a child of
  `.js-cam` (scoped to Scene 1) and every scene painted its own solid background
  (`#06071A` / `--deep` / `--void`). FIX: the starfield is now rendered **once** as a
  single `position:fixed` full-viewport canvas (a direct child of the outermost
  `.page-serif` wrapper, `zIndex:0`, behind all scenes) — full-viewport regardless of
  scroll, so the same star field reads through all six scenes. The **dark-navy gradient
  lives once on the outermost `.page-serif` wrapper** (`linear-gradient(to bottom,
  #04061A 0%, #06071A 50%, #0F0E2A 100%)` — the established palette: `--void` → the
  Scene-2 navy → `--deep`). **Scenes 2–6 are now `background:'transparent'`** (Scene 1
  already was) so the single gradient + fixed starfield show through everywhere — zero
  per-scene colour cuts. (Verified: `.page-serif` carries the gradient; one fixed
  Landing starfield canvas; all six scenes `rgba(0,0,0,0)`. The other fixed canvas in
  the DOM is the unrelated transient `LoadingScreen` overlay, which returns null once
  gone.)
- **SECTION B — smooth scroll for scenes 3→6.** Scenes 4/5/6 used Framer Motion
  `whileInView` reveals (IntersectionObserver → abrupt appear/disappear). The Framer
  `Reveal` component was removed (and the `framer-motion` import dropped from Landing);
  its content now uses a plain `ScrollReveal` wrapper (class `js-scroll-reveal`) driven
  by **GSAP ScrollTrigger with `scrub:true`** (`fromTo {opacity:0,y:40} → {opacity:1,
  y:0}`, `start:'top 80%'`, `end:'top 30%'`) — continuous, scroll-linked, matching the
  proven Scenes 1→2 feel. Gated inside the desktop+no-reduced-motion `matchMedia` block,
  so mobile / reduced-motion keep the visible resting state. (5 `.js-scroll-reveal`
  blocks confirmed.)
- **SECTION C — Scene 1 skyline proportions corrected.** The rooftop PNG (the surface
  the student sits on) was filling the whole city container. FIX: rooftop constrained to
  a modest **`maxHeight:'22vh'`, `objectFit:'contain'`, `objectPosition:'bottom center'`**
  (water tank uncropped); the `.js-city` container holding the far/mid/near skyline
  layers raised to **`height:'34vh'`** (mobile 28vh) so the city reads clearly ABOVE and
  BEHIND the rooftop — looking out across a skyline from a rooftop vantage, not at a
  giant rooftop. Z-stacking unchanged (far 1 → mid 2 → near 3 → rooftop 4). Student stays
  at `bottom:7vh` (desktop) — well within the 22vh rooftop, so it reads as seated on the
  surface. (Verified `maxHeight:22vh / objectFit:contain` live.)
- **SECTION D — dust sound (false triggering + timbre).** (1) The trigger was an
  `onMouseMove` on the figure wrapper, firing anywhere inside the box — and because the
  box is inside the GSAP-scaled `.js-cam`, at the zoomed-in start its rect was huge, so
  dust fired "from a distance". FIX: a window-level proximity test (`DUST_RADIUS = 70`)
  measures the figure's real screen box every move via `getBoundingClientRect()` on the
  `.js-seated` wrapper (which hugs the StardustStudent canvas, so the rect tracks the
  camera scale) and only plays dust within **70px** of that box; 200ms throttle kept.
  (2) `playDust()` in `SoundManager.jsx` redesigned from a 180Hz sine→lowpass "thunk" to
  a **short (~70ms) burst of white NOISE** through a **highpass (2kHz) + bandpass (5kHz,
  Q0.7)** — light, airy "shh"/"ffft" granular texture, peak ~0.05, 2ms attack, ~50ms
  decay. No low rumble.
- **SECTION E — constellations.** (1) **Repositioned** all five into the upper sky only
  (top 2–24% / side margins above the rooftop), clear of the headline/subcopy/buttons
  text zone (x~25–75%, y~10–55%) and the rooftop/skyline area. (2) **Labels removed
  entirely** — the `.js-const-label` span, the `label` fields on `CONST_ITEMS`, and every
  label enter/exit/kill tween are gone; constellations are now purely visual. (3)
  **Line-draw exit bug fixed:** every connector element is tagged with a **`.connect-line`
  class at injection** (covering `<line>` AND circular `<circle>`/`<path>`/`<polyline>`
  connectors), and the enter/exit/`killTweensOf` steps all select that class — so
  circular connectors now revert on mouse-out like straight lines (the old tag-name
  selector missed them, leaving them stuck-lit). (Verified: 66 `.connect-line` elements,
  0 labels, 76 star dots intact, items at top 2–24%.)
- **`npm run build`** → **489 modules, 0 errors.** No new console errors in preview.

# Current Phase: SESSION 29 — Landing comprehensive fix (skyline root cause, Scene 2 figure, scene re-map, sound wiring) — COMPLETE

## Status: SESSION 29 DONE. Sessions 1–28 also DONE.

**ROOT CAUSE (Scene 1 rendering failure):** `SKYLINE_LAYERS` in `Landing.jsx` referenced
`layer-far.jpg` / `layer-mid.jpg` / `layer-near.jpg`, but **every skyline file on disk is `.png`**
(`layer-far.png`, `layer-mid.png`, `layer-near.png`, `layer-rooftop.png` — all 1536×1024,
transparent skies). The three JPG `<img>`s 404'd, so the only thing rendering in the lower scene
was the old dark `.js-rooftop` gradient overlay block — that was the "solid colour block + tiny
rooftop" in the screenshot. **All four srcs are now `.png`.** (Verified in-browser: all 4 load,
`naturalWidth>0`.)

- **SECTION 0 — extensions.** Confirmed on disk: skyline = **all .png**; figures = `head.svg`,
  `neck.svg`, `torso.svg`, `{left,right}-{upper-arm,forearm,hand,thigh,calf,foot}.svg` (+ design
  & parts sheets as `.jpg`); photos = `scene3-student-gazing.jpg`, `scene4-paths.jpg`,
  `contact-student.jpg`. Fixed the 3 wrong `.jpg` skyline refs → `.png`.
- **SECTION 1 — placeholder removal.** Deleted the `.js-rooftop` dark-gradient overlay block +
  its glowing edge line (the "solid block" / "thin line at the feet") and the laptop "book-like
  rectangle" decoration. Lower Scene 1 now = 4 skyline PNGs + particle student + its shadow only.
  (No `RoofObjects`/`SeatedStudent`/inline placeholder SVG existed — already removed in 25/26.)
- **SECTION 2 — skyline rebuild.** `.js-city`: `height:38vh`, `maxHeight:340px`,
  `overflow:visible`, `background/border/boxShadow:none`. far/mid/near each in an own
  `overflow:hidden` wrapper with `height:130%` + `objectPosition:bottom` (vertical crop from the
  top, full width); rooftop is `height:auto` in the visible parent (water tank never clipped).
  Depth via **brightness** (opacity 1 everywhere): far `0.4/0.65`, mid `0.55/0.75`,
  near `0.7/0.85`, rooftop `0.8`. **Independent** scroll parallax in `tl1`: far −4, mid −10,
  near −18, rooftop −26.
- **SECTION 3 — student lower.** Particle student `bottom:18vh→7vh` (mobile 12vh→5vh); shadow
  `→6vh` (mobile 4vh). More skyline now reads above/behind the figure.
- **SECTION 4 — Scene 2 figure.** Tried compositing the real `/assets/figures/animated/*.svg`
  parts (verified in-browser): they were traced in **inconsistent poses/scales** (front-view
  torso under a profile head; left forearm horizontal vs right vertical; leg gapped at the knee;
  the arm splayed up like a cheer instead of folding to the face), so they cannot assemble into
  one riggable figure. Per the user's instruction, fell back to a **clean inline-SVG side-profile
  rebuild** (`StudentFigureSVG`) that keeps the reference details (messy hair, nose, profile
  shape, t-shirt + shorts, bare feet). Rig: `#sc2-body` folds at the hips (`svgOrigin 108 248`),
  `#sc2-arm` (shoulder pivot) is its child, `#sc2-fore` (elbow pivot) is the arm's child — so the
  hand covers the face and nothing detaches. `tl2`: body −58°, arm 132°, forearm 54°. Verified
  visually (rest + folded end-state): upper body folds forward, hand covers the face, leg static.
- **SECTION 5 — Discovery (Scene 3) gets the paths image.** (User corrected the scene names: the
  "paths" image belongs on **Discovery**, Possibility stays image-free.) Swapped Scene 3 image
  `scene3-student-gazing.jpg → scene4-paths.jpg`; column padding `3rem→1.5rem`, flex `45%→48%`
  for more presence. Verified visually.
- **SECTION (Possibility / Scene 4) — unchanged** per the user (outcome cards + stat row, no
  image). Comment updated.
- **SECTION 6 — Hope + Contact split.** Scene 5 (Hope) rebuilt as a full-height **two-column**
  scene: text LEFT (HOPE label, "Talent exists everywhere…" headline, "Start your journey"
  button, all left-aligned, vertically centred) + the **stargazer** image
  (`scene3-student-gazing.jpg`) RIGHT with a pulsing glow border (`.js-scene5-glow`, GSAP 2s
  yoyo) + hover scale. Contact is now its **own** section (`.scene-6`): `contact-student.jpg` +
  "Get In Touch" / "Have questions?" / `hello@projectstarship.in`. Added `tl` entrance for
  `.scene-6`. Verified both visually.
- **SECTION 7 — sounds.** `SoundManager.jsx` already had all functions intact & spec-compliant
  (chime 900/920Hz, dust 180Hz→lowpass300, click 420+210Hz) — **unchanged**. Traced every call
  site: `playChime` (constellation), `playDust` (hero student), `startWind` (scroll),
  `playClick` (Assessment likert+mcq), `playWhoosh` (checkpoint), `playHover` (AppShell nav) all
  present. **Added missing `playClick` wiring**: Landing `CTA` + TopBar "Begin", AppShell
  wordmark/profile/logout (`guardedNavigate`/`handleLogout`), Profile retake.
- **Files:** `frontend/src/pages/Landing.jsx`, `frontend/src/layouts/AppShell.jsx`,
  `frontend/src/pages/Profile.jsx`. (`SoundManager.jsx` unchanged.)
- **`npm run build`** → **489 modules, 0 errors.**

# Current Phase: SESSION 28 — Landing Scenes 2/3/4 visual rebuild — COMPLETE

## Status: SESSION 28 DONE. Sessions 1–27 also DONE.
- **Scene 2 — crowd removed, SVG crowd + inline SVG student built from scratch**
  - `crowd-pressure.jpg` `<img>` removed from Scene 2; no photograph on screen.
  - New `CrowdBackground` component: pure inline SVG, 15 front-row figures + 12 back-row figures,
    each a circle head (r=8) + rounded-rect body (width=18, height=40, rx=4) in
    `rgba(29,158,117,0.12)` front / `rgba(29,158,117,0.07)` back. `preserveAspectRatio="xMidYMax slice"`.
  - `CompositeFigure` component (which loaded `.svg` image files from `/assets/figures/animated/`)
    deleted. New `StudentFigureSVG` component: fully inline SVG, `viewBox="0 0 180 400"`,
    colour `#534AB7`. Groups with IDs for GSAP: `sc2-head`, `sc2-torso`, `sc2-left-upper-arm`,
    `sc2-right-upper-arm`, `sc2-left-forearm`, `sc2-right-forearm`, `sc2-legs`.
    All animated groups have `style={{ transformBox: 'fill-box', transformOrigin: 'center top' }}`
    (head uses `center bottom`). Ground shadow ellipse at y=395.
  - `tl2` updated: old `.js-student-back`/`.js-student-arms`/`.js-student-head` tweens replaced
    with 6 new `.to('#sc2-*', ...)` tweens (rotateX:40 torso, rotate:±100 upper arms,
    rotateX:20 head, rotate:±30 forearms, all `ease:power2.inOut`, `duration:1`).
- **Scene 3 — correct image + updated layout**
  - Image was `student-design-sheet.jpg` (wrong). Now `/assets/photos/scene3-student-gazing.jpg`.
  - Left column: `45%` width (was 48%), `padding:3rem` (was 2rem).
  - Glow wrapper: `border 1px rgba(83,74,183,0.5)`, `borderRadius:18px`, `padding:6px`,
    `background rgba(83,74,183,0.04)`, CSS hover `scale(1.03)` transition 0.5s.
  - Image: `maxHeight:420px` (was 360), `borderRadius:16px`.
  - GSAP glow: `duration:2` (was 2.5), `rgba(83,74,183,0.15)` (was 0.2).
  - Right column: `55%` width (was 52%), `paddingLeft:3rem`, `maxWidth:440`.
- **Scene 4 — no stargazer asset**
  - Checked `/assets/figures/` — no file matches stargazer/silhouette/student-looking-up.
  - Added comment `{/* stargazer image — asset not found in /assets/figures/ */}` above scene.
  - Career cards and stat counters untouched.
- **Scene 1 + Scene 5 untouched.** GSAP ScrollTrigger timeline structure untouched.
- **`npm run build`** → **489 modules, 0 errors**.

# Current Phase: SESSION 27 — Real OTP delivery via MSG91 SMS + Resend email — COMPLETE

## Status: SESSION 27 DONE. Sessions 1–26 also DONE.
- **`notifications.py` (new)** — `send_otp_sms` (MSG91 Flow API), `send_otp_email` (Resend),
  `send_password_reset_email` (Resend). All return True/False, never raise. Graceful no-op when
  API keys are absent (logs warning + returns False). Phone normalised to `91XXXXXXXXXX`.
- **`config.py`** — 5 new env vars: `MSG91_AUTH_KEY`, `MSG91_SENDER_ID` (default `STRSHP`),
  `MSG91_TEMPLATE_ID`, `RESEND_API_KEY`, `FROM_EMAIL` (default `noreply@projectstarship.in`).
- **`auth.py`** — `generate_otp()` now returns `str(secrets.randbelow(900000) + 100000)` (real
  random, cryptographically secure). Hardcoded `"123456"` removed. New `deliver_otp(phone, email,
  otp, name="")`: tries SMS first, falls back to email; warns if both fail but OTP still in DB.
  Imports `send_otp_sms`, `send_otp_email`, `send_password_reset_email` from `notifications`.
- **`api.py`** — 4 OTP delivery call sites updated:
  - `POST /auth/register`: calls `deliver_otp(req.phone_number, req.email, otp)` after DB insert.
  - `POST /auth/login` (OTP path): SELECT now fetches `email, phone_number`; calls `deliver_otp`.
  - `POST /auth/resend-otp`: SELECT `email, phone_number` for student; calls `deliver_otp`.
  - `POST /auth/forgot-password`: calls `send_password_reset_email(email, otp)` for email users;
    `send_otp_sms(phone, otp)` for phone-only users. OTP IS the reset token (verified at `/auth/reset-password`).
- **OTP validation logic unchanged** — `hash_otp`, `verify_otp`, `otp_expiry` untouched. No route
  signatures, response shapes, or JWT logic changed.
- **Required .env keys** (add to `.env`, currently missing):
  ```
  # MSG91_AUTH_KEY=your_msg91_auth_key_here
  # MSG91_SENDER_ID=STRSHP
  # MSG91_TEMPLATE_ID=your_template_id_here
  # RESEND_API_KEY=your_resend_api_key_here
  # FROM_EMAIL=noreply@projectstarship.in
  ```
  Without these keys, OTP is still saved to DB and can be retrieved directly for testing.

# Current Phase: SESSION 26 — Scene 1 surgical fixes (skyline dissolve, rooftop hide, dead code removal) — COMPLETE

## Status: SESSION 26 DONE. Sessions 1–25 also DONE.
- **FIX 1 — Dead SeatedStudent removed** — `SeatedStudent` SVG function, `const FILL`, and the dead `.js-head` GSAP tween all deleted. No named RoofObjects variants existed in the file. `StardustStudent` + shadow remain (they are the live particle student, not children of the rooftop layer).
- **FIX 2 — Skyline dissolve strengthened** — Mask gradients extended so more of the top fades to transparent before buildings appear: `far transparent 0%→35% black 65%`, `mid transparent 0%→25% black 55%`, `near transparent 0%→15% black 45%`. Rooftop PNG layer retains no mask (transparency handles blending). `.js-city` container now explicitly sets `border:'none'` and `boxShadow:'none'` alongside `background:'none'` — no hard edge possible. `WebkitMaskImage` already matched `maskImage` via the spread.
- **FIX 3 — Rooftop layer hidden until PNG loads** — Rooftop `<img>` starts with `display:'none'`; `onLoad` sets `display:'block'`. `onError` keeps `display:'none'`. Missing PNG → invisible layer, no broken image, no solid block.
- **`npm run build`** → **489 modules, 0 errors**.

# Current Phase: SESSION 25 — Scene 1 refinements (skyline scale, rooftop PNG, constellation exit fix, sound tuning, student shadow, mobile) — COMPLETE

## Status: SESSION 25 DONE. Sessions 1–24 also DONE.
- **Skyline height** — `.js-city` container: `height:18vh` / `maxHeight:160px` (was 65vh). ~10–15% of viewport,
  matching the original placeholder skyline. Mobile: `height:12vh` / `maxHeight:100px`.
- **Rooftop PNG** — `layer-rooftop.jpg` → `layer-rooftop.png`. No `maskImage` on PNG layer (transparency handles
  blending). Filter changed to `brightness(0.85)` (was `brightness(0.65) saturate(0.9)`). `objectFit:'contain'`
  so water tank / rooftop objects are never clipped.
- **Removed RoofObjects** — SVG line-art water tank + vent box function deleted. PNG rooftop replaces them.
- **Constellation exit fix** — `activeIndex` replaced with per-constellation `isActive[]` boolean array.
  `gsap.killTweensOf(data.lines)` called BEFORE starting the exit tween — this prevents an in-progress enter
  tween from overriding exit (root cause of stuck-lit bug). `visibilitychange` listener force-exits all active
  constellations when the tab is hidden.
- **Constellation positions** — repositioned to avoid hero text zone: microscope `8%/left:4%`, airplane `6%/right:5%`,
  scales `55%/left:3%`, camera `50%/right:4%`, stethoscope `65%/right:18%`. Scale `0.65` on desktop. Mobile:
  `scale(0.45)`, stethoscope hidden, remaining 4 in corners. `ConstellationLayer` no longer gated by `!isMobile`.
- **Student shadow** — radial-gradient ellipse div at `bottom:18vh` (desktop) / `12vh` (mobile), `zIndex:4`,
  `blur(5px)`. Grounded beneath the particle figure.
- **Student re-anchor** — `bottom:18vh` (was `11%`). Mobile size 65% of desktop: `182×221` (was `196×238`).
  Laptop decoration updated to `bottom:calc(18vh + 1px)`.
- **Dust repulsion sound** — `playDust()` added to `SoundManager.jsx`: 180Hz sine → lowpass 300Hz → gain
  0→0.06 over 8ms, decay to 0.0001 over 130ms. Called in `Landing.jsx` via `onMouseMove` on the student,
  throttled to 200ms via `lastDustTimeRef`.
- **Chime tuning** — `playChime()`: freqs `1900/1940Hz → 900/920Hz`, gain `0.18 → 0.09`, decay `140ms → 200ms`.
  Softer, lower-pitched, warmer tail.
- **Mobile skyline filters** — 0.9× brightness multiplier on mobile for all layers.
- **Hero headline** — `fontSize: 'clamp(2rem, 5vw, 4rem)'` (was `var(--fs-hero)`), scales correctly on mobile.
- **`npm run build`** → **489 modules, 0 errors**.

# Current Phase: SESSION 24 — Scene 1 sky masking, layer depth + constellation timing — COMPLETE

## Status: SESSION 24 DONE. Sessions 1–23 also DONE.
- **FIX 1** — `mixBlendMode` removed from all skyline `<img>` elements (doesn't work on colour photos).
- **FIX 2** — CSS `maskImage` per layer fades the sky to transparent, buildings emerge from darkness. Per-layer
  gradients: far `transparent 0%→20%, black 50%`; mid `0%→15%, 40%`; near `0%→10%, 35%`; rooftop `0%→5%, 25%`.
- **FIX 3** — Layers at `opacity:1`, dimmed via `filter:brightness(0.35–0.65) saturate(0.6–0.9)`. No ghostly
  transparency.
- **FIX 4** — All layers `position:absolute, bottom:0, zIndex:1–4`. Container (`js-city`): `height:65vh`,
  `overflow:visible` (was `hidden` — clipped rooftop), `zIndex:1`. Student + decoration `zIndex:5`.
- **FIX 5** — Four `tl1.to()` parallax tweens at position 0 (`ease:none`): far `yPercent:-6`, mid `-12`,
  near `-20`, rooftop `-28`. Refs wired directly (no `document.querySelector`).
- **FIX 6** — Constellation scroll fade moved from position `0.58` → `0.7` in `tl1` (`opacity:0, duration:0.3`).
  Constellations stay visible throughout Scene 1, fade only as it scrolls away. `ConstellationLayer` converted
  to `forwardRef`; `constellationRef` wired from `Landing`. Hover system unchanged.
- **FIX 7** — Cursor parallax `gsap.quickTo` added per layer (far × 0.006, mid × 0.013, near × 0.022;
  rooftop fixed). `safeQuickTo` wrapper handles null targets (missing images). Wired into existing `onMove`.
- `npm run build` → **489 modules, 0 errors**.

# Current Phase: SESSION 23 — Scene 1 fixes (skyline blend + constellation animation) — COMPLETE

## Status: SESSION 23 DONE. Sessions 1–22 also DONE.
- **Skyline blending (`SkylineLayers` + `.js-city` wrapper)** — `mixBlendMode:'screen'` added
  to every skyline `<img>` so dark/black JPG backgrounds are transparent and only the lit
  building silhouettes show against the starfield. Per-layer `maxHeight` sizing:
  `layer-far` 70vh, `layer-mid` 55vh, `layer-near` 45vh, `layer-rooftop` 35vh.
  `layer-rooftop` uses `objectFit:'contain'` + `objectPosition:'bottom center'` (was
  overcropped). `SKYLINE_LAYERS` constant changed from a string array to an array of
  per-layer style objects. `.js-city` wrapper: `height:44%` → `60vh`, `background:'none'`
  explicit (required for screen blend), `overflow:'hidden'`, `right:0` → `width:'100%'`.
- **Constellation draw animation (`ConstellationLayer` rewrite):**
  - **rAF layout fix** — SVG `innerHTML` is injected first; `getTotalLength()` is now
    called inside a `requestAnimationFrame` callback so elements have computed geometry
    before measurement. Fixes lines with zero-length dasharray that never drew.
  - **Stored lens** — per-constellation `{ lines, circles, lineGroup, labelEl, lens[] }`
    stored in a `constData` array after the rAF pass. Exit no longer re-measures on
    every mousemove, eliminating the "stuck lit" bug caused by stale length values.
  - **Idle state** — lines: `strokeDasharray=len, strokeDashoffset=len, opacity:1`
    (hidden by dashoffset, not opacity); circles: `opacity:0.35, filter:none`;
    `lineGroup` always `opacity:1` — dashoffset is the sole draw gate.
  - **Enter** — `gsap.to(data.lines, { strokeDashoffset:0, stagger:0.07, duration:0.4 })`;
    `gsap.to(data.circles, { opacity:1, filter:'drop-shadow(...)' })`.
  - **Exit** — explicit `gsap.to(data.lines, { strokeDashoffset:(idx)=>data.lens[idx], ... })`;
    `gsap.to(data.circles, { opacity:0.35, filter:'none' })`; no `gsap.reverse()`.
  - **Unmount cleanup** — `gsap.killTweensOf([...lines, ...circles, labelEl])` registered
    in `cleanupFns` alongside the mousemove remove. Prevents stuck state on re-render.
  - Proximity detection: `getBoundingClientRect()` on every `mousemove` (unchanged —
    already correct in Session 18).
- `npm run build` → **489 modules, 0 errors**.

# Current Phase: SESSION 22 — Global UI polish pass — COMPLETE

## Status: SESSION 22 DONE. Sessions 1–21 also DONE.
- **Button audit** — All buttons across auth, assessment, dashboard, careers, results,
  roadmap, profile, HowItWorks, AppShell standardised: padding `var(--btn-py) var(--btn-px)`
  (10px 20px) or `var(--btn-py-sm) var(--btn-px-sm)` (6px 16px), radius `var(--radius-md)`
  (10px). Hover: opacity shift 0.88 or `--glow-violet` on primary CTA. No colour inversion.
  New tokens in `tokens.css`: `--radius-md`, `--btn-py/px`, `--btn-py-sm/px-sm`, `--moonstone`.
- **Landing Scenes 2–5** — Copy blocks `maxWidth:600`, centered, `clamp()` padding. TopBar
  "Begin" → `--violet` filled button with hover glow (no fill change on hover).
- **Auth warmth (`AuthShell.jsx`)** — Radial gradient overlay, card `1px solid rgba(255,255,255,0.08)`
  + `box-shadow 0 0 40px rgba(83,74,183,0.15)`, STARSHIP wordmark `clamp(1.1rem,2vw,1.4rem)` /
  `0.12em` tracking / `--stardust` colour.
- **Typography rhythm** — `lineHeight: var(--lh-body)` (1.8) throughout; all 1.6/1.7 literals
  removed. Section heading `margin-bottom: 1.5rem`. `CareerCard` title `fontSize 18` → `var(--fs-body)`.
- **Mobile spacing** — Card grid gap `clamp(12px,3vw,18px)`. Roadmap country chips:
  `flexWrap:nowrap, overflowX:auto, scrollbarWidth:none`. HowItWorks `SpotIllustration`
  `isMobile ? 80 : 132` px.
- Files touched: `tokens.css`, `AuthShell.jsx`, `AppShell.jsx`, `Landing.jsx`, `Assessment.jsx`,
  `Dashboard.jsx`, `Careers.jsx`, `Results.jsx`, `Roadmap.jsx`, `Profile.jsx`, `Onboarding.jsx`,
  `HowItWorks.jsx`, `CareerCard.jsx`.
- `npm run build` → **489 modules, 0 errors**.

# Current Phase: SESSION 21 — Landing Scenes 2–5 visual rebuild — COMPLETE

## Status: SESSION 21 DONE. Sessions 1–20 also DONE.
- **Scene 2 (Pressure):** Background changed to dark navy `var(--deep)` (no full-bleed image). Crowd added as contained `crowd-pressure.jpg` illustration (`max-width: 85vw`, `opacity: 0.45`, bottom-aligned). Dark gradient overlay (`linear-gradient(to top, ...)`). GSAP tl2 updated: `.js-student-back` `rotateX` 0→35deg (`transformPerspective: 800`); `.js-student-arms` `rotate` 0→-110deg; `.js-student-head` (new class on CompositeFigure head) `rotateX` 0→15deg. Scene copy stays at `zIndex: 4`.
- **Scene 3 (Discovery):** Removed full-bleed `student-design-sheet.jpg` background. Two-column layout (LEFT 48% = contained image card with glow border + `boxShadow`; RIGHT 52% = copy). Glow border pulse animation wired via `ScrollTrigger.create({ trigger: '.scene-3', start: 'top 80%', once: true })` → `glowTween.play()`. Mobile: stacks vertically, image on top.
- **Scene 4 (Possibility):** No changes (no stargazer asset found). Comment `{/* stargazer image — awaiting asset */}` added.
- **Scene 5 (Hope + Contact):** Removed `StandingStudent` function + `CROWD` constant (already removed) and the gathering JSX block. `paddingBottom: 0 → 80`. Added divider (`1px rgba(255,255,255,0.06)`). Added two-column contact section: LEFT 45% = `contact-student.jpg` with static glow border + CSS hover zoom `scale(1.03)` (no GSAP); RIGHT 55% = "Get In Touch" eyebrow, "Have questions?" heading, body copy, `mailto:hello@projectstarship.in` in `var(--aurora)`.
- `npm run build` → **489 modules, 0 errors** (unchanged count).

# Current Phase: SESSION 20 — Scholarship detail panels + roadmap pathways — COMPLETE

## Status: SESSION 20 DONE. Sessions 1–19 also DONE.
- **Scholarship cards** — `ScholarshipCard.jsx` rewritten with clickable card + inline
  `AnimatePresence` detail panel (description, eligibility, provider, stream-tag pills,
  deadline, Apply button). Only one open at a time (parent-controlled `expanded`/`onToggle`).
  Esc closes. Backend: `score_assessment.py` scholarship SELECT extended to return 6 new
  fields; `Results.jsx` passes them through + manages `expandedScholarship` state.
- **Roadmap pathways** — `Roadmap.jsx` gained `PATHWAY_ALTERNATIVES` map (JEE/NEET/CLAT/
  CAT/GATE/UPSC) and per-step keyword scan. Matched steps show a "▾ Other routes"
  chevron toggle that reveals alternative routes as violet pills via `AnimatePresence`.
  No backend or DB changes.
- `npm run build` → **489 modules, 0 errors**.

# Current Phase: SESSION 19 — Sound layer (Web Audio API + ambient wind) — COMPLETE

## Status: SESSION 19 DONE. Sessions 1–18 also DONE.
- **`frontend/src/components/SoundManager.jsx` (new)** — `SoundManagerProvider` +
  `useSoundManager()` hook. Single AudioContext created only after the first
  mousedown/touchstart (never before — no autoplay block). Four synthesis functions:
  - `playChime()` — two sine oscillators at 1900/1940 Hz (shimmer/doubling),
    attack 4ms → decay 140ms, total 150ms. Used for constellation proximity enter.
  - `playClick()` — 420 Hz sine (0.22 peak, 40ms) + 210 Hz triangle (0.10, 25ms).
    Warm tactile click. Used for BubbleScale + McqChoices.
  - `playWhoosh()` — 0.4s white-noise → bandpass (600 Hz, Q 0.8) → gain ramp
    60ms/decay 340ms. Used when CheckpointOverlay fires.
  - `playHover()` — 1100 Hz sine, 0.08 peak, 65ms. Used for nav link mouseenter.
  - All are no-ops when `soundEnabled=false` or AudioContext not yet created.
  - `soundEnabled` persisted to `localStorage('starship_sound')`, default `true`.
  - `unlocked` becomes true after first gesture.
  - `startWind()` — fades HTMLAudioElement (`/assets/sounds/wind-ambient.mp3`,
    loop, volume 0→0.10 over 2s). Pauses on `visibilitychange: hidden`. Silent
    try/catch if file missing.
- **`frontend/src/main.jsx`** — `<SoundManagerProvider>` wraps `<AuthProvider>`,
  which wraps `<App>`.
- **`frontend/src/components/index.js`** — barrel exports `SoundManagerProvider`
  and `useSoundManager`.
- **`frontend/src/layouts/AppShell.jsx`** — imports `useSoundManager`; nav
  wordmark + profile link get `onMouseEnter={playHover}`; sound toggle button
  added to the right side of the nav (24×24 inline SVG speaker icon, `--stardust`,
  opacity 0.55 idle → 1.0 on hover, slash-through when muted, no label/border/bg).
- **`frontend/src/pages/Assessment.jsx`** — imports `useSoundManager`; `playClick()`
  on every likert BubbleScale selection (`onLikert`) and every MCQ option tap
  (`onMcqSelect`); `playWhoosh()` called alongside `setCheckpoint()` when a
  CheckpointOverlay fires.
- **`frontend/src/pages/Landing.jsx`** — imports `useSoundManager`; `playChime`
  passed as `onChime` prop to `ConstellationLayer` (already had the call-site);
  `useEffect` on `unlocked` adds a scroll listener that calls `startWind()` when
  `scrollY > window.innerHeight * 0.1`, then removes itself.
- **Build: 489 modules, zero errors** (was 488).

# Current Phase: SESSION 18 — Landing Scene 1 visual upgrade — COMPLETE

## Status: SESSION 18 DONE. Sessions 1–17 also DONE.
- **Scene 1 skyline** — `CitySkyline` SVG replaced with `SkylineLayers` (4 JPG `<img>`
  layers: far/mid/near/rooftop). Container expanded to `height:44%`. Silent `onError`
  hides missing layers. `.js-window` tween removed.
- **Scene 1 constellations** — Old hardcoded geometric SVGs replaced with
  `ConstellationLayer`: fetches 5 real SVGs inline via `fetch()`, proximity detection
  (130px enter / 160px exit hysteresis), GSAP draw-in (dashoffset), label fade-in,
  scroll fade-out tween added to `tl1` at position 0.58. Reduced-motion safe.
- **Unchanged:** Scenes 2–5, StarfieldCanvas, all GSAP ScrollTrigger timelines,
  `Constellation` + `DIM_SKY` (Scene 2), every other page. `npm run build` → **488
  modules, 0 errors**.

# Current Phase: SESSION 17 — Data expansion (careers / scholarships / universities) — PARTIAL

## Status: SESSION 17 PARTIAL (2 of 3 scripts succeeded). Sessions 1–16 DONE. Phases 6, 7A, 7B all DONE.
- **Session 17 (data expansion) — PARTIAL.** Three idempotent expansion scripts written;
  scholarships + universities succeeded, careers did NOT insert this run.
  - **`scrapers/scholarships_expand.py` (new) — ✅ DONE.** Inserted **51** curated REAL
    schemes; `scholarships` **45 → 96** (2 already existed). Mix: government 34 / private 11
    / ngo 6 — NSP family, AICTE (Pragati/Saksham/Swanath), DST INSPIRE, PMSS, Ishan Uday,
    HDFC, Tata Capital, Buddy4Study, 14 state schemes, minority/SC-ST-OBC, sports,
    girl-child, stream-specific. Curated (not AI) so amounts/URLs are real. Added columns via
    `ADD COLUMN IF NOT EXISTS`: `description`, `amount_min_inr`, `eligibility_criteria`,
    `deadline_month`, `stream_tags TEXT[]`, `provider_type`, `data_source`. Idempotent via
    case-insensitive existence check (no unique constraint on `scholarship_name`).
  - **`scrapers/universities_expand.py` (new) — ✅ DONE.** Inserted **168** curated real
    institutions (India: 123, Abroad: 45); `universities` **9,550 → 9,718**. 301 of the 469
    curated entries already existed and were skipped. Covers IITs/NITs/IIITs/IIMs/IISERs/
    NLUs/AIIMS + medical, central + state + private/deemed, design/fashion, agri/open; abroad
    USA/UK/Canada/Australia/Singapore/Germany/UAE/Hong Kong. New rows tagged
    `data_source='curated'` with `normalized_name`. Idempotent via case-insensitive existence
    check (NO unique constraint on `university_name`; table already had 326 duplicate names,
    so `ON CONFLICT (name)` was impossible). Existing 514 costed rows untouched.
  - **`scrapers/careers_expand.py` (new) — ✅ DONE (Session 17B re-run).** `career_profiles`
    **25 → 221** (**196 inserted**, 0 skipped). Fixed by lowering `BATCH_SIZE` to **4** and
    adding a retry loop (up to 2 retries per batch) + 1.5s inter-batch sleep. All 49 batches
    parsed cleanly with zero retries needed. `data_source`: `ai_generated` 196 · `manual` 25.

# Current Phase: SESSION 16 — Aptitude score normalization fix — COMPLETE

## Status: SESSION 16 DONE. Sessions 1–15 also DONE. Phases 6, 7A, 7B all DONE.
- **Session 16 (aptitude normalization bug fix) — COMPLETE.**
  - **`score_assessment.py`** only. Added `max_possible_scores = defaultdict(float)` and
    populate it in the raw-score accumulation loop with `(1.0 if question_type == 'mcq' else
    5.0) * weight` per question/trait pair. Normalization now divides by
    `max_possible_scores[trait]` (was `question_counts[trait] * 5`).
  - **Before:** `{numerical 14.67, logical 16.0, verbal 14.0, analytical 16.0}` — scores
    deflated 5× because MCQ max option_value (1) was being divided by the likert max (5).
  - **After (verified live for student 12):** `{numerical 73.33, logical 80.0, verbal 70.0,
    analytical 80.0}` — correct 0–100 range. RIASEC scores unchanged. All 12 result keys
    intact. `npm run build` → 488 modules, zero errors.
  - **`aptitudeMatch.js`:** no changes needed — RIASEC weights already sum to 1.0 and the
    function clamps to 0–100; it was correct but receiving deflated inputs.

# Current Phase: SESSION 15 — University cutoffs expansion — COMPLETE

## Status: SESSION 15 DONE. Sessions 1–14 also DONE. Phases 6, 7A, 7B all DONE.
- **Session 15 (university cutoffs expansion) — COMPLETE.**
  - **`scrapers/university_cutoffs.py` (new)** expanded `university_cutoffs` from **3 → 507
    rows** (504 `ai_estimated` + 3 `manual`) across **49 universities**, AI-estimated via
    Cohere (`command-r-plus-08-2024`) for the **top 50 costed universities** (ordered by name).
  - **Made the data engine-consumable.** The engine reads cutoffs by
    `JOIN exams e ON uc.exam_id=e.exam_id WHERE e.exam_name = career_profiles.required_exam
    AND uc.field_id = programs.field_id`. The `exams` table only shipped 4 rows and most
    `required_exam` values are compound strings ("JEE Main / JEE Advanced",
    "JEE / GATE (optional)", "CLAT", …) that weren't in it — so the scraper idempotently
    **seeds `exams`** (20 newly seeded, `exam_type='entrance'`/`country='India'`) and anchors
    every cutoff to the leaf `(field_id, field_name, exam_name)` pairs the engine actually
    queries (derived from the live `programs`/`career_profiles` join).
  - Added `university_cutoffs.data_source VARCHAR(30)` (`ADD COLUMN IF NOT EXISTS`); the 3
    pre-existing rows tagged `'manual'`. Writes use
    `INSERT … ON CONFLICT (university_id, exam_id, field_name) DO NOTHING` and commit
    per-university — **safe to re-run** (skips universities that already have cutoffs; a
    re-run retries the 4 that returned an unparseable Cohere format). `--limit` extends
    coverage past the top 50.
  - **Verified** the engine's exact join returns real rows (e.g. Aligarh + "JEE Advanced" +
    field 7 → `(85,150,4,'ai_estimated')`; Amrita + "NEET UG" + field 10 → `(85,600,5,…)`)
    and the `competitiveness_level`-by-name lookup resolves. Backend code (engine / api.py)
    and frontend were **not touched**.
- **Session 14 (data router migration + useBlocker) — COMPLETE.**
  - **`frontend/src/App.jsx`** — replaced `<BrowserRouter><Routes>` with
    `createBrowserRouter` + `RouterProvider` (React Router v6 data API). The
    route tree is byte-identical to before: same paths, same `<ProtectedRoute>` →
    `<AppShell>` nesting, same public/auth/protected split, same `* → /` catch-all.
    `AuthProvider` stays outside `RouterProvider` in `main.jsx` (it uses no router
    hooks — confirmed). `BrowserRouter` import removed from `main.jsx`.
  - **`frontend/src/pages/Assessment.jsx`** — `useBlocker(unsavedChanges)` added
    (requires the data router). Fires whenever `unsavedChanges === true` (i.e. after
    the first answer saves and before `/submit-assessment` succeeds). On block, renders
    **`BlockerModal`** — an inline normal-flow faux-viewport (no `position:fixed`):
    `minHeight: calc(100vh - 58px)`, dark `rgba(4,6,26,0.88)` overlay, `--violet`
    bordered card, Esc → Stay. Buttons: **"Stay"** (violet, autoFocus) calls
    `blocker.reset()`; **"Leave anyway"** (outline) calls `blocker.proceed()`. Copy:
    *"If you go back now, your progress will be lost."*
  - The existing `NavGuardContext` + `ConfirmLeaveModal` (for AppShell shell
    controls — wordmark / profile / logout) is **preserved untouched**. The two
    guards are complementary: NavGuard intercepts SPA shell-control navigation;
    `useBlocker` intercepts the browser Back button and any other programmatic
    navigation away from `/assessment`.
  - `npm run build` → **488 modules, zero errors** (unchanged count; +1
    `BlockerModal` sub-component offset by no new files).
- **Session 13 (country-specific salary on Roadmap) — COMPLETE.**
  - **`migrations/006_country_salaries.sql`** (applied — do NOT re-run): adds
    `country_salary JSONB` to `career_profiles`; populates all **25** careers × **9**
    regions (IN US GB CA AU SG HK AE EU) with realistic mid-career figures — NOT
    currency conversions of India numbers (e.g. US Doctor $200k–$350k, India Doctor
    ₹6L–₹25L). India entry exactly matches `salary_min_inr`/`salary_max_inr`. Growth
    outlook is country-specific; "Very High" is a new valid outlook value.
  - **`api.py` `/career-roadmap`** (additive): SELECT now fetches `country_salary`;
    returned as `career_details[career_name].country_salary`. No other endpoints touched.
  - **`frontend/src/utils/salaryData.js`** (new): exports `COUNTRIES` (9-entry array:
    `{ code, label, flag, currencySymbol, currencyCode }`) + `getSalaryForCountry(
    careerName, countryCode, careerDetails)`.
  - **`pages/Roadmap.jsx`** rewritten (structure preserved): `selectedCountry` state
    (default `'IN'`); 9-chip horizontal pill-toggle above the salary section (`--violet`
    glow + tinted bg on active); salary display: India → `₹X,XX,XXX – ₹Y,YY,YYY / year`,
    other countries → `$120k–$200k/yr  or  ₹1.01Cr–₹1.68Cr/yr`; `OutlookBadge`
    handles "Very High" → `--glow`; disclaimer *"Figures are approximate mid-career
    estimates and vary by employer, city, and experience."* below salary. Falls back to
    top-level `salary_min_inr`/`salary_max_inr` columns when `country_salary` absent.
  - `npm run build` → **488 modules, zero errors**. Zero console errors in preview.
- **Session 12 (re-take assessment flow) — COMPLETE.**
  - **Backend (`api.py`):** new `DELETE /assessment` (JWT-protected). Deletes all
    `assessment_sessions` rows for the student (CASCADE removes
    `student_question_responses_v2`), pops `LATEST_RESULTS[student_id]`, returns
    `{"status": "cleared"}`.
  - **Profile.jsx:** replaced the old "Retake the assessment →" link with a coral
    outline "Re-take assessment" button. On click renders an inline confirmation box
    (no `position:fixed` — normal-flow wrapper with `min-height:112px`): violet border,
    dark `--deep` background, copy "This will clear your results and career matches.
    This cannot be undone.", "Yes, re-take" (coral outline) + "Cancel" buttons. On
    confirm: `DELETE /assessment` → `setResults(null)` → `setStudent` clears
    `has_completed_assessment` → `navigate('/assessment')`.
  - **Dashboard.jsx:** added a small text link at the very bottom:
    "Want to start fresh? Re-take the assessment →". Same inline confirmation pattern
    (min-height:116px wrapper, violet border, identical copy and button styles).
    Shares the same `handleRetake` logic.
  - `npm run build` → **487 modules, zero errors**.
- **Session 11 (per-career weighted aptitude match) — COMPLETE.**
  - New **`frontend/src/utils/aptitudeMatch.js`**: `getAptitudeMatch(career_name,
    career_categories, aptitude_scores)` returns a 0–100 score weighted by the
    career's RIASEC primary trait (R→numerical/logical; I→logical/analytical/numerical;
    A→verbal/analytical; S→verbal/analytical; E→verbal/logical/analytical;
    C→numerical/analytical/logical). Flat-mean fallback when no trait mapping.
  - **Dashboard + Careers** career cards now show a **per-career distinct** Aptitude %
    (previously every card showed the identical flat mean). `npm run build` → **487 modules, 0 errors**.
- **Session 10 (Dashboard + Careers + counselor prominence + bubble tooltips) — COMPLETE & verified live.**
  - New **`/dashboard`** (`pages/Dashboard.jsx`, protected) is where a completed
    student now LANDS (Onboarding + Assessment redirect here; the post-submit
    transition navigates here). Sections: welcome, top-3 careers with per-card
    **Interest Match %** (`scoreToPercent(score)`) + **Aptitude Match %** (per-career
    weighted via `getAptitudeMatch`) + category badge, RIASEC radar (**280px**), four
    aptitude bars (Numerical/Logical/Analytical/Verbal), quick links, Scholars teaser.
  - New **`/careers`** (`pages/Careers.jsx`, protected): full ranked
    `career_matches` + client-side name search + RIASEC-category filter; card → /roadmap.
  - **Results cached in AuthContext** (`results`/`setResults`): set after submit,
    restored on mount for completed students; Dashboard/Results/Careers read it
    (self-fetch `GET /results` fallback).
  - **Prominent Dashboard counselor card** (`components/DashboardCounselor.jsx`):
    input + send opens the controlled AIOrb panel **pre-populated**; 3s `--violet`
    border pulse. AIOrb gained backward-compatible CONTROLLED `open`/`draft` props —
    the floating orb on every other page is unchanged.
  - **BubbleScale hover/tap tooltips** (per-bubble labels, spec styling, 400ms touch
    beat); end labels + values + `option_id` submission logic unchanged.
  - **Engine surfacing** (`score_assessment.py`, additive): result now carries
    `aptitude_scores` (0–100 per reasoning trait) + `career_categories`
    (career→primary_trait letter). api.py returns them verbatim under `results`
    (NO recomputation). Verified live (s12). `npm run build` → **486 modules, 0 errors**.
- **Phase 7B (university costs + programs + token refresh) — COMPLETE & verified.**
  - **University cost data:** new `scrapers/university_costs.py` (NIRF live scrape →
    curated published-fee table → Cohere fallback, all UPDATE-WHERE-NULL safe) populated
    `total_annual_cost_inr` for **514** universities (was 13). Breakdown: `ai_estimated`
    285 · `scraped` 178 · `manual` 51. Added `data_source VARCHAR(30)`. The engine's
    budget fallback now returns real universities (Phase 4 "Bug 3" cleared). NIRF returned
    HTTP 504 on this run (site-side outage) and was skipped gracefully; re-running the
    scraper extends coverage when it's back.
  - **Programs:** `migrations/005_programs_expansion.sql` took `programs` **8 → 82** (74
    generic templates) and `fields` **12 → 40**, covering every major domain. All **25**
    career profiles are mapped via `programs.career_id` (the FK — there is no
    `required_programs` column). Idempotent; re-run inserts 0.
  - **Token refresh:** `frontend/src/api/client.js` now silently refreshes the access
    token via `POST /auth/refresh` on a 401 and retries the original request, with a
    single-flight queue for concurrent 401s. Verified live (expired access + valid refresh
    → 200, no redirect; 3 concurrent → 1 refresh).
- **Phase 6 (frontend, 6A–6C) — COMPLETE & verified.** Public Landing + How-it-works, and
  the full authenticated funnel (auth → onboarding → assessment → results → roadmap →
  counselor → profile) are wired and verified end-to-end against the live backend. Every
  route points at a real page.
- **Phase 7A (career roadmap data) — COMPLETE & verified.** `career_profiles` was expanded
  with salary / education path / recruiters / growth outlook for **all 25 careers**;
  `/career-roadmap` returns them under a `career_details` map; `Roadmap.jsx` renders the
  salary range, a numbered education list, recruiter pills, and a colour-coded outlook
  badge. (Full detail + verification log: PROJECT_STATE → "Phase 7 — Session 7A".)

**Migrations 004 + 004b + 005 are already applied — do NOT re-run them** (005 is idempotent
anyway). The career-profile, programs, and university-cost data are all in the DB.

---

## What remains (optional / non-blocking — pick by impact)
None of these block the product; the funnel and engine work end-to-end today.

1. **University cutoffs** — ✅ **DONE (Session 15)**: 3 → **507 rows** (504 AI-estimated, 49
   universities) via `scrapers/university_cutoffs.py`; the `exams` table was seeded so the
   cutoffs are engine-consumable. Re-run with a higher `--limit` to extend past the top 50.
   `university_field_strength` (16 rows) + `university_exam_requirements` are still sparse,
   so the engine still relies on its budget+state fallback for the long tail.
2. **University cost long tail / `state` coverage** — 514 rows costed (top ~500); the rest
   are still NULL. Only 229/514 costed rows have `state`. Re-running
   `scrapers/university_costs.py` extends both (and pulls NIRF `city`/`state`/`rank` once
   nirfindia.org stops returning 504).
3. **Admin UI (optional)** — `/admin/students` (ranked shortlist) + `/admin/students/{id}`,
   gated by the `X-Admin-Key` header (matches `ADMIN_KEY` in `.env`). Build only if scoped.

> Before wiring any endpoint, **read `api.py` for the exact request/response field names**
> (and `score_assessment.py` for the results payload shape). Do NOT guess field names.

---

## ✅ Done so far (do not rebuild)
- **Stack / scaffold** — `frontend/` = Vite 6 + React 18 + Tailwind v4 + Framer Motion +
  GSAP + react-router-dom v6. Node lives at `/opt/homebrew/bin` (NOT on the default
  non-interactive shell PATH).
- **Design tokens** — `frontend/src/styles/tokens.css` (palette, RIASEC colours,
  bubble-scale colours, typography, motion/glow tokens, reduced-motion safety net).
- **API client** — `frontend/src/api/client.js`: axios instance, baseURL from
  `VITE_API_BASE_URL`, JWT pulled from localStorage and sent as `Bearer` on every request.
  **On a 401 it silently refreshes the access token via `POST /auth/refresh` and retries
  the original request** (single-flight queue for concurrent 401s; loop-guarded on the
  refresh call itself); only if the refresh fails does it clear tokens and redirect to
  **`/login`** (Phase 7B). Exports `setTokens` / `clearTokens` / `getAccessToken` /
  `getRefreshToken` + `TOKEN_KEY` (`starship_access_token`) /
  `REFRESH_KEY` (`starship_refresh_token`) / `API_BASE_URL`.
- **13 shared components** — `frontend/src/components/` (barrel `index.js`):
  `StarfieldCanvas`, `CategoryBadge` (+`RIASEC_COLORS`), `ProgressBar`, `StatCounter`,
  `BubbleScale` (+`REACTIONS`, `reactionFor`), `ReactionToast`, `CareerCard`,
  `ScholarshipCard`, `AIOrb`, `RIASECRadar`, `UniversityCard`, `ConstellationMap`,
  `SpotIllustration`. All reduced-motion aware. (`OrbitRing` was removed.)
- **Routing** — `App.jsx`: `createBrowserRouter` + `RouterProvider` (data API — required
  for `useBlocker`). `/` → Landing, `/how-it-works` → real page; auth routes public;
  the funnel (onboarding / assessment / **dashboard** / **careers** / results / roadmap /
  profile) under `<ProtectedRoute>` → `AppShell`; `*` → redirect to `/`.
- **Public pages** — `pages/Landing.jsx` (immersive rooftop pull-back) and
  `pages/HowItWorks.jsx` (5 steps), both verified.
- **Authenticated funnel** — `AuthContext` + `<ProtectedRoute>` + `AppShell`; CORS on the
  backend; auth pages (Login/Register/VerifyOtp/Forgot/Reset — Google OAuth UI skipped);
  Onboarding; Assessment (155 q, dual-mode BubbleScale-for-likert + 4-option picker for the
  50 mcq aptitude questions); **Dashboard** (Session 10 — completed-student home: top-3
  with Interest/Aptitude %, RIASEC radar, aptitude bars, prominent counselor card);
  **Careers** (Session 10 — full ranked list + search + RIASEC filter); Results (real
  0–100 `riasec_scores` radar, career buckets, real `scholarships`, universities, stats,
  constellation, floating counselor); **Roadmap (Phase 7A: real salary / education /
  recruiters / outlook)**; Profile.

---

## Backend API surface (all verified passing)
**Public:** `GET /`, `GET /questions`
**Assessment:** `POST /start-assessment`, `POST /submit-answer`*, `POST /submit-assessment`*,
`POST /career-roadmap`*, `POST /chat`*  (`*` = JWT-protected, `student_id` from token)
- `/career-roadmap` (no body) → `{ status, student_id, top_careers, recommendations,
  career_details }`. `career_details` is keyed by `career_name` for every scored career, each
  `{ salary_min_inr, salary_max_inr, education_path:{steps:[…]}, top_recruiters:[…],
  growth_outlook, country_salary:{IN,US,GB,CA,AU,SG,HK,AE,EU:{min_inr,max_inr,min_local,
  max_local,currency_symbol,currency_code,growth_outlook}} }` (Phase 7A + Session 13).
**Auth:** `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/verify-otp`,
`/auth/resend-otp`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/refresh`,
`/auth/google` (+ `/callback`)
**Account:** `GET`/`PATCH /profile`
**Admin:** `GET /admin/students`, `GET /admin/students/{id}` (X-Admin-Key)

Server: `python3 -m uvicorn api:app --host 127.0.0.1 --port 8000`

---

## Carry-forward gotchas (read before coding)
- **`auth.py` reads `JWT_SECRET` at import without loading `.env`.** The server gets the real
  secret because `api.py` imports `config` (which calls `load_dotenv()`) before `auth`. To
  mint a token out-of-band for testing, `import config` **before**
  `from auth import create_access_token`, or the token won't validate against the server.
- **`/career-roadmap` takes no body** (student-scoped via JWT); the chosen career is a
  frontend focus label. `career_details` already contains every scored career, so the
  focused one is always present — no refetch on focus change.
- **`/submit-answer` expects `selected_option_id`** (the real `option_id`), NOT a 1–5 value.
- **155 questions = 105 likert (5 opts, values 1–5) + 50 mcq aptitude (4 opts).** Assessment
  is dual-mode: `BubbleScale` for likert, a 4-option picker for mcq; both submit `option_id`.
- **`/submit-assessment` takes `session_id` as a QUERY param** (`?session_id=`), not a body.
  Its result payload carries `riasec_scores` (0–100, letter-keyed) + `scholarships`.
- **Never gate must-see content on Framer `whileInView`/mount reveals inside a GSAP-pinned
  section** — ScrollTrigger re-parents the node into a pin-spacer and orphans the Framer
  animation, leaving copy stuck invisible. Use GSAP `from()` off a **visible** resting state.
- **Headless preview = `document.hidden`** → Framer Motion **pauses** all animations, so
  `whileInView`/`useInView`/mount reveals read `opacity:0` in screenshots but animate fine
  for real users. Verify content via the DOM (snapshot/eval), not by trusting blank
  screenshots. (This is why the Roadmap headline looks faint in 7A's capture though the DOM
  confirms it.)
- **Reduced motion + mobile**: gate heavy motion via `gsap.matchMedia()` /
  `useReducedMotion()`; always ship a visible resting state.
- **Design rules** (CLAUDE.md): font-weight never heavier than **500**; **glow, not heavy
  drop shadows**; space is the backdrop, **students are the subject**; the app must read
  immediately as a **career tool**, not a space website. **No gradient text** anywhere.
  RIASEC + bubble colours are fixed in tokens — don't invent palette.
- **`current_class`** valid values: `'9' '10' '11' '12' 'Dropper'` (VARCHAR).
- **Session 10:** AuthContext OWNS `results` (set after submit, restored on mount for
  completed students); completed students land on **/dashboard** (not /results — still
  reachable via the quick link). The engine result now carries `aptitude_scores` (0–100
  per reasoning trait) + `career_categories` (career→primary_trait letter), both ADDITIVE
  and returned verbatim by api.py — read these for the Dashboard/Careers, don't recompute.
  `AIOrb` is controllable via optional `open`/`draft` props (pass nothing for the legacy
  uncontrolled floating-orb behaviour).

## Run / verify
- Dev server: launch config `starship-frontend` (`npm run dev`, Vite, port **5173**) —
  defined in `.claude/launch.json`. Use the preview tooling, not Bash, for the server.
- Build check each session: `cd frontend && PATH=/opt/homebrew/bin:$PATH npm run build`
  (currently 488 modules, zero errors).
- Backend must be running for funnel pages to work (uvicorn on :8000).

## Data gaps that affect the UI (design around these)
1. University **cost** — ✅ **mostly DONE (Phase 7B)**: 514 rows costed (top ~500). The
   long tail is still NULL, so some `UniversityCard`s show no cost, and only 229/514 have
   `state`. The engine's budget fallback now returns real universities.
2. University **cutoffs**: ✅ **DONE (Session 15)** — 3 → 507 rows (504 AI-estimated, 49
   universities); engine admissions guidance now has data. Long tail past the top 50
   universities is still uncovered (re-run `scrapers/university_cutoffs.py --limit N`).
3. Programs — ✅ **DONE (Phase 7B)**: 8 → 82, all 25 careers mapped, 40 fields.
4. `career_profiles` salary + education_path — ✅ **DONE (Phase 7A)**; populated for all 25
   and rendered in Roadmap.
