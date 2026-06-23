/* FALLBACK — working inline-generated figure animation, preserved 2026-06-18.
   Re-import this into Landing.jsx Scene 2 if the real-asset version doesn't work. */

/* ---------------------------------------------------------------------------
 * Scene2FigureFallback — a self-contained copy of the Scene 2 student figure
 * exactly as it works today in Landing.jsx: a clean inline-generated side-profile
 * SVG (messy hair, defined nose, t-shirt + shorts, bare feet) driven by the
 * proven nested-joint GSAP rig.
 *
 * This file is NOT imported or rendered anywhere — it exists purely as a saved,
 * working reference to revert to if the real-asset rebuild fails.
 *
 * Rig (nested so nothing detaches — the bug the nesting prevents):
 *   #sc2fb-body  — whole upper body; folds forward about the hips (svgOrigin).
 *   #sc2fb-arm   — upper arm; rotates about the shoulder. CHILD of #sc2fb-body
 *                  so it travels with the fold (no shoulder gap).
 *   #sc2fb-fore  — forearm + hand; rotates about the elbow. CHILD of #sc2fb-arm,
 *                  so it can never drift from the upper arm's rotated endpoint.
 * Legs do not move. GSAP svgOrigin gives each joint an exact user-space pivot.
 *
 * Drive: self-contained. By default the component sets up its OWN GSAP
 * ScrollTrigger (pinned, scrubbed) on its own root element, replicating the
 * exact pattern + timeline values Scene 2 uses today. Pass a `triggerRef`
 * (ref to an outer trigger element, e.g. the Scene 2 <section>) to pin/scrub
 * against that instead — matching how Landing currently drives the figure.
 * Gated to desktop + no-reduced-motion via gsap.matchMedia(), like the original.
 * ------------------------------------------------------------------------- */

import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function FallbackFigureSVG() {
  const SKIN  = '#8a81d2';
  const SHIRT = '#695ec1';
  const SHORTS = '#2b2856';
  const HAIR  = '#221f49';
  const SHADE = 'rgba(34,31,73,0.28)'; // subtle shading

  return (
    <svg
      width="210" height="470" viewBox="0 0 200 470"
      fill="none" aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* ground shadow */}
      <ellipse cx="104" cy="462" rx="46" ry="8" fill="rgba(83,74,183,0.20)" />

      {/* ===== STATIC LOWER BODY (hips + near leg) — does not animate ===== */}
      <g id="sc2fb-legs">
        {/* far leg (behind, darker) for a touch of depth */}
        <path d="M118 250 L128 250 L126 360 L122 430 L112 430 L114 360 Z" fill={SHADE} />
        {/* near thigh + calf (skin) */}
        <path d="M96 248 L124 248 L122 300 L118 350 L120 422 L104 422 L106 350 L100 300 Z" fill={SKIN} />
        {/* knee shading */}
        <path d="M104 348 L120 348 L119 360 L105 360 Z" fill={SHADE} />
        {/* near foot — points left (barefoot) */}
        <path d="M106 418 L120 418 L120 440 C120 446 116 450 108 452 L80 456 C74 456 74 448 80 446 L102 438 L104 430 Z" fill={SKIN} />
      </g>

      {/* ===== UPPER BODY — folds forward about the hips (~100,250) ===== */}
      <g id="sc2fb-body">
        {/* shorts (over hips/upper thigh) */}
        <path d="M82 232 L142 232 L140 280 L120 280 L118 252 L106 252 L104 280 L84 280 Z" fill={SHORTS} />

        {/* t-shirt torso (profile, chest faces left) */}
        <path d="M104 120
                 C92 121 84 127 82 138
                 L76 168 C75 176 81 180 87 178 L92 172 L90 240
                 L140 240 L138 150
                 C138 134 130 122 116 120 Z" fill={SHIRT} />
        {/* collar + sleeve hem shading */}
        <path d="M104 120 C112 124 118 130 120 138 L116 140 C114 132 110 127 104 124 Z" fill={SHADE} />

        {/* neck (skin) */}
        <path d="M106 104 L124 104 L124 124 C118 130 110 130 106 124 Z" fill={SKIN} />

        {/* ===== HEAD (side profile, faces left) ===== */}
        <g id="sc2fb-head">
          {/* skull + face */}
          <circle cx="114" cy="74" r="31" fill={SKIN} />
          {/* nose juts left */}
          <path d="M84 70 L73 78 L85 86 Z" fill={SKIN} />
          {/* brow / lip hint */}
          <path d="M86 66 L94 67" stroke={SHADE} strokeWidth="2" strokeLinecap="round" />
          <path d="M86 90 L95 90" stroke={SHADE} strokeWidth="2" strokeLinecap="round" />
          {/* ear */}
          <ellipse cx="124" cy="78" rx="5" ry="7" fill={SHADE} />
          {/* messy hair over the top + back of the skull */}
          <path d="M90 66
                   C84 48 96 28 118 30
                   C134 31 146 42 147 58
                   C150 54 153 60 150 70
                   C153 68 154 76 150 84
                   L146 96
                   C146 80 143 70 137 64
                   C141 50 132 40 120 40
                   C108 40 99 46 96 60
                   C95 54 90 56 90 66 Z" fill={HAIR} />
        </g>

        {/* ===== NEAR ARM — shoulder pivot (~106,150). Forearm nested. ===== */}
        <g id="sc2fb-arm">
          {/* upper arm (skin), hangs from shoulder */}
          <path d="M96 146 L116 146 L114 208 L98 208 Z" fill={SKIN} />
          {/* sleeve cap over the shoulder */}
          <path d="M94 142 L118 142 L117 160 L95 160 Z" fill={SHIRT} />

          {/* forearm + hand — elbow pivot (~106,206) */}
          <g id="sc2fb-fore">
            <path d="M98 204 L114 204 L112 258 L100 258 Z" fill={SKIN} />
            {/* hand */}
            <path d="M99 254 L113 254 C118 254 119 262 116 268 L106 280 C100 284 96 278 99 272 Z" fill={SKIN} />
          </g>
        </g>
      </g>
    </svg>
  );
}

/**
 * @param {object} props
 * @param {React.RefObject<HTMLElement>} [props.triggerRef]  Outer element to pin/scrub
 *   against (e.g. the Scene 2 <section>). If omitted, the component pins its own root.
 */
export default function Scene2FigureFallback({ triggerRef } = {}) {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      // Desktop + no-reduced-motion only — same gating as Landing's Scene 2.
      mm.add('(min-width: 769px) and (prefers-reduced-motion: no-preference)', () => {
        const trigger = (triggerRef && triggerRef.current) || root;

        // EXACT same timeline values proven to work in Landing's tl2:
        // upper body folds forward about the hips; the near arm swings up and
        // the forearm folds so the hand covers the face. Each joint rotates
        // about an exact user-space pivot (svgOrigin), scrubbed on scroll.
        const tl = gsap.timeline({
          scrollTrigger: { trigger, start: 'top top', end: '+=95%', pin: true, scrub: 1 },
        });
        tl
          .to('#sc2fb-body', { rotation: -58, svgOrigin: '108 248', ease: 'power2.inOut', duration: 1 }, 0)
          .to('#sc2fb-arm',  { rotation: 132, svgOrigin: '106 150', ease: 'power2.inOut', duration: 1 }, 0)
          .to('#sc2fb-fore', { rotation: 54,  svgOrigin: '106 206', ease: 'power2.inOut', duration: 0.9 }, 0.08);
      });
    }, root);

    return () => ctx.revert();
  }, [triggerRef]);

  return (
    <div ref={rootRef} aria-hidden="true" style={{ display: 'block' }}>
      <FallbackFigureSVG />
    </div>
  );
}
