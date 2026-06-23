# Project STARSHIP — Frontend Polish Pass

Changelog for the open-ended frontend improvement pass (Session: 2026-06-23).

**How this file works.** Every distinct improvement is a numbered entry. Each entry
records: the file(s) affected, a one-sentence description, and the **exact original
code/value** being replaced (verbatim) so any change can be reverted in isolation.
Changes are made one at a time; `cd frontend && npm run build` is run after each.

Scene 1 of `Landing.jsx` (skyline layers, rooftop, particle student, constellations
and all their sizing/position/filter/mask values) is otherwise LOCKED. The single
authorised Scene-1 visual change in this pass is **Change 1** below, explicitly
requested by Aman (hazy + purple-tinged skyline glow, and a starry purple glow +
shadow that grounds the student on the rooftop rather than floating).

---

## Change 1 — Scene 1: hazy purple skyline glow + grounded student

**Files:** `frontend/src/pages/Landing.jsx`
**Description:** Add an atmospheric purple haze/glow over the skyline, recolour the
student's ground glow from cold white-blue to a starry purple, and deepen the
student's contact shadow — so the figure reads as seated in a pool of his own light
on the rooftop (per Aman's attached reference), not floating.

This is the one authorised Scene-1 change. It is implemented as three tightly
coupled edits (1a/1b/1c) within the same Scene-1 render block; they are
interdependent — the grounding effect depends on all three together. No locked
skyline `SkylineLayers` filter/mask/objectPosition value, and no student
size/position value, is touched. 1a is purely additive (a new overlay child of
`.js-city`, so it inherits the existing `.js-city` fade-in and the GSAP timeline is
NOT modified). 1b and 1c recolour/deepen two existing decorative elements.

### 1a — ADD skyline haze overlay (additive; new element)
Inserted as the last child of `.js-city`, immediately after `<SkylineLayers … />`
(around Landing.jsx:1398). No original code replaced — this is a new element.

### 1b — RECOLOUR the student ground glow (`.js-ground-glow`)
Original `background` value (verbatim):
```jsx
background: 'radial-gradient(ellipse at 50% 70%, rgba(225,232,250,0.22) 0%, rgba(180,195,225,0.08) 45%, transparent 75%)',
```

### 1c — DEEPEN the student contact shadow ellipse
Original `background` + `filter` values (verbatim):
```jsx
background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)',
filter: 'blur(5px)',
```

---

## Change 2 — Global keyboard focus ring (accessibility)

**Files:** `frontend/src/styles/tokens.css`
**Description:** Add a visible `:focus-visible` outline for keyboard/AT users across
the whole app. Several interactive elements set `outline: none` inline (e.g. the
Careers search box, the auth `Field` inputs, `AIOrb`, `DashboardCounselor`) and the
rest rely on the browser default outline, which is nearly invisible against the dark
void. `:focus-visible` only triggers for keyboard navigation (never mouse clicks), so
resting/mouse appearance — including Scene 1 at rest — is unchanged; the ring is
added with `!important` so it overrides the inline `outline:none` only while focused.

This is additive CSS appended at the end of `tokens.css`. No original code replaced.

---

## Change 3 — Associate form-field errors/hints with their input (accessibility)

**Files:** `frontend/src/pages/auth/AuthShell.jsx`
**Description:** In the shared `Field` component, wire `aria-invalid` and
`aria-describedby` from the `<input>` to its hint/error text, and give the error a
stable id + `role="alert"`. Previously a field's validation error was visually
adjacent but not programmatically linked, so a screen reader never announced it or
tied it to the input. This benefits every auth form plus the Profile form (all use
`Field`). Purely additive attributes — no visual change.

Original `<input>` open tag (verbatim):
```jsx
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoFocus={autoFocus}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
```

Original hint + error paragraphs (verbatim):
```jsx
      {hint && !error && (
        <p style={{ margin: '7px 2px 0', fontSize: 'var(--fs-caption)', color: 'var(--text-tertiary)' }}>{hint}</p>
      )}
      {error && (
        <p style={{ margin: '7px 2px 0', fontSize: 'var(--fs-caption)', color: 'var(--coral)' }}>{error}</p>
      )}
```

---

## Change 4 — Route-level code-splitting (performance)

**Files:** `frontend/src/App.jsx`, `frontend/src/components/RouteFallback.jsx` (new)
**Description:** Code-split every page except the landing entry so the initial
download no longer bundles the entire authenticated funnel + auth flows into one
768 kB chunk (the build's own warning). Result: the initial chunk drops from
**768 kB → 556 kB** (gzip **232 kB → 191 kB**), and each page is now its own chunk
fetched on first navigation (e.g. the 116 kB `Assessment` chunk no longer loads
upfront). `Landing` stays eager — it is the public entry point.

**Implementation note (verified):** this is done with the **data router's native
route-level `lazy` property**, not `React.lazy` + `<Suspense>`. An initial attempt
with `React.lazy` + two `<Suspense>` boundaries built fine but, at runtime inside a
`createBrowserRouter` data router, threw "A component suspended while responding to
synchronous input" on navigation (React Router's error boundary then recreated the
tree). Route-level `lazy` is the data-router-idiomatic split: the router awaits the
chunk during the navigation's loading phase, so nothing suspends mid-render, the
current page stays on screen during client-side nav (no flash, AppShell nav never
blanks), and `AppShell.jsx` needs no change at all. `RouterProvider`'s
`fallbackElement` shows the new lightweight `RouteFallback` (a single pulsing dot,
`role="status"`) only during an initial direct load of a lazy route. Verified in the
browser: `/login` and `/register` lazy chunks load via direct + client-side
navigation with **zero console errors**.

### 4a — App.jsx
Original import block (verbatim):
```jsx
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppShell from './layouts/AppShell.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import Landing from './pages/Landing.jsx';
import HowItWorks from './pages/HowItWorks.jsx';

// Auth (public)
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import VerifyOtp from './pages/auth/VerifyOtp.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import ResetPassword from './pages/auth/ResetPassword.jsx';

// Google OAuth callback landing
import GoogleAuthSuccess from './pages/GoogleAuthSuccess.jsx';

// Authenticated funnel (protected)
import Onboarding from './pages/Onboarding.jsx';
import Assessment from './pages/Assessment.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Careers from './pages/Careers.jsx';
import Results from './pages/Results.jsx';
import Roadmap from './pages/Roadmap.jsx';
import Profile from './pages/Profile.jsx';
```
In the route config, each affected route's `element: <Page />` was replaced with
`lazy: page(() => import('./pages/…'))` (where `page` is a small helper that maps a
default export to the data router's `{ Component }` shape), and `RouterProvider` got
`fallbackElement={<RouteFallback />}`. `RootLayout` and `AppShell.jsx` are unchanged
in the final implementation (the data-router `lazy` needs no Suspense boundary).

**To revert Change 4:** restore the eager `import` block above, change every
`lazy: page(() => import(...))` route back to `element: <Page />`, remove the
`fallbackElement` prop + the `page` helper, and delete
`frontend/src/components/RouteFallback.jsx`.

---

To revert any change, tell Claude Code: "revert change N" and provide this changelog file.
