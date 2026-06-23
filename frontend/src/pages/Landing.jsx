import { useEffect, useLayoutEffect, useRef, useState, forwardRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  StarfieldCanvas,
  StatCounter,
  StardustStudent,
} from '../components';
import { useSoundManager } from '../components/SoundManager.jsx';
import client from '../api/client.js';

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return mobile;
}

gsap.registerPlugin(ScrollTrigger);

/* ===========================================================================
 * PROJECT STARSHIP — Public landing page (Phase 6B).
 *
 * The page is a camera. It opens *on the rooftop with the student* — pushed in
 * close on a lone figure gazing up — and as you scroll it pulls back to reveal
 * where they are: a rooftop above a sleeping city, under a sky full of possible
 * futures. From there the story is *shown*, scene by scene, never narrated.
 *
 *   1 Rooftop      — camera pull-back from the student to the whole night sky
 *   2 Pressure     — atmospheric crowd image; lone figure's back curves, arms rise
 *   3 Discovery    — photo atmosphere with parallax; the map metaphor
 *   4 Possibility  — real career outcomes; sky expands
 *   5 Hope         — they are not alone under this sky
 *
 * Motion strategy (deliberate split so two engines never fight one element):
 *   • GSAP ScrollTrigger owns every pinned / scroll-scrubbed beat (the camera
 *     pull-back, scene 2 back+arms, scene 3 parallax, scene 4 sky-expand) and
 *     the ambient loops.  Confined to desktop + no-reduced-motion via gsap.matchMedia().
 *   • Framer Motion handles in-view reveals in the un-pinned scenes (4 & 5).
 *
 * Robustness rule learned the hard way: anything inside a GSAP-pinned section
 * is animated *by GSAP from a safe, visible resting state* — never by a Framer
 * mount transition, which can get orphaned when ScrollTrigger re-parents the
 * node into a pin-spacer and leave critical copy stuck invisible.
 * ======================================================================== */

/* ---------------------------------------------------------------------------
 * Constellations used in Scene 2 (dim potential overhead).
 * Kept for Scene 2 only — Scene 1 now uses ConstellationLayer with real SVGs.
 * ------------------------------------------------------------------------- */
const CONSTELLATIONS = {
  microscope:  { pts: [[40, 14], [54, 28], [56, 48], [44, 60], [30, 82], [70, 82]], links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [1, 5]] },
  airplane:    { pts: [[50, 14], [50, 86], [22, 46], [78, 46], [42, 74], [58, 74]], links: [[0, 1], [2, 3], [4, 5]] },
  scales:      { pts: [[50, 18], [50, 80], [24, 30], [76, 30], [16, 52], [32, 52], [68, 52], [84, 52]], links: [[0, 1], [2, 3], [2, 4], [2, 5], [4, 5], [3, 6], [3, 7], [6, 7]] },
  paintbrush:  { pts: [[22, 82], [60, 44], [68, 36], [80, 24], [74, 32], [86, 30]], links: [[0, 1], [1, 2], [2, 3], [2, 4], [2, 5]] },
  stethoscope: { pts: [[30, 16], [70, 16], [40, 34], [60, 34], [50, 50], [50, 66]], links: [[0, 2], [2, 4], [1, 3], [3, 4], [4, 5]], ring: 5 },
};

// dim "potential" hanging over scene 2, kept high so it never crowds the copy
const DIM_SKY = [
  { key: 'airplane',   top: '10%', left: '15%', size: 96 },
  { key: 'paintbrush', top: '8%',  left: '82%', size: 86 },
  { key: 'scales',     top: '5%',  left: '50%', size: 74 },
];

function Constellation({ shape, size, opacity = 1 }) {
  const { pts, links, ring } = shape;
  const line = 'rgba(200,184,255,0.5)';
  const dot = 'rgba(222,214,255,0.92)';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true"
      style={{ display: 'block', overflow: 'visible', opacity }}>
      {links.map(([a, b], k) => (
        <line key={`l${k}`} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]}
          stroke={line} strokeWidth={0.9} strokeLinecap="round" />
      ))}
      {pts.map(([x, y], k) => (
        <circle key={`d${k}`} cx={x} cy={y}
          r={ring === k ? 4.4 : 1.7}
          fill={ring === k ? 'none' : dot}
          stroke={ring === k ? line : 'none'} strokeWidth={ring === k ? 1 : 0} />
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * Scene 1 — 4-layer skyline (all PNG, transparent skies).
 *
 * ROOT CAUSE FIX (this session): the far/mid/near layers referenced `.jpg` but
 * every file on disk is `.png`. The images 404'd, so the only thing that rendered
 * in the lower scene was the old dark rooftop overlay block — hence the "solid
 * colour block + tiny rooftop" in the screenshot. All four srcs are now `.png`.
 *
 * Container: height 38vh / maxHeight 340px — most of the skyline must be visible.
 * overflow:visible so the rooftop PNG (water tank) is never clipped.
 *
 * Depth is conveyed by brightness (opacity stays 1 on every layer), never by
 * transparency. far = darkest, near = brightest, rooftop = brightest of all.
 * far/mid/near are full width and may be cropped vertically from the TOP
 * (height:130% inside an overflow:hidden wrapper + objectPosition:bottom). The
 * rooftop layer keeps natural height in the overflow:visible parent so its
 * water tank is never clipped.
 *
 * Refs passed in from Landing for scroll parallax + cursor parallax.
 * ------------------------------------------------------------------------- */
// SECTION A — each far/mid/near layer carries a per-layer mask gradient that
// DISSOLVES the top of the PNG into transparency, so the buildings melt into the
// page gradient above with NO hard line. Masks (not overflow clipping) do the
// blending; WebkitMaskImage is set identically (Safari + Chrome).
//
// objectPosition on far/mid/near is '50% 30%' (SESSION 40 — see the detailed note
// in SkylineLayers). Alpha analysis of the PNGs: transparent SKY is the TOP ~40-50%
// of each frame, solid BUILDINGS the BOTTOM 50-60%, and the jagged roofline sits at
// source y = 21%/29.5%/38.9% (near/mid/far). Because objectFit:'cover' renders the
// PNG ~2x taller than the short 52vh container, 'bottom center' (50% 100%) cropped
// the ENTIRE roofline off the top and left only a solid building block whose masked
// top edge read as a hard line — the actual top-cut. 'top center' (0%) is the
// opposite over-correction that emptied near/mid (Session 34). '50% 30%' shifts the
// visible window up just enough that each layer's sky + roofline land in the masked
// fade zone (so the mask dissolves a real silhouette) while building mass still
// fills the lower half. The two mechanisms stay orthogonal: objectPosition frames
// which source band shows; maskImage is the soft alpha blend over that band.
// Rooftop KEEPS objectPosition:'bottom center' (its opaque surface is in the bottom
// ~40% of its PNG, it is the foreground the student sits on, and it carries no mask).
// SECTION C — the blue colour grade is now BAKED INTO each layer's own filter
// (hue-rotate + a touch of sepia, combined with the existing brightness/saturate
// depth values) instead of a separate mixBlendMode overlay div. The old overlay
// rendered as a visibly flat tint rectangle in a real browser; baking the grade
// into the image filters tints the pixels themselves, so the result is a subtle
// per-layer grade that preserves each layer's luminance/depth. hue-rotate(8deg)
// leans the whole skyline cool/blue; sepia(0.04–0.06) gives the hue something to
// rotate (a faint warm base) so the shift reads without washing the image out.
//
// SECTION D — masks made MORE GRADUAL (the transparent→black range pushed lower:
// far black 60→72%, mid 50→62%, near 40→52%) so the top edge dissolves over a
// longer distance and can never read as a hard horizontal cut in a real browser.
// maskImage and WebkitMaskImage are set to the SAME value on all three layers.
const SKYLINE_LAYERS = [
  { key: 'far',     src: '/assets/skyline/layer-far.png',     zIndex: 1, filter: 'brightness(0.42) saturate(0.6) hue-rotate(8deg) sepia(0.06)',  mask: 'linear-gradient(to bottom, transparent 0%, transparent 28%, black 72%)' },
  { key: 'mid',     src: '/assets/skyline/layer-mid.png',     zIndex: 2, filter: 'brightness(0.58) saturate(0.72) hue-rotate(8deg) sepia(0.05)', mask: 'linear-gradient(to bottom, transparent 0%, transparent 18%, black 62%)' },
  { key: 'near',    src: '/assets/skyline/layer-near.png',    zIndex: 3, filter: 'brightness(0.72) saturate(0.85) hue-rotate(8deg) sepia(0.04)', mask: 'linear-gradient(to bottom, transparent 0%, transparent 10%, black 52%)' },
  { key: 'rooftop', src: '/assets/skyline/layer-rooftop.png', zIndex: 4, filter: 'brightness(0.8) hue-rotate(8deg) sepia(0.04)' },
];

function SkylineLayers({ farRef, midRef, nearRef, rooftopRef }) {
  const refs = { far: farRef, mid: midRef, near: nearRef };
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {SKYLINE_LAYERS.map(({ key, src, zIndex, filter, mask }) => {
        if (key === 'rooftop') {
          // FIX 2 (rooftop GEOMETRY REWORK — chosen over the literal 'top center'
          // instruction, which the alpha data proved would BREAK the rooftop).
          //
          // Measured shape of layer-rooftop.png (1536×1024, Pillow alpha + width
          // analysis): the source's TOP 0–25% is fully TRANSPARENT empty sky
          // (alpha≈0); the WATER TANK on its stand is a NARROW element on the LEFT
          // (≈left 8–22% of width) spanning source y≈25–60%; the FULL-WIDTH flat
          // tiled roof surface + parapet is the SOLID bottom (source y≈60–100%,
          // alpha 180–255); the very bottom row is opaque (NO transparent padding).
          //
          // Why 'top center' was rejected: at 16vh + objectFit:cover only a ~15%-tall
          // band of the source shows, and 'top center' would anchor the empty
          // transparent 0–25% and crop the solid roof off the bottom → an invisible
          // rooftop (the documented Session-37 regression). And because the tank's
          // top is at ~25% of the source while the flat roof is at 60–100%, NO short
          // cover-window can contain BOTH (they are ~45% of the height apart). The
          // ONLY way to show the water tank AND keep full viewport width is to render
          // the image at its NATURAL aspect (height:auto): the whole rooftop — tank,
          // parapet, flat surface — renders full-width, the flat roof sits flush at
          // the very bottom, and the transparent top simply overlaps the sky/skyline
          // (transparent pixels occlude nothing, so the city still shows through).
          //
          // TRADE-OFF (flagged for review): natural aspect makes the flat full-width
          // roof band ≈30% of (100vw/1.5) tall — i.e. taller than the old fixed 16vh
          // strip. The brief asked to keep the flat roof the same height; the asset's
          // proportions make "full width + visible tank + thin flat roof" geometrically
          // impossible, so per the chosen rework this is the accepted cost. Values are
          // easy to tune (e.g. cap with a maxWidth to shrink the whole rooftop).
          //
          // FIX 3 (bottom seam): bottom:-14px. The PNG is opaque to its last row (no
          // transparent padding), so the reported gap was a sub-pixel/rounding seam at
          // the viewport edge — a tiny negative bottom guarantees the opaque roof edge
          // sits flush past the bottom with no hairline. It also gives the rooftop's
          // small scroll parallax (now a bounded ±12px, see tl1) headroom so the lift
          // can never re-open a gap at the bottom of the pull-back.
          return (
            <img
              key={key}
              ref={rooftopRef}
              src={src}
              alt="" aria-hidden="true"
              style={{
                position: 'absolute', bottom: '-14px', left: 0,
                width: '100%', height: 'auto',
                display: 'none', opacity: 1, zIndex, filter,
                border: 'none', boxShadow: 'none',
              }}
              onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          );
        }
        // SECTION A — far/mid/near: fill the .js-city container exactly.
        // height:'100%' constrains each layer to the container height (52vh desktop
        // / 40vh mobile). objectPosition:'50% 30%' frames the source so the sky +
        // jagged roofline land in the masked top zone (see the detailed Session-40
        // note in the style block below); the mask gradient then dissolves that real
        // silhouette into the page sky rather than cutting a solid building block.
        return (
          <img
            key={key}
            ref={refs[key]}
            src={src}
            alt="" aria-hidden="true"
            style={{
              position: 'absolute', bottom: 0, left: 0,
              width: '100%', height: '100%',
              // SESSION 40 — THE TOP-CUT ROOT CAUSE + FIX (objectPosition 50% 30%).
              // The visible "hard top line" was NOT parent clipping, NOT a background
              // seam, and could not be fixed by widening the mask (proven: Aman
              // confirmed two mask-widenings did nothing). The real cause:
              //   objectFit:'cover' makes a 1536×1024 PNG render ~960px tall at 1440px
              //   wide, but `.js-city` is only 52vh (~468px). With objectPosition
              //   'bottom center' (50% 100%) the BOTTOM ~49% of the source fills the
              //   layer and the TOP ~51% is cropped off. Pillow alpha data shows each
              //   PNG's jagged roofline (the natural soft silhouette) lives at source
              //   y = 21% (near) / 29.5% (mid) / 38.9% (far) — ALL inside that cropped
              //   top half. So the rooflines were invisible and the visible top edge
              //   was SOLID building mass (>=98% opaque). The per-image mask was
              //   feathering a hard-topped solid block with no silhouette → it always
              //   read as a horizontal line no matter how wide the mask got (there was
              //   no transparent sky / roofline in the masked window for it to dissolve).
              // FIX: shift the visible window UP to '50% 30%' so each layer's
              // transparent sky + jagged roofline land inside the masked fade zone.
              // Now the mask dissolves real sky→silhouette→buildings (a natural skyline
              // emerging from the page), instead of cutting a solid block. Buildings
              // still fill the lower ~half of every layer, so this is NOT Session 34's
              // 'top center' (0%) regression that emptied near/mid — 30% keeps the
              // building mass dominant while exposing the roofline. Width-driven cover
              // (desktop + wide-mobile) benefits; narrow-mobile cover is height-driven
              // so the full source height already shows there and 30% is a no-op.
              objectFit: 'cover', objectPosition: '50% 30%',
              opacity: 1, zIndex, filter,
              maskImage: mask, WebkitMaskImage: mask,
              border: 'none', boxShadow: 'none',
            }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Scene 1 — ConstellationLayer.
 * Loads 5 SVG files inline via fetch so GSAP can reach star-node circles and
 * connect-line elements. Proximity detection drives draw-in / draw-out.
 *
 * Proximity fix (Session 25): per-constellation isActive boolean array replaces
 * the single activeIndex integer. gsap.killTweensOf(lines) is called BEFORE
 * starting the exit tween — this prevents an in-progress enter tween from
 * overriding the exit, which was the root cause of the stuck-lit bug.
 * visibilitychange forces all active constellations to exit so they don't
 * persist in the lit state when the user returns to the tab.
 *
 * Positions updated to avoid the hero text zone (top ~55% centre).
 * scale(0.65) on desktop, scale(0.45) on mobile, 5th hidden on mobile.
 * ------------------------------------------------------------------------- */
// SECTION E (positioning) — FIX 4: organic/scattered placement that NEVER overlaps
// (a) the TopBar (logo top-left ~top 0-8% / left 0-14%; Begin button top-right
// ~top 0-8% / right 0-14%) — one constellation previously sat right under the Begin
// button; (b) the hero text zone (headline/subcopy/buttons, ~top 10-55% / left
// 25-75%); or (c) the skyline/rooftop area (bottom ~40%, i.e. top > 60%). Each item
// is anchored either in a side margin (left/right < ~15%) BELOW the TopBar corners,
// or in the top-centre strip BETWEEN the two TopBar corners and ABOVE the hero text.
// Values are deliberately non-uniform (varied tops/sides, no repeating round
// numbers) so the scatter reads as natural rather than a grid. Desktop and mobile
// positions are tuned independently — mobile's hero block is ~92% wide, so on mobile
// every constellation lives in the top strip (top 2-9%, ABOVE the hero) clear of the
// mobile logo/Begin corners. Rendered box ≈ 130px × scale (0.65 desktop / 0.45 mobile).
const CONST_ITEMS = [
  // left margin, below the logo, beside the hero — clear of all zones
  { file: 'constellation-microscope.svg',  top: '15%', left: '5%',   mobileTop: '8%', mobileLeft: '4%' },
  // right margin, dropped DOWN to 12% so it clears the Begin button (was the one
  // rendering behind it) — top-right Begin zone is ~top 0-8% / right 0-14%
  { file: 'constellation-airplane.svg',    top: '12%', right: '6%',  mobileTop: '8%', mobileRight: '4%' },
  // top-centre strip, left of the hero's horizontal band (ends ~left 25%) and right
  // of the logo corner (ends ~left 14%)
  { file: 'constellation-scales.svg',      top: '3%',  left: '18%',  mobileTop: '2%', mobileLeft: '30%' },
  // top-centre strip, right of the hero's horizontal band (ends ~right 25%) and left
  // of the Begin corner (ends ~right 14%)
  { file: 'constellation-camera.svg',      top: '7%',  right: '17%', mobileTop: '2%', mobileRight: '30%' },
  // right margin, lower — moved to the RIGHT because FIX 2's rooftop rework now
  // raises the water-tank column on the LEFT (≈left 8–22%) up to ~80vh; the right
  // margin is clear of both the tank and the flat roof band. Above the skyline,
  // clear of the hero (left 25–75%). Hidden on mobile.
  { file: 'constellation-stethoscope.svg', top: '40%', right: '5%',  mobileHidden: true },
];

const ConstellationLayer = forwardRef(function ConstellationLayer({ onChime, isMobile }, forwardedRef) {
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cancelled = false;
    const cleanupFns = [];
    const constData = [];

    Promise.all(
      CONST_ITEMS.map((item) =>
        fetch(`/assets/constellations/${item.file}`)
          .then((r) => (r.ok ? r.text() : ''))
          .catch(() => '')
      )
    ).then((svgTexts) => {
      if (cancelled || !wrapperRef.current) return;

      const containers = Array.from(wrapperRef.current.querySelectorAll('.js-const-item'));

      // Step 1: inject all SVG innerHTML before any measurement
      containers.forEach((container, i) => {
        const holder = container.querySelector('.js-svg-holder');
        if (!holder || !svgTexts[i]) return;
        holder.innerHTML = svgTexts[i];
        const svg = holder.querySelector('svg');
        if (!svg) return;
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.display = 'block';
        svg.style.overflow = 'visible';

        // SECTION E (exit bug): tag EVERY connector element with .connect-line —
        // straight <line>s AND circular connectors (<circle>/<path>/<polyline>) —
        // so the enter, exit, and kill steps all select the same class-based set
        // regardless of the underlying SVG tag. The previous code selected
        // connectors by tag name (line/path), so circular connectors were never
        // included in the exit animation and stayed stuck-lit on mouse-out.
        svg
          .querySelectorAll(
            '.constellation-lines line, .constellation-lines path, .constellation-lines circle, .constellation-lines polyline'
          )
          .forEach((el) => el.classList.add('connect-line'));
      });

      if (reduced) {
        containers.forEach((container) => {
          container.querySelectorAll('.constellation-stars circle').forEach((c) => { c.style.opacity = '0.5'; });
          const lg = container.querySelector('.constellation-lines');
          if (lg) lg.style.opacity = '0';
        });
        return;
      }

      // Step 2: wait for layout before calling getTotalLength so the SVG
      // elements have computable geometry (they are not in the layout tree
      // until the next paint after innerHTML injection)
      requestAnimationFrame(() => {
        if (cancelled || !wrapperRef.current) return;

        containers.forEach((container, i) => {
          const circles = Array.from(container.querySelectorAll('.constellation-stars circle'));
          const lineGroup = container.querySelector('.constellation-lines');
          // SECTION E: connectors selected by the .connect-line CLASS (tagged at
          // injection) so circular and straight connectors are treated uniformly.
          const lines = Array.from(container.querySelectorAll('.connect-line'));

          // measure and store lengths once — exit reuses these to avoid stale values
          const lens = lines.map((el) => {
            if (typeof el.getTotalLength === 'function') {
              try {
                const l = el.getTotalLength();
                return l > 0 ? l : 100;
              } catch (_) { return 100; }
            }
            return Math.hypot(
              parseFloat(el.getAttribute('x2') || 0) - parseFloat(el.getAttribute('x1') || 0),
              parseFloat(el.getAttribute('y2') || 0) - parseFloat(el.getAttribute('y1') || 0)
            ) || 100;
          });

          // idle state: lines hidden via dashoffset (opacity stays 1); circles dim
          lines.forEach((el, j) => {
            el.style.strokeDasharray = lens[j];
            el.style.strokeDashoffset = lens[j];
            el.style.opacity = '1';
          });
          circles.forEach((c) => {
            c.style.opacity = '0.35';
            c.style.filter = 'none';
          });
          // lineGroup always visible — dashoffset controls draw, not opacity
          if (lineGroup) lineGroup.style.opacity = '1';

          constData[i] = { circles, lineGroup, lines, lens };
        });

        // Per-constellation active state — independent booleans, not a single activeIndex.
        // This lets multiple constellations be active simultaneously and avoids the
        // stuck-lit bug where a single shared index could desync from reality.
        const isActive = new Array(CONST_ITEMS.length).fill(false);

        // Force-exit all lit constellations (used on visibilitychange: hidden)
        const forceExitAll = () => {
          constData.forEach((data, i) => {
            if (!data || !isActive[i]) return;
            isActive[i] = false;
            const targets = [...data.lines, ...data.circles].filter(Boolean);
            if (targets.length) gsap.killTweensOf(targets);
            if (data.lines.length) {
              gsap.to(data.lines, { strokeDashoffset: (idx) => data.lens[idx], duration: 0.15, ease: 'power2.in' });
            }
            gsap.to(data.circles, { opacity: 0.35, filter: 'none', duration: 0.1 });
          });
        };

        const handleVisibility = () => {
          if (document.hidden) forceExitAll();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        cleanupFns.push(() => document.removeEventListener('visibilitychange', handleVisibility));

        // proximity detection — one shared mousemove listener;
        // getBoundingClientRect() on every move so scroll never desyncs the centre.
        // Only added on desktop — touch/mobile has no cursor.
        const onMove = (e) => {
          if (!wrapperRef.current) return;
          const items = Array.from(wrapperRef.current.querySelectorAll('.js-const-item'));

          items.forEach((container, i) => {
            const data = constData[i];
            if (!data) return;

            const rect = container.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dist = Math.hypot(e.clientX - cx, e.clientY - cy);

            // Enter
            if (dist < 130 && !isActive[i]) {
              isActive[i] = true;
              // kill any in-progress tween before starting enter
              gsap.killTweensOf(data.lines);
              gsap.to(data.lines, {
                strokeDashoffset: 0,
                duration: 0.4,
                stagger: 0.07,
                ease: 'power2.out',
                overwrite: 'auto',
              });
              gsap.to(data.circles, {
                opacity: 1,
                filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.95))',
                duration: 0.2,
                overwrite: 'auto',
              });
              if (onChime) onChime();
            }

            // Exit — CRITICAL: kill tweens first so enter can't override exit
            else if (dist >= 160 && isActive[i]) {
              isActive[i] = false;
              gsap.killTweensOf(data.lines);
              gsap.to(data.lines, {
                strokeDashoffset: (idx) => data.lens[idx],
                duration: 0.25,
                ease: 'power2.in',
                overwrite: 'auto',
              });
              gsap.to(data.circles, {
                opacity: 0.35,
                filter: 'none',
                duration: 0.2,
                overwrite: 'auto',
              });
            }
          });
        };

        if (!isMobile) {
          window.addEventListener('mousemove', onMove);
          cleanupFns.push(() => window.removeEventListener('mousemove', onMove));
        }

        // kill all running tweens on unmount to prevent stale callbacks
        cleanupFns.push(() => {
          constData.forEach((data) => {
            if (!data) return;
            const targets = [...data.lines, ...data.circles].filter(Boolean);
            if (targets.length) gsap.killTweensOf(targets);
          });
        });
      });
    });

    return () => {
      cancelled = true;
      cleanupFns.forEach((fn) => fn());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={(node) => {
        wrapperRef.current = node;
        if (forwardedRef) forwardedRef.current = node;
      }}
      className="js-sky-layer js-constellation-layer"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}
    >
      <div className="js-depth" style={{ position: 'absolute', inset: 0 }}>
        {CONST_ITEMS.map((item) => {
          // resolve position — supports both left and right anchors
          const posStyle = item.right
            ? { right: isMobile ? (item.mobileRight || item.right) : item.right }
            : { left: isMobile ? (item.mobileLeft || item.left) : item.left };
          const topVal = isMobile ? (item.mobileTop || item.top) : item.top;
          const scale = isMobile ? 0.45 : 0.65;
          const transformOrigin = item.right || (isMobile && item.mobileRight) ? 'top right' : 'top left';

          return (
            <div
              key={item.file}
              className="js-const-item js-constellation"
              style={{
                position: 'absolute',
                top: topVal,
                ...posStyle,
                width: 130,
                transform: `scale(${scale})`,
                transformOrigin,
                display: isMobile && item.mobileHidden ? 'none' : 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                pointerEvents: 'auto',
                cursor: 'default',
              }}
            >
              {/* SECTION E: labels removed entirely — constellations are purely
                  visual, no text ever names them. */}
              <div className="js-svg-holder" style={{ width: '100%' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ---------------------------------------------------------------------------
 * CrowdBackground — pure CSS/SVG atmospheric crowd for Scene 2.
 * No photograph. Two rows of simplified identical silhouette shapes —
 * a circle head + rounded-rect body — in very faint teal, arranged in a
 * grid pattern filling the background. z-index 0.
 * ------------------------------------------------------------------------- */
function CrowdBackground() {
  const color1 = 'rgba(29, 158, 117, 0.12)'; // front row
  const color2 = 'rgba(29, 158, 117, 0.07)'; // back row

  // 15 figures in row 1, 12 in row 2 (offset for grid feel)
  const row1X = Array.from({ length: 15 }, (_, i) => 40 + i * 80);
  const row2X = Array.from({ length: 12 }, (_, i) => 80 + i * 92);
  const row1Y = 720; // foot y in viewBox
  const row2Y = 820;

  const Figure = ({ x, y, color }) => (
    <g>
      <circle cx={x} cy={y - 50} r={8} fill={color} />
      <rect x={x - 9} y={y - 40} width={18} height={40} rx={4} fill={color} />
    </g>
  );

  return (
    <svg
      className="js-crowd"
      viewBox="0 0 1200 900"
      preserveAspectRatio="xMidYMax slice"
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      {/* back row — lower opacity, drawn first so front row is on top */}
      {row2X.map((x, i) => <Figure key={`r2-${i}`} x={x} y={row2Y} color={color2} />)}
      {/* front row */}
      {row1X.map((x, i) => <Figure key={`r1-${i}`} x={x} y={row1Y} color={color1} />)}
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * SECTION 4 — Scene 2 student (clean side-profile rebuild).
 *
 * The real traced part files in /assets/figures/animated were each traced in
 * inconsistent poses/scales (e.g. the left forearm is horizontal, the right
 * vertical) and a front-view torso under a profile head — so they could not be
 * assembled into one riggable figure (verified: the arm splayed up like a cheer
 * instead of folding to the face, and the leg gapped at the knee). This is a
 * clean inline-SVG rebuild that keeps the reference's details — messy hair, a
 * defined nose, the side-profile shape, t-shirt + shorts, bare feet — and rigs
 * correctly so nothing detaches.
 *
 * The figure faces LEFT. It animates from upright → folded forward with the
 * hand covering the face (matching student-design-sheet.jpg). Rig:
 *   #sc2-body  — whole upper body; folds forward about the hips (svgOrigin).
 *   #sc2-arm   — upper arm; rotates about the shoulder. Child of #sc2-body so it
 *                travels with the fold (no shoulder gap).
 *   #sc2-fore  — forearm + hand; rotates about the elbow. Child of #sc2-arm, so
 *                it can never drift from the upper arm's rotated endpoint.
 * Legs do not move. GSAP svgOrigin gives each joint an exact user-space pivot.
 * ------------------------------------------------------------------------- */
function StudentFigureSVG() {
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
      <g id="sc2-legs">
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
      <g id="sc2-body">
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
        <g id="sc2-head">
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
        <g id="sc2-arm">
          {/* upper arm (skin), hangs from shoulder */}
          <path d="M96 146 L116 146 L114 208 L98 208 Z" fill={SKIN} />
          {/* sleeve cap over the shoulder */}
          <path d="M94 142 L118 142 L117 160 L95 160 Z" fill={SHIRT} />

          {/* forearm + hand — elbow pivot (~106,206) */}
          <g id="sc2-fore">
            <path d="M98 204 L114 204 L112 258 L100 258 Z" fill={SKIN} />
            {/* hand */}
            <path d="M99 254 L113 254 C118 254 119 262 116 268 L106 280 C100 284 96 278 99 272 Z" fill={SKIN} />
          </g>
        </g>
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * SECTION 4 (ATTEMPT 3) — Scene 2 student, hand-traced from student-design-sheet.jpg.
 *
 * Genuinely different technique from the two prior attempts: rather than
 * generating generic primitives (Attempt 1 = StudentFigureSVG above) or
 * compositing the separate exported part files (Attempt 2 = rejected, scale
 * mismatch), this is ONE coherent SVG whose path geometry is hand-authored as
 * cubic beziers directly against the reference art — a side-profile student with
 * a defined facial profile (forehead → nose bump → chin), messy tufted hair,
 * a slightly loose short-sleeve tee, FULL-LENGTH navy trousers (the reference
 * wears trousers, not the shorts the inline figure used), and bare feet.
 *
 * Crucially it shares the EXACT coordinate system (viewBox 0 0 200 470) and the
 * EXACT joint pivots of the proven rig, so the existing tl2 timeline drives it
 * with zero changes:
 *   #sc2-legs  — trousers + both bare feet, static (lower body).
 *   #sc2-body  — torso + tee + head, folds forward about the hips (svgOrigin 108 248).
 *     #sc2-head — head/hair/profile, nested so it travels with the fold.
 *     #sc2-arm  — upper arm + sleeve, rotates about the shoulder (106 150).
 *       #sc2-fore — forearm + hand, rotates about the elbow (106 206).
 * Nested SVG groups inherit parent transforms automatically, so no joint can
 * visually disconnect regardless of scrub position.
 * ------------------------------------------------------------------------- */
function StudentFigureTraced() {
  const SKIN       = '#8378b6'; // muted lavender-purple (face, arms, feet)
  const SKIN_SHADE = '#6f64a0'; // shaded skin (far foot, undersides)
  const SHIRT      = '#6a60a4'; // violet tee — on-brand, matches the reference
  const SHIRT_DK   = '#5a5092'; // tee shadow (collar, sleeve hem, side)
  const PANTS      = '#262350'; // dark navy trousers
  const PANTS_DK   = '#1d1b40'; // far trouser leg
  const HAIR       = '#211e44'; // dark indigo, near-black

  return (
    <svg
      width="210" height="470" viewBox="0 0 200 470"
      fill="none" aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* ground shadow */}
      <ellipse cx="104" cy="462" rx="48" ry="8" fill="rgba(83,74,183,0.20)" />

      {/* ===== STATIC LOWER BODY — trousers + bare feet (does not animate) ===== */}
      <g id="sc2-legs">
        {/* far foot (behind, shaded) */}
        <path d="M120 424 C120 432 118 436 112 439 L94 444 C89 446 89 451 95 451
                 L120 450 C130 449 136 444 136 436 L136 424 Z" fill={SKIN_SHADE} />
        {/* far trouser leg (behind, darker) */}
        <path d="M112 250 C114 320 117 390 120 426 L138 426
                 C139 388 139 318 138 250 Z" fill={PANTS_DK} />
        {/* near bare foot — heel back, toes point left */}
        <path d="M98 420 C98 429 95 433 89 437 L70 443 C64 445 65 451 71 451
                 L99 450 C111 449 119 444 119 435 L119 420 Z" fill={SKIN} />
        {/* near trouser leg (front) */}
        <path d="M88 246
                 C88 300 92 364 96 426 L116 426
                 C119 360 121 300 122 250
                 C123 244 121 240 116 240 L94 240
                 C90 240 88 242 88 246 Z" fill={PANTS} />
        {/* crease line down the near leg for form */}
        <path d="M104 262 C105 320 105 376 106 420" stroke={PANTS_DK} strokeWidth="2"
              strokeLinecap="round" opacity="0.5" />
      </g>

      {/* ===== UPPER BODY — folds forward about the hips (svgOrigin 108 248) ===== */}
      <g id="sc2-body">
        {/* waistband of the trousers (travels a touch with the fold, hides the seam) */}
        <path d="M84 232 L140 232 L139 252 C120 256 104 256 85 252 Z" fill={PANTS} />

        {/* t-shirt torso — profile, chest faces left, slightly loose */}
        <path d="M104 116
                 C88 118 80 128 79 144
                 C77 176 80 212 86 244
                 L138 244
                 C142 210 142 166 139 144
                 C138 128 130 119 116 117 Z" fill={SHIRT} />
        {/* tee side/back shadow for volume */}
        <path d="M132 130 C138 150 139 200 136 244 L138 244
                 C142 210 142 166 139 144 C137 137 135 133 132 130 Z" fill={SHIRT_DK} />
        {/* collar shading at the neckline */}
        <path d="M104 117 C110 119 115 124 117 130 L112 132
                 C110 126 107 122 103 120 Z" fill={SHIRT_DK} />

        {/* neck (skin) */}
        <path d="M104 100 L122 100 L122 119 C116 125 110 125 104 119 Z" fill={SKIN} />

        {/* ===== HEAD — side profile, faces left, nested so it folds with the body ===== */}
        <g id="sc2-head">
          {/* face silhouette: forehead → nose bump → lips → chin → jaw → back of skull */}
          <path d="M112 46
                   C97 46 85 57 83 74
                   C82 80 80 83 76 86
                   C80 89 83 90 86 91
                   C84 95 86 101 92 104
                   C97 108 105 109 113 107
                   C131 104 143 90 143 72
                   C143 56 130 46 112 46 Z" fill={SKIN} />
          {/* ear */}
          <ellipse cx="125" cy="80" rx="4" ry="6" fill={SKIN_SHADE} opacity="0.7" />
          {/* brow + mouth hints */}
          <path d="M85 70 L93 71" stroke={SKIN_SHADE} strokeWidth="2" strokeLinecap="round" />
          <path d="M87 96 L95 95" stroke={SKIN_SHADE} strokeWidth="2" strokeLinecap="round" />
          {/* messy hair — crown + back, with a few tufts/spikes */}
          <path d="M84 70
                   C79 49 92 30 114 31
                   C133 32 147 45 146 67
                   C150 61 153 51 150 45
                   C151 53 153 60 150 68
                   C154 65 155 74 150 82
                   L145 92
                   C147 75 145 64 139 57
                   C143 45 133 39 119 40
                   C132 37 124 33 116 35
                   C106 35 97 43 94 60
                   C92 51 86 57 84 70 Z" fill={HAIR} />
        </g>

        {/* ===== NEAR ARM — hangs at the FRONT of the body. Shoulder pivot (90 150).
                 Forearm nested (elbow pivot 92 206). ===== */}
        <g id="sc2-arm">
          {/* short sleeve cap over the shoulder */}
          <path d="M78 145 C78 135 84 130 91 130 C99 130 104 137 104 148
                   C104 160 101 167 96 168 L83 168 C80 161 78 153 78 145 Z" fill={SHIRT} />
          {/* sleeve hem shadow */}
          <path d="M84 166 L99 166 L98 170 L85 170 Z" fill={SHIRT_DK} />
          {/* upper arm (skin), hangs from the shoulder */}
          <path d="M81 150 C80 168 80 188 82 206 L99 206
                   C101 188 101 168 100 150 Z" fill={SKIN} />

          {/* forearm + hand — elbow pivot (92 206) */}
          <g id="sc2-fore">
            <path d="M83 206 C82 222 82 240 84 256 L100 256
                     C102 240 102 222 101 206 Z" fill={SKIN} />
            {/* hand (loose fist) */}
            <path d="M84 252 L100 252 C105 253 107 261 104 269
                     C100 278 91 279 86 273 C82 267 81 257 84 252 Z" fill={SKIN} />
          </g>
        </g>
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * Scene 4 — static outcome cards (decorative, not interactive)
 * ------------------------------------------------------------------------- */
const OUTCOMES = [
  { icon: '💻', field: 'Technology',  title: 'Software Engineer at Google', detail: '₹28L / yr' },
  { icon: '🩺', field: 'Medicine',    title: 'Doctor (MBBS) · AIIMS Delhi',  detail: 'Government seat' },
  { icon: '🌿', field: 'Environment', title: 'Environmental Scientist · ISRO', detail: 'Research track' },
];

function OutcomeCard({ icon, field, title, detail }) {
  return (
    <div style={{
      border: '1px solid rgba(91,82,184,0.35)',
      borderRadius: 'var(--radius-card)',
      background: 'rgba(8,9,30,0.55)',
      backdropFilter: 'blur(8px)',
      padding: '20px 22px',
      textAlign: 'left',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
        <span className="starship-caption" style={{ color: 'var(--text-tertiary)' }}>{field}</span>
      </div>
      <p style={{
        margin: 0,
        fontSize: 'var(--fs-body)',
        fontWeight: 'var(--fw-medium)',
        color: 'var(--text-primary)',
        lineHeight: 1.4,
      }}>
        {title}
      </p>
      <p style={{
        margin: '8px 0 0',
        fontSize: 'var(--fs-body-sm)',
        color: 'var(--stardust)',
        lineHeight: 1.5,
      }}>
        {detail}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Small building blocks
 * ------------------------------------------------------------------------- */
function TopBar() {
  const [beginHover, setBeginHover] = useState(false);
  const { playClick } = useSoundManager();
  return (
    <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px clamp(18px, 4vw, 40px)', pointerEvents: 'none' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10,
        textDecoration: 'none', pointerEvents: 'auto' }}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M9 0.5 L11 6.6 L17.5 9 L11 11.4 L9 17.5 L7 11.4 L0.5 9 L7 6.6 Z"
            fill="var(--stardust)" />
        </svg>
        <span style={{ color: 'var(--text-primary)', fontWeight: 'var(--fw-medium)',
          letterSpacing: '0.18em', fontSize: 13, textTransform: 'uppercase' }}>Starship</span>
      </Link>
      <Link
        to="/onboarding"
        onClick={playClick}
        onMouseEnter={() => setBeginHover(true)}
        onMouseLeave={() => setBeginHover(false)}
        onFocus={() => setBeginHover(true)}
        onBlur={() => setBeginHover(false)}
        style={{
          pointerEvents: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          padding: '8px 18px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--violet)',
          color: 'var(--text-primary)',
          textDecoration: 'none',
          fontSize: 'var(--fs-caption)',
          fontWeight: 'var(--fw-medium)',
          letterSpacing: 'var(--ls-caption)',
          textTransform: 'uppercase',
          boxShadow: beginHover ? '0 0 18px rgba(91,82,184,0.55)' : '0 0 0 rgba(0,0,0,0)',
          transition: 'box-shadow 200ms var(--ease-emphasis)',
        }}
      >
        Begin&nbsp;→
      </Link>
    </header>
  );
}

function Eyebrow({ children, color = 'var(--glow)' }) {
  return (
    <span className="starship-caption" style={{ color, display: 'block', marginBottom: 16 }}>
      {children}
    </span>
  );
}

// Scroll-linked reveal for the un-pinned scenes (4, 5, 6). A plain wrapper —
// the entrance is driven by GSAP ScrollTrigger with scrub:true (see the
// `.js-scroll-reveal` sweep in the desktop matchMedia block), so it feels
// continuous with the scroll rather than snapping on an IntersectionObserver.
// The resting state is fully visible, so on mobile / reduced-motion (where the
// GSAP sweep is disabled) the content simply shows — never stuck hidden.
function ScrollReveal({ children, style = {} }) {
  return <div className="js-scroll-reveal" style={style}>{children}</div>;
}

const BTN_BASE = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-body-sm)',
  fontWeight: 'var(--fw-medium)', letterSpacing: '0.01em', textDecoration: 'none',
  cursor: 'pointer', lineHeight: 1, whiteSpace: 'nowrap',
  transition: 'transform 200ms var(--ease-emphasis), box-shadow 200ms var(--ease-emphasis), background-color 200ms var(--ease-emphasis)',
};

function CTA({ to, children, variant = 'primary', full = false }) {
  const [hover, setHover] = useState(false);
  const { playClick } = useSoundManager();
  const variants = {
    primary:   { padding: '14px 28px', background: 'var(--gradient-brand)', color: 'var(--text-primary)' },
    secondary: { padding: '14px 26px', background: 'transparent', color: 'var(--text-primary)',
      border: `1px solid ${hover ? 'rgba(200,184,255,0.55)' : 'rgba(200,184,255,0.30)'}` },
    final:     { padding: '17px 40px', background: 'var(--violet)', color: 'var(--text-primary)', fontSize: 'var(--fs-body)' },
  };
  const lift = {
    transform: hover ? 'translateY(-2px)' : 'none',
    boxShadow: hover && variant !== 'secondary' ? 'var(--glow-violet)' : '0 0 0 rgba(0,0,0,0)',
  };
  return (
    <Link to={to}
      onClick={playClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{ ...BTN_BASE, ...variants[variant], ...lift,
        width: full ? '100%' : 'auto' }}>
      {children}
    </Link>
  );
}

/* ===========================================================================
 * Landing
 * ======================================================================== */
export default function Landing() {
  const root = useRef(null);
  const isMobile = useIsMobile();
  const { playChime, playDust, startWind, unlocked } = useSoundManager();

  // Throttle ref for dust sound — only fires if 200ms have passed since last call
  const lastDustTimeRef = useRef(0);
  // SECTION D (bug 1): ref to the actual particle-figure wrapper so the dust
  // proximity test measures the FIGURE's bounding box (getBoundingClientRect),
  // not a large Scene-1 container — and only fires within a tight radius.
  const seatedRef = useRef(null);

  // Scene 4 — live stats fetched from GET /stats on mount.
  // Fallback values show while the request is in-flight or if it fails.
  const [stats, setStats] = useState({ careers: 25, scholarships: 340, universities: 180, states: 28 });
  useEffect(() => {
    client.get('/stats').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  // FIX 5 + FIX 7: skyline layer refs for scroll parallax depth + cursor parallax
  const farLayerRef     = useRef(null);
  const midLayerRef     = useRef(null);
  const nearLayerRef    = useRef(null);
  const rooftopLayerRef = useRef(null);
  // FIX 6: constellation wrapper ref — scroll-fade tween fires late (0.7) in tl1
  const constellationRef = useRef(null);

  // Start ambient wind once the AudioContext is unlocked and user has scrolled
  // past 10% of the viewport height.
  useEffect(() => {
    if (!unlocked) return;
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.1) {
        startWind();
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [unlocked, startWind]);

  // SECTION D (bug 1) — dust proximity. The old trigger was an onMouseMove on
  // the figure's wrapper, so it fired anywhere inside that box — and because the
  // box is inside the GSAP-scaled `.js-cam`, at the zoomed-in start its rect was
  // huge, firing "from a distance". This recalculates the figure's real screen
  // box every move (getBoundingClientRect, so it tracks the camera scale) and
  // only plays dust when the cursor is within a TIGHT 70px of that box.
  const DUST_RADIUS = 70;
  useEffect(() => {
    if (isMobile) return; // no cursor on touch devices
    const onMove = (e) => {
      const el = seatedRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // distance from the cursor to the figure's box (0 when inside it)
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      if (Math.hypot(dx, dy) > DUST_RADIUS) return;
      const now = Date.now();
      if (now - lastDustTimeRef.current > 200) {
        lastDustTimeRef.current = now;
        playDust();
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [isMobile, playDust]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // ---- ambient loops (any size, motion allowed) --------------------
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.to('.js-scroll-cue', { y: 9, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut' });

        // Scene 3 — glow border pulses once section enters the viewport
        const glowTween = gsap.to('.js-scene3-glow', {
          boxShadow: '0 0 30px rgba(83,74,183,0.5), 0 0 80px rgba(83,74,183,0.15)',
          duration: 2, yoyo: true, repeat: -1, ease: 'sine.inOut', paused: true,
        });
        ScrollTrigger.create({
          trigger: '.scene-3', start: 'top 80%', once: true,
          onEnter: () => glowTween.play(),
        });

        // Scene 5 (Hope) — same pulsing glow on the stargazer image card
        const glow5 = gsap.to('.js-scene5-glow', {
          boxShadow: '0 0 30px rgba(83,74,183,0.5), 0 0 80px rgba(83,74,183,0.15)',
          duration: 2, yoyo: true, repeat: -1, ease: 'sine.inOut', paused: true,
        });
        ScrollTrigger.create({
          trigger: '.scene-5', start: 'top 80%', once: true,
          onEnter: () => glow5.play(),
        });
      });

      // ---- mobile constellation pulse ----------------------------------
      mm.add('(max-width: 767px) and (prefers-reduced-motion: no-preference)', () => {
        gsap.to('.js-constellation', {
          opacity: 0.6,
          filter: 'drop-shadow(0 0 10px rgba(200,184,255,0.55))',
          duration: 1,
          stagger: { each: 0.7, repeat: -1, yoyo: true },
          ease: 'sine.inOut',
        });
      });

      // ---- desktop pinned storytelling ---------------------------------
      mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {

        // SCENE 1 — the camera pull-back. Opens pushed in on the seated
        // student (cam scaled up, sky/city/copy hidden); scrubbing scrolls
        // the camera back out to the full vista, then a gentle recede + fade
        // hands off to scene 2.
        const tl1 = gsap.timeline({
          scrollTrigger: { trigger: '.scene-1', start: 'top top', end: '+=170%', pin: true, scrub: 1 },
        });
        tl1
          .to('.js-scroll-cue-wrap', { autoAlpha: 0, duration: 0.1 }, 0.05)
          .fromTo('.js-cam', { scale: 1.82 }, { scale: 1, ease: 'none', duration: 0.66 }, 0)
          .from('.js-sky-layer', { autoAlpha: 0, duration: 0.42 }, 0.10)
          .from('.js-city', { autoAlpha: 0, y: 30, duration: 0.44 }, 0.14)
          .from('.js-ground-glow', { autoAlpha: 0, duration: 0.44 }, 0.14)
          .from('.js-horizon', { autoAlpha: 0, duration: 0.44 }, 0.16)
          .from('.js-hero-line', { autoAlpha: 0, y: 30, stagger: 0.07, duration: 0.3 }, 0.44)
          // FIX 6: constellation fades out LATE (position 0.7, was 0.58) — fully
          // visible while the user is on Scene 1, only fading as it scrolls away
          .to(constellationRef.current, { opacity: 0, duration: 0.3 }, 0.7)
          .to('.js-cam', { scale: 0.97, duration: 0.16 }, 0.84)
          .to('.scene-1', { autoAlpha: 0, duration: 0.16 }, 0.86)
          // Independent depth parallax — each layer rises at a DIFFERENT speed so
          // the skyline gains depth on scroll (near rises faster than far).
          .to(farLayerRef.current,     { yPercent: -4,  ease: 'none' }, 0)
          .to(midLayerRef.current,     { yPercent: -10, ease: 'none' }, 0)
          .to(nearLayerRef.current,    { yPercent: -18, ease: 'none' }, 0)
          // FIX 2/3 — rooftop parallax is now a BOUNDED pixel value, not yPercent.
          // The rooftop layer is now rendered at natural aspect (height:auto ≈ 960px
          // at desktop width — see SkylineLayers), so the old yPercent:-26 would lift
          // it ~250px and rip the flat roof off the bottom mid-pull-back (re-opening
          // the very gap FIX 3 closes). A fixed -12px keeps the same gentle foreground
          // drift while the -14px bottom offset guarantees the roof stays flush at the
          // viewport bottom throughout the scrub. far/mid/near parallax UNCHANGED.
          .to(rooftopLayerRef.current, { y: -12, ease: 'none' }, 0);

        // FIX 7: cursor parallax quickTo per layer — depth reinforcement on mousemove.
        // safeQuickTo returns a no-op if target is null (e.g. image failed to load).
        const safeQuickTo = (el, prop, opts) => el ? gsap.quickTo(el, prop, opts) : () => {};
        const farDx  = safeQuickTo(farLayerRef.current,  'x', { duration: 0.7, ease: 'power3' });
        const farDy  = safeQuickTo(farLayerRef.current,  'y', { duration: 0.7, ease: 'power3' });
        const midDx  = safeQuickTo(midLayerRef.current,  'x', { duration: 0.7, ease: 'power3' });
        const midDy  = safeQuickTo(midLayerRef.current,  'y', { duration: 0.7, ease: 'power3' });
        const nearDx = safeQuickTo(nearLayerRef.current, 'x', { duration: 0.7, ease: 'power3' });
        const nearDy = safeQuickTo(nearLayerRef.current, 'y', { duration: 0.7, ease: 'power3' });

        // constellation depth parallax (existing) + layer cursor parallax (FIX 7)
        const dx = gsap.quickTo('.js-depth', 'x', { duration: 0.7, ease: 'power3' });
        const dy = gsap.quickTo('.js-depth', 'y', { duration: 0.7, ease: 'power3' });
        const onMove = (e) => {
          dx(-(e.clientX / window.innerWidth - 0.5) * 28);
          dy(-(e.clientY / window.innerHeight - 0.5) * 20);
          // FIX 7: layer cursor parallax — near layers move more than far
          const deltaX = e.clientX - window.innerWidth / 2;
          const deltaY = e.clientY - window.innerHeight / 2;
          farDx(deltaX * 0.006);  farDy(deltaY * 0.006);
          midDx(deltaX * 0.013);  midDy(deltaY * 0.013);
          nearDx(deltaX * 0.022); nearDy(deltaY * 0.022);
          // rooftopLayer: fixed — does not move with cursor
        };
        window.addEventListener('mousemove', onMove);

        // SCENE 2 — atmospheric pressure. SVG crowd sets the mood; the lone
        // inline-SVG student's back curves forward and arms rise under the weight
        // — six independent groups, never a whole-body tilt.
        gsap.fromTo('.scene-2', { scale: 1.05, y: 50 }, {
          scale: 1, y: 0, ease: 'none',
          scrollTrigger: { trigger: '.scene-2', start: 'top bottom', end: 'top top', scrub: 1 },
        });
        const tl2 = gsap.timeline({
          scrollTrigger: { trigger: '.scene-2', start: 'top top', end: '+=95%', pin: true, scrub: 1 },
        });
        tl2
          .from('.js-copy2', { autoAlpha: 0, y: 26, duration: 0.34 }, 0)
          .to('.js-dim-const', { opacity: 0.12, duration: 0.5 }, 0.1)
          // SECTION 4: upper body folds forward about the hips; the near arm
          // swings up and the forearm folds so the hand covers the face. Each
          // joint rotates about an exact user-space pivot (svgOrigin). Values
          // tuned visually against student-design-sheet.jpg.
          .to('#sc2-body', { rotation: -58, svgOrigin: '108 248', ease: 'power2.inOut', duration: 1 }, 0)
          .to('#sc2-arm',  { rotation: 146, svgOrigin: '90 150',  ease: 'power2.inOut', duration: 1 }, 0)
          .to('#sc2-fore', { rotation: 104, svgOrigin: '92 206',  ease: 'power2.inOut', duration: 0.9 }, 0.08)
          .fromTo('.js-hint', { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.4 }, 0.66)
          // SECTION E — Scene 2 EXIT fade. Previously Scene 2 had NO fade-out: the
          // pinned scrub folded the figure and faded copy IN, but when the pin
          // released the whole scene simply stopped being visible with no overlap
          // region — so there was no cross-fade into Scene 3 (which the user
          // reported as "still no transition between Scene 2 and Scene 3"). These
          // tweens fade Scene 2's content (copy, lone figure + its hint star, and
          // the dim overhead constellations) out continuously over the LAST quarter
          // of the pinned scrub, so it is already transparent as the pin hands off —
          // overlapping in scroll-distance with Scene 3's own scrub fade-in
          // (.js-scene3-content, start 'top 80%') to read as a smooth cross-fade.
          .to('.js-copy2',     { autoAlpha: 0, ease: 'none', duration: 0.22 }, 0.78)
          .to('.js-lone',      { autoAlpha: 0, ease: 'none', duration: 0.22 }, 0.78)
          .to('.js-dim-const', { autoAlpha: 0, ease: 'none', duration: 0.22 }, 0.78)
          // SECTION E — the background crowd figures (the repeated faceless figure
          // rows behind the main figure, rendered by <CrowdBackground />). Its <svg>
          // had NO class, so it was the one Scene-2 element NOT covered by the
          // fade-out and stayed visible after everything else faded. Added a
          // `.js-crowd` class to that svg and fade it out on the SAME tween position
          // (0.78), easing, and duration so the entire Scene 2 visual set fades together.
          .to('.js-crowd',     { autoAlpha: 0, ease: 'none', duration: 0.22 }, 0.78);

        // SCENE 3 — discovery. SECTION D fix: the previous transition was a
        // PINNED ScrollTrigger timeline (pin:true, end:'+=90%', scrub:1) whose
        // only tween faded `.js-copy3` IN once near the start — with NO fade-out,
        // so when the pin released the scene snapped/disappeared abruptly (and the
        // pin-spacer left a dead-zone before Scene 4). It is now UN-pinned and uses
        // the IDENTICAL continuous scrub pattern as scenes 4–6: a y-parallax on the
        // section, plus a scrub fade-IN as the content enters and a scrub fade-OUT
        // as it leaves — never a snap, never an abrupt disappear.
        gsap.fromTo('.scene-3', { y: 60 }, {
          y: 0, ease: 'none',
          scrollTrigger: { trigger: '.scene-3', start: 'top bottom', end: 'top top', scrub: 1 },
        });
        // entrance — fade + rise in continuously as the scene enters the viewport
        gsap.fromTo('.js-scene3-content',
          { opacity: 0, y: 40 },
          {
            opacity: 1, y: 0, ease: 'none',
            scrollTrigger: { trigger: '.scene-3', start: 'top 80%', end: 'top 30%', scrub: true },
          });
        // exit — fade + rise out continuously as the scene leaves (bottom passes up
        // through the viewport), mirroring scenes 4–6's hand-off rather than snapping.
        //
        // ROOT CAUSE FIX (Section C): the previous gsap.to() version captured the
        // element's opacity at CREATION TIME as its "from" state. Because the
        // entrance fromTo above immediately applies opacity:0 (the "from" value)
        // when the page loads and scene 3 is below the viewport, the exit to()
        // recorded opacity:0 → opacity:0 — a no-op — and the element snapped
        // abruptly instead of fading. Using fromTo() with an explicit {opacity:1,
        // y:0} from state makes the exit scrub always animate from fully-visible
        // to transparent, regardless of what other tweens have set on the element.
        gsap.fromTo('.js-scene3-content',
          { opacity: 1, y: 0 },
          {
            opacity: 0, y: -40, ease: 'none',
            scrollTrigger: { trigger: '.scene-3', start: 'bottom 70%', end: 'bottom 20%', scrub: true },
          });

        // SCENE 4 — possibility (sky expands as real options resolve)
        gsap.fromTo('.scene-4', { y: 60 }, {
          y: 0, ease: 'none',
          scrollTrigger: { trigger: '.scene-4', start: 'top bottom', end: 'top top', scrub: 1 },
        });
        gsap.fromTo('.js-sky4', { scale: 0.82, autoAlpha: 0.35 },
          { scale: 1.12, autoAlpha: 0.85, ease: 'none',
            scrollTrigger: { trigger: '.scene-4', start: 'top bottom', end: 'center center', scrub: 1 } });

        // SCENE 5 — hope
        gsap.fromTo('.scene-5', { y: 60 }, {
          y: 0, ease: 'none',
          scrollTrigger: { trigger: '.scene-5', start: 'top bottom', end: 'top top', scrub: 1 },
        });

        // SCENE 6 — contact
        gsap.fromTo('.scene-6', { y: 60 }, {
          y: 0, ease: 'none',
          scrollTrigger: { trigger: '.scene-6', start: 'top bottom', end: 'top top', scrub: 1 },
        });

        // SECTION B — continuous (scrub) entrance for every un-pinned reveal
        // block in scenes 4/5/6. Replaces the old Framer `whileInView` reveals,
        // which snapped on an IntersectionObserver and read as abrupt
        // appear/disappear cuts. scrub:true ties each block's opacity+rise
        // directly to the scroll position, matching the scenes 1→2 feel.
        // Disabled on mobile / reduced-motion (this whole block is gated), so
        // the visible resting state shows there.
        gsap.utils.toArray('.js-scroll-reveal').forEach((el) => {
          gsap.fromTo(el,
            { opacity: 0, y: 40 },
            {
              opacity: 1, y: 0, ease: 'none',
              scrollTrigger: { trigger: el, start: 'top 80%', end: 'top 30%', scrub: true },
            });
        });

        return () => window.removeEventListener('mousemove', onMove);
      });
    }, root);

    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => { cancelAnimationFrame(id); ctx.revert(); };
  }, []);

  return (
    <div
      ref={root}
      className="page-serif"
      style={{
        position: 'relative',
        width: '100%',
        // SECTION A — ONE continuous background for the whole scrollable page.
        // The dark-navy gradient lives here on the outermost wrapper (applied
        // once), spanning every scene from top to bottom using the established
        // palette values (--void #04061A → #06071A → --deep #0F0E2A). Each scene
        // is transparent, so this gradient + the single fixed starfield below
        // show through everywhere — no per-scene colour cuts.
        background: 'linear-gradient(to bottom, #04061A 0%, #06071A 50%, #0F0E2A 100%)',
      }}
    >
      {/* SECTION A — the ONE starfield: a single fixed, full-viewport canvas
          sitting behind every scene (z-index 0). Because it is position:fixed it
          stays full-viewport regardless of scroll, so the same star field reads
          continuously through all six scenes — never scoped to Scene 1. */}
      <div
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      >
        <StarfieldCanvas glowColor="rgba(83,74,183,0.16)" shootingStars />
      </div>

      <TopBar />

      {/* =================== SCENE 1 — THE ROOFTOP =================== */}
      <section className="scene-1" style={sceneStyle({ minHeight: '100vh', paddingBottom: 0, zIndex: 1, perspective: '1000px' })}>
        {/* the world the camera moves through — GSAP scales this whole layer.
            (The starfield is no longer a child here — it's the single fixed
            page-wide canvas above — so the camera pull-back scales the city,
            constellations, horizon and student, while the sky stays put.) */}
        {/* FIX 5 — scroll-limbo "square outline" artifact. During the camera
            pull-back, `.js-cam` is GPU-composited and scaled (1.82 → 1) while
            holding masked skyline children. At intermediate non-1.0 scales the
            compositing layer's backing-store edge could surface as a faint
            rectangular outline on the skyline's left/right sides. No element here
            has any outline/border/box-shadow (`.js-city` and the skyline imgs all
            set border/boxShadow:'none' explicitly), so this is a compositing-edge
            artifact, not a painted border. Fix = pure compositing HINTS on the
            transformed element — backfaceVisibility:hidden + transformStyle:flat
            (+ isolation:isolate to give it its own stacking/compositing context so
            its layer bounds are clamped). These do NOT alter the resting (scale:1)
            or full-pull-back (scale:1.82) layout/appearance at all — they only
            stabilise how the layer is rasterised mid-transform. No locked
            dimensional/positional value (size, inset, transformOrigin) changed. */}
        <div className="js-cam" style={{ position: 'absolute', inset: 0, zIndex: 0,
          transformOrigin: '50% 90%', willChange: 'transform',
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transformStyle: 'preserve-3d', isolation: 'isolate' }}>

          {/* warm city glow on the horizon */}
          <div className="js-horizon" aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0,
            bottom: '16%', height: '34%', zIndex: 1, pointerEvents: 'none',
            background: 'radial-gradient(120% 90% at 50% 100%, rgba(239,159,39,0.14), rgba(83,74,183,0.08) 42%, transparent 70%)' }} />

          {/* Scene 1 constellation sky — SVGs loaded inline, proximity-interactive.
              ConstellationLayer carries js-sky-layer (reveal tween) and receives
              constellationRef (FIX 6: scroll fade-out at position 0.7, not 0.58).
              isMobile passed so scale/position/hide-5th are handled inside. */}
          <ConstellationLayer ref={constellationRef} onChime={playChime} isMobile={isMobile} />

          {/* SECTION C — 4-layer skyline (all PNG). The skyline is the dominant
              context: the far/mid/near city layers fill this container (height
              34vh) so they read clearly ABOVE and BEHIND the rooftop. The rooftop
              PNG is constrained to a modest 22vh strip at the bottom (see
              SkylineLayers) — looking out ACROSS a city from a rooftop vantage,
              not AT a giant rooftop. overflow:visible so the rooftop is never
              clipped. Layer refs wired for scroll + cursor parallax. */}
          <div className="js-city" aria-hidden="true" style={{
            position: 'absolute', bottom: 0, left: 0,
            width: '100%',
            // SECTION A/B — ROOT CAUSE of the preview-vs-real-browser size/placement
            // mismatch, and its fix. This container was `height:52vh, maxHeight:480px`.
            // 52vh === 480px at a viewport height of 923px:
            //   • The dev-tool preview renders in a SHORT fixed internal viewport
            //     (~800px tall) → 52vh = ~416px, UNDER the cap → the vh value governs,
            //     so the skyline is a full 52% of the viewport (the look the user
            //     approved).
            //   • A real browser on a taller window (>923px — e.g. 1080px, or any
            //     tall monitor) → 52vh exceeds 480px → the maxHeight CLAMPS the
            //     skyline to a fixed 480px, i.e. only ~44% of the viewport (less on
            //     taller screens). The skyline renders proportionally SMALLER and
            //     LOWER, while the vh-based student/shadow keep scaling — so every
            //     element's size, placement, and alignment drifts out of register.
            // FIX: vh-ONLY (no maxHeight). A percentage viewport unit scales with the
            // actual window, so the skyline holds a constant 52% (mobile 40%) of the
            // viewport height at EVERY size — matching the preview's proportions in a
            // real browser instead of getting clamped to one fixed pixel height.
            height: isMobile ? '40vh' : '52vh',
            background: 'none', border: 'none', boxShadow: 'none', overflow: 'visible',
            zIndex: 1, pointerEvents: 'none',
          }}>
            <SkylineLayers
              farRef={farLayerRef}
              midRef={midLayerRef}
              nearRef={nearLayerRef}
              rooftopRef={rooftopLayerRef}
            />

            {/* CHANGE 1a — skyline atmosphere (Aman's request): a natural hazy
                glow + purple tinge over the city. Purely ADDITIVE: a new overlay
                child of `.js-city`, so it inherits `.js-city`'s existing fade-in
                (no GSAP timeline edit) and blends within `.js-cam`'s isolated
                stacking context via mixBlendMode:'screen' — lightening the skyline
                pixels behind it (haze/glow) and casting them violet (tinge). It
                sits above the skyline layers but below the student/ground-glow
                (z 4/5 siblings of `.js-city`). No locked SkylineLayers value
                touched. The two stacked gradients are: (1) a horizontal haze band
                hugging the roofline horizon, (2) a soft central bloom rising from
                the city core. */}
            <div className="js-skyline-haze" aria-hidden="true" style={{
              position: 'absolute', inset: 0,
              zIndex: 5, pointerEvents: 'none', mixBlendMode: 'screen',
              filter: 'blur(3px)',
              background:
                'linear-gradient(to top, transparent 0%, rgba(120,108,210,0.10) 20%, rgba(160,146,238,0.18) 40%, rgba(123,116,221,0.07) 62%, transparent 82%),' +
                'radial-gradient(115% 62% at 50% 78%, rgba(140,124,224,0.16) 0%, rgba(99,86,190,0.07) 42%, transparent 74%)',
            }} />
          </div>

          {/* SECTION 1: the old `.js-rooftop` dark-gradient overlay block + glowing
              edge line are removed. They were the "solid colour block" and the
              "thin horizontal line at the student's feet" in the screenshot — now
              that the skyline PNGs (incl. the rooftop layer) load, they are dead
              placeholder treatment. The only lower-scene elements that remain are
              the 4 skyline PNGs, the particle student, and its shadow. */}

          {/* student shadow ellipse — grounded beneath the particle figure.
              SECTION 3: moved down (≈5–6vh) so more of the taller skyline shows. */}
          <div aria-hidden="true" style={{
            position: 'absolute',
            left: '50%',
            bottom: isMobile ? '4vh' : '6vh',
            transform: 'translateX(-50%)',
            width: isMobile ? '80px' : '120px',
            height: '12px',
            borderRadius: '50%',
            // CHANGE 1c — slightly deeper, tighter contact shadow so the figure is
            // anchored to the rooftop (grounded, not floating).
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0) 72%)',
            filter: 'blur(5px)',
            zIndex: 4,
            pointerEvents: 'none',
          }} />

          {/* the student, seated at the roof's edge — zIndex:5 (above rooftop layer z:4).
              onMouseMove triggers the dust repulsion sound (throttled to 200ms). */}
          {/* SECTION 3: student moved down (≈6–7vh) so the taller skyline reads
              above/behind the figure. */}
          {/* SECTION D (bug 1): the dust sound is now driven by a window-level
              proximity test (see the DUST_RADIUS effect) measured against THIS
              wrapper's getBoundingClientRect — not an onMouseMove over the whole
              box — so it only triggers within 70px of the actual figure. The
              wrapper hugs the StardustStudent canvas, so its rect is the figure's
              real (camera-scaled) screen box. Student sits at 7vh — well within
              the corrected 22vh rooftop, so it reads as seated on the surface. */}
          {/* ground-glow — sits between the rooftop layer (z=4 inside .js-city)
              and the student (z=5) both in DOM order and z-index.
              Width: 364px desktop (≈1.3× the 280px student) / 236px mobile.
              Height: 150px desktop (≈0.44× the 340px student) / 110px mobile.
              Bottom matches student's own anchor (7vh / 5vh) so glow is centred
              at feet. At a 900px viewport, glow top = 7vh+150px = 213px from the
              bottom (23.7%) — within the bottom 25% zone, never near the hero.
              Invisible at full zoom-in; fades in via tl1 alongside the pull-back. */}
          <div
            className="js-ground-glow"
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%',
              bottom: isMobile ? '5vh' : '7vh',
              transform: 'translateX(-50%)',
              width: isMobile ? 236 : 364,
              height: isMobile ? 110 : 150,
              // CHANGE 1b — starry purple grounding glow (was cold white-blue). A
              // warm-lavender core fading to violet pools the student's own light
              // onto the rooftop surface so he reads as seated, not floating.
              background: 'radial-gradient(ellipse at 50% 70%, rgba(200,184,255,0.30) 0%, rgba(127,116,221,0.13) 45%, transparent 75%)',
              mixBlendMode: 'screen',
              filter: 'blur(6px)',
              zIndex: 4,
              pointerEvents: 'none',
            }}
          />
          <div
            ref={seatedRef}
            className="js-seated"
            aria-hidden="true"
            style={{
              position: 'absolute', left: '50%',
              bottom: isMobile ? '5vh' : '7vh',
              transform: 'translateX(-50%)', zIndex: 5,
            }}
          >
            <StardustStudent
              width={isMobile ? 182 : 280}
              height={isMobile ? 221 : 340}
            />
          </div>
        </div>

        {/* hero copy — lifted into the clear sky above the rooftop, revealed as
            the camera settles. Resting state is fully visible so it can never
            get stuck hidden.
            FIX 1 (mobile only): the mobile top offset was raised 8% → 16% so the
            text block drops down to fill the empty gap that sat between it and the
            top of the visible skyline on mobile. Desktop ('12%') is UNCHANGED — the
            desktop skyline + copy positioning is locked/approved. Only the mobile
            branch of this single value moved; no skyline/rooftop/student value touched. */}
        <div style={{ position: 'absolute', top: isMobile ? '16%' : '12%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 5, width: 'min(720px, 92%)', textAlign: 'center' }}>
          <div className="js-hero-line">
            <h1 style={{
              fontSize: 'clamp(2rem, 5vw, 4rem)',
              fontWeight: 'var(--fw-medium)', lineHeight: 'var(--lh-tight)',
              margin: 0, color: 'var(--text-primary)', textShadow: '0 2px 36px rgba(4,6,26,0.85)',
            }}>
              Your future is out there. Let&rsquo;s find it.
            </h1>
          </div>
          <div className="js-hero-line">
            <p style={{ marginTop: isMobile ? 14 : 20, fontSize: 'var(--fs-body)', color: 'var(--text-secondary)',
              lineHeight: 'var(--lh-body)', maxWidth: 540, marginLeft: 'auto', marginRight: 'auto',
              fontFamily: 'var(--font-serif)' }}>
              Free career guidance for every student across India.
            </p>
          </div>
          <div className="js-hero-line" style={{ marginTop: isMobile ? 20 : 30, display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <CTA to="/onboarding" variant="primary">Start your assessment</CTA>
            <CTA to="/how-it-works" variant="secondary">See how it works</CTA>
          </div>
          <div className="js-hero-line">
            <p style={{ marginTop: isMobile ? 12 : 26, fontSize: 'var(--fs-body-sm)', color: 'var(--text-secondary)',
              fontFamily: 'var(--font-serif)' }}>
              <span style={{ color: 'var(--stardust)', fontWeight: 'var(--fw-medium)' }}>2,400+ students</span>
              {' '}have already discovered their path.
            </p>
          </div>
        </div>

        {/* scroll cue */}
        <div className="js-scroll-cue-wrap" aria-hidden="true" style={{ position: 'absolute', bottom: 22, left: '50%',
          transform: 'translateX(-50%)', zIndex: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span className="starship-caption" style={{ color: 'var(--text-tertiary)' }}>Scroll</span>
          <svg className="js-scroll-cue" width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 6 L9 11 L14 6" stroke="var(--stardust)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </section>

      {/* =================== SCENE 2 — PRESSURE / CROWD =================== */}
      <section className="scene-2" style={sceneStyle({ height: '100vh', zIndex: 2, background: 'transparent' })}>
        {/* atmospheric SVG crowd — pure CSS/SVG, no photograph, z-index 0 */}
        <CrowdBackground />

        {/* SECTION C — Scene 2 keeps the single root gradient + fixed starfield
            (the section itself is background:'transparent'). The "pressure" mood
            is set by a VERY subtle dark vignette only (low opacity ~0.18, clear
            centre) — NOT a full dark override — so the base gradient and stars
            stay visible through it for continuity with scenes 1 and 3. */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(120% 80% at 50% 55%, transparent 50%, rgba(4,6,26,0.18) 100%)',
        }} />

        {/* dim potential overhead — constellations as "out of reach" futures */}
        <div className="js-dim-const" aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 3, opacity: 0.32 }}>
          {DIM_SKY.map((s) => (
            <div key={s.key} style={{ position: 'absolute', top: s.top, left: s.left, transform: 'translateX(-50%)' }}>
              <Constellation shape={CONSTELLATIONS[s.key]} size={s.size} opacity={0.55} />
            </div>
          ))}
        </div>

        {/* the thesis — shown by the scene, anchored by one line */}
        <div className="js-copy2" style={{ position: 'absolute', top: '21%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 4, width: '90%', maxWidth: 600, textAlign: 'center', padding: '0 clamp(24px, 4vw, 8px)' }}>
          <Eyebrow color="var(--text-tertiary)">The Reality</Eyebrow>
          <h2 style={{ fontSize: 'var(--fs-section)', fontWeight: 'var(--fw-medium)', lineHeight: 1.3, margin: 0, color: 'var(--text-primary)' }}>
            Most choose by pressure&nbsp;&mdash; not by potential.
          </h2>
        </div>

        {/* the lone student — clean side-profile SVG; GSAP folds the upper body +
            arm via IDs (#sc2-body, #sc2-arm, #sc2-fore) so the hand covers the face */}
        <div className="js-lone" aria-hidden="true" style={{ position: 'absolute', left: '50%', bottom: '15%',
          transform: 'translateX(-50%)', zIndex: 4 }}>
          <StudentFigureTraced />
          {/* the single star that wakes when this student looks up */}
          <svg className="js-hint" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"
            style={{ position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)', overflow: 'visible' }}>
            <circle cx="20" cy="20" r="2.4" fill="var(--stardust)" />
            <g stroke="rgba(200,184,255,0.75)" strokeWidth="1" strokeLinecap="round">
              <line x1="20" y1="9" x2="20" y2="2" /><line x1="20" y1="31" x2="20" y2="38" />
              <line x1="9" y1="20" x2="2" y2="20" /><line x1="31" y1="20" x2="38" y2="20" />
            </g>
          </svg>
        </div>
      </section>

      {/* =================== SCENE 3 — DISCOVERY =================== */}
      <section className="scene-3" style={sceneStyle({ height: '100vh', zIndex: 3, background: 'transparent' })}>
        {/* two-column: aerial crossroads image LEFT (45%), copy RIGHT (55%).
            SECTION D: the whole block is `.js-scene3-content` so GSAP can fade it
            in AND out on scroll (continuous scrub) — no pin, no snap. */}
        <div className="js-scene3-content" style={{
          position: 'relative', zIndex: 1, display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          width: '100%', maxWidth: 1040,
          gap: isMobile ? 24 : 0, alignItems: 'center',
        }}>
          {/* LEFT — the "paths"/crossroads image (the right map) with pulsing glow.
              SECTION 5: padding reduced to 1.5rem so the image has more presence. */}
          <div style={{
            flex: isMobile ? 'none' : '0 0 48%',
            width: isMobile ? '100%' : '48%',
            padding: isMobile ? '0 1.5rem' : '1.5rem',
            boxSizing: 'border-box',
          }}>
            <div
              className="js-scene3-glow"
              style={{
                border: '1px solid rgba(83,74,183,0.5)',
                borderRadius: 18,
                padding: 6,
                background: 'rgba(83,74,183,0.04)',
                boxShadow: '0 0 20px rgba(83,74,183,0.25), 0 0 60px rgba(83,74,183,0.08)',
                transition: 'transform 0.5s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <img
                src="/assets/photos/scene4-paths.jpg"
                alt="" aria-hidden="true"
                style={{
                  width: '100%',
                  maxHeight: isMobile ? 240 : 380,
                  objectFit: 'cover',
                  objectPosition: 'center',
                  display: 'block',
                  borderRadius: 16,
                }}
              />
            </div>
          </div>

          {/* RIGHT — copy, left-aligned, vertically centred */}
          <div className="js-copy3" style={{
            flex: isMobile ? 'none' : '0 0 55%',
            width: isMobile ? '100%' : '55%',
            paddingLeft: isMobile ? 0 : '3rem',
            display: 'flex', alignItems: 'center',
          }}>
            <div style={{ maxWidth: 440 }}>
              <Eyebrow>Discovery</Eyebrow>
              <h2 style={{
                fontSize: 'var(--fs-section)', fontWeight: 'var(--fw-medium)',
                lineHeight: 1.3, margin: 0, color: 'var(--text-primary)',
                textAlign: 'left',
              }}>
                You&rsquo;re not behind. You&rsquo;re just waiting for the right map.
              </h2>
            </div>
          </div>
        </div>
      </section>

      {/* =================== SCENE 4 — POSSIBILITY =================== */}
      {/* Possibility stays image-free by design — outcome cards + the stat row are
          the proof here. (The "paths" image lives on Discovery; the stargazer on Hope.) */}
      <section className="scene-4" style={sceneStyle({ minHeight: '100vh', flexDirection: 'column', gap: 44, paddingTop: 110, paddingBottom: 110, zIndex: 4, background: 'transparent' })}>
        {/* sky-expand radial glow — scrubbed by GSAP (scale 0.82 → 1.12) */}
        <div className="js-sky4" aria-hidden="true"
          style={{ position: 'absolute', top: '6%', left: '50%', transform: 'translateX(-50%)', width: 680, height: 680,
            maxWidth: '120vw', borderRadius: '50%', zIndex: 0, pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(83,74,183,0.20), rgba(83,74,183,0) 62%)' }} />

        <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 1040, textAlign: 'center' }}>
          <ScrollReveal>
            <Eyebrow>Possibility</Eyebrow>
            <h2 style={{ fontSize: 'var(--fs-section)', fontWeight: 'var(--fw-medium)', lineHeight: 1.3, margin: '0 auto', maxWidth: 600, color: 'var(--text-primary)' }}>
              Discover careers, universities, and scholarships tailored to you.
            </h2>
          </ScrollReveal>

          {/* static career outcome cards — decorative, 3-col on desktop */}
          <ScrollReveal>
            <div style={{ marginTop: 40, display: 'grid', gap: 18,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {OUTCOMES.map((o) => <OutcomeCard key={o.title} {...o} />)}
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div style={{ marginTop: 56, display: 'flex', gap: 28, justifyContent: 'center', flexWrap: 'wrap' }}>
              <StatCounter value={stats.careers} suffix="+" label="Careers" />
              <StatCounter value={stats.scholarships} suffix="+" label="Scholarships" />
              <StatCounter value={stats.universities} suffix="+" label="Universities" />
              <StatCounter value={stats.states} label="States" />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* =================== SCENE 5 — HOPE =================== */}
      {/* SECTION 6: full-height, two-column. Text LEFT (left-aligned, vertically
          centred): HOPE label, headline, "Start your journey" button. Stargazer
          image RIGHT, with a pulsing glow border (.js-scene5-glow) + hover scale. */}
      <section className="scene-5" style={sceneStyle({ minHeight: '100vh', zIndex: 5, background: 'transparent' })}>
        <ScrollReveal style={{ width: '100%', maxWidth: 1040 }}>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 32 : 52,
            alignItems: 'center',
            width: '100%',
          }}>
            {/* LEFT — hope copy + CTA, left-aligned */}
            <div style={{
              flex: isMobile ? 'none' : '0 0 55%',
              width: isMobile ? '100%' : '55%',
              display: 'flex', alignItems: 'center',
            }}>
              <div style={{ maxWidth: 480, width: '100%' }}>
                <Eyebrow>Hope</Eyebrow>
                <h2 style={{
                  fontSize: 'var(--fs-section)', fontWeight: 'var(--fw-medium)',
                  lineHeight: 1.3, margin: 0, color: 'var(--text-primary)', textAlign: 'left',
                }}>
                  Talent exists everywhere. Opportunity should too.
                </h2>
                <div style={{ marginTop: 40, maxWidth: 420 }}>
                  <CTA to="/onboarding" variant="final" full>Start your journey</CTA>
                </div>
              </div>
            </div>

            {/* RIGHT — stargazer-on-hill image with pulsing glow border */}
            <div style={{ flex: isMobile ? 'none' : '0 0 45%', width: isMobile ? '100%' : '45%' }}>
              <div
                className="js-scene5-glow"
                style={{
                  border: '1px solid rgba(83,74,183,0.5)',
                  borderRadius: 16,
                  padding: 6,
                  background: 'rgba(83,74,183,0.04)',
                  boxShadow: '0 0 20px rgba(83,74,183,0.25), 0 0 60px rgba(83,74,183,0.08)',
                  transition: 'transform 0.5s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <img
                  src="/assets/photos/scene3-student-gazing.jpg"
                  alt="" aria-hidden="true"
                  style={{
                    width: '100%',
                    maxHeight: isMobile ? 280 : 440,
                    objectFit: 'cover',
                    objectPosition: 'center',
                    display: 'block',
                    borderRadius: 12,
                  }}
                />
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* =================== SCENE 6 — CONTACT =================== */}
      {/* SECTION 6: contact lives on its own page below Hope. */}
      <section className="scene-6" style={sceneStyle({ minHeight: '100vh', zIndex: 6, background: 'transparent' })}>
        <ScrollReveal style={{ width: '100%', maxWidth: 1040 }}>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 32 : 52,
            alignItems: 'center',
            width: '100%',
          }}>
            {/* LEFT — contact student photo */}
            <div style={{ flex: isMobile ? 'none' : '0 0 45%', width: isMobile ? '100%' : '45%' }}>
              <div style={{
                border: '1px solid rgba(83,74,183,0.4)',
                borderRadius: 12,
                boxShadow: '0 0 20px rgba(83,74,183,0.2), 0 0 60px rgba(83,74,183,0.08)',
                overflow: 'hidden',
              }}>
                <img
                  src="/assets/photos/contact-student.jpg"
                  alt="" aria-hidden="true"
                  style={{
                    width: '100%',
                    maxHeight: 440,
                    objectFit: 'cover',
                    display: 'block',
                    transition: 'transform 0.6s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                />
              </div>
            </div>

            {/* RIGHT — contact info */}
            <div style={{
              flex: isMobile ? 'none' : '0 0 55%',
              width: isMobile ? '100%' : '55%',
              display: 'flex', alignItems: 'center',
            }}>
              <div style={{ maxWidth: 480 }}>
                <Eyebrow>Get In Touch</Eyebrow>
                <h2 style={{
                  fontSize: 'var(--fs-section)', fontWeight: 'var(--fw-medium)',
                  lineHeight: 1.3, margin: '0 0 16px', color: 'var(--text-primary)',
                  textAlign: 'left',
                }}>
                  Have questions?
                </h2>
                <p style={{
                  margin: '0 0 24px', fontSize: 'var(--fs-body)', color: 'var(--text-secondary)',
                  lineHeight: 'var(--lh-body)', fontFamily: 'var(--font-serif)', textAlign: 'left',
                }}>
                  Starship is built for students, by people who believe in them. Reach out with questions, feedback, or partnerships.
                </p>
                <a
                  href="mailto:hello@projectstarship.in"
                  style={{
                    color: 'var(--aurora)',
                    fontSize: 'var(--fs-body)',
                    fontWeight: 'var(--fw-medium)',
                    textDecoration: 'underline',
                  }}
                >
                  hello@projectstarship.in
                </a>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}

// shared scene frame — relative + clipped so decorative absolutes never cause
// horizontal overflow; flex-centres content. Padding is set longhand so a
// scene can override paddingTop/paddingBottom without a shorthand conflict.
function sceneStyle(extra = {}) {
  return {
    position: 'relative', width: '100%', maxWidth: '100%', overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    paddingTop: 90, paddingBottom: 90, paddingLeft: 24, paddingRight: 24,
    boxSizing: 'border-box',
    ...extra,
  };
}
