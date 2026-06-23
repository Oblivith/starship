/**
 * matchTiers — classify a student's career matches into quality tiers, with an
 * adaptive fallback so a student who has any real differentiation in their scores
 * never sees an empty "Good match" tier.
 *
 * Standard thresholds:
 *   Good match  → ≥ 60%
 *   OK match    → 40–59%
 *   Other       → < 40%
 *
 * Adaptive fallback (triggers when NO career scores ≥ 60% AND the student has at
 * least 5 scored careers): tiers are recomputed from the student's OWN ranked
 * distribution rather than the absolute 60/40 lines —
 *   Good  → top 20% by rank
 *   OK    → next 30% by rank
 *   Other → remaining 50%
 * Expressed as percentage cutoffs taken from the ranked list, so a career is still
 * classified purely by its own percent. Ties at a boundary fall into the better tier,
 * which keeps "Good" non-empty by construction.
 */

export const TIER_IDS = ['good', 'ok', 'other'];

export const TIER_META = {
  good: { id: 'good', label: 'Good match' },
  ok: { id: 'ok', label: 'OK match' },
  other: { id: 'other', label: 'Other matches' },
};

/**
 * Per-tier text colour for the displayed match percentage. All three are existing
 * tokens.css design tokens (no new hex values introduced):
 *   good  → --mint  (#5DCAA5, the brand's positive green-teal)
 *   ok    → --gold  (#EF9F27, the semantic amber)
 *   other → --coral (#D85A30, the dedicated destructive/alert token — the same coral
 *           used by the re-take-assessment / delete buttons in Profile + Dashboard)
 * Applied ONLY to the percentage number, never to the card background or border.
 */
export const TIER_COLORS = {
  good: 'var(--mint)',
  ok: 'var(--gold)',
  other: 'var(--coral)',
};

const STANDARD_GOOD = 60;
const STANDARD_OK = 40;
const ADAPTIVE_MIN_CAREERS = 5;

/**
 * Standard (absolute) tier of a single percentage — Good ≥60, OK 40–59, Other <40.
 * Used as the default classification when no distribution-aware tier is supplied
 * (e.g. a CareerCard rendered outside the Careers page's adaptive context).
 * @param {number} percent
 * @returns {'good' | 'ok' | 'other'}
 */
export function standardTierOf(percent) {
  const n = Number(percent);
  if (n >= STANDARD_GOOD) return 'good';
  if (n >= STANDARD_OK) return 'ok';
  return 'other';
}

/**
 * @param {number[]} percents  the student's match percentages (0–100), one per career.
 * @returns {{
 *   mode: 'standard' | 'adaptive',
 *   caption: string | null,
 *   goodThreshold: number,
 *   okThreshold: number,
 *   tierOf: (percent: number) => 'good' | 'ok' | 'other',
 * }}
 */
export function computeTiers(percents) {
  const vals = (percents || [])
    .map((p) => Number(p))
    .filter((p) => Number.isFinite(p));

  const anyGood = vals.some((p) => p >= STANDARD_GOOD);
  const useAdaptive = !anyGood && vals.length >= ADAPTIVE_MIN_CAREERS;

  if (!useAdaptive) {
    return {
      mode: 'standard',
      caption: null,
      goodThreshold: STANDARD_GOOD,
      okThreshold: STANDARD_OK,
      tierOf: standardTierOf,
    };
  }

  // Adaptive: derive cutoffs from the student's own ranked distribution.
  const sorted = [...vals].sort((a, b) => b - a); // descending
  const n = sorted.length;
  // top 20% are "good", next 30% are "ok". Use ceil so a non-empty Good tier is guaranteed.
  const goodCount = Math.max(1, Math.ceil(n * 0.2));
  const okCount = Math.ceil(n * 0.3);

  const goodThreshold = sorted[Math.min(goodCount - 1, n - 1)];
  const okThreshold = sorted[Math.min(goodCount + okCount - 1, n - 1)];

  return {
    mode: 'adaptive',
    caption: 'Showing relative match quality',
    goodThreshold,
    okThreshold,
    tierOf: (p) => {
      const num = Number(p);
      if (num >= goodThreshold) return 'good';
      if (num >= okThreshold) return 'ok';
      return 'other';
    },
  };
}

/**
 * Percentile rank of a single career's score among ALL of this student's scored
 * careers — the share of the student's other options this career beats. A return
 * of 92 means "better than 92% of your matches" (i.e. top 8%). Pure client-side
 * math on the already-fetched list; no backend involved.
 *
 * @param {number} score             this career's match percentage.
 * @param {number[]} allScores       every scored career's percentage for this student.
 * @returns {number}                 0–100 percentile rank.
 */
export function getPercentileRank(score, allScores) {
  const vals = (allScores || []).map((p) => Number(p)).filter((p) => Number.isFinite(p));
  if (vals.length <= 1) return 100;
  const s = Number(score);
  if (!Number.isFinite(s)) return 0;
  const below = vals.filter((v) => v < s).length;
  return Math.round((below / vals.length) * 100);
}

/**
 * A subtle "Top N% of your matches" caption derived from a percentile rank — but
 * ONLY when it is genuinely distinguishing (top ~30%, i.e. percentile ≥ 70).
 * Returns null otherwise so a merely-average career shows the plain percentage with
 * no extra noise. Examples: percentile 92 → "Top 8% of your matches"; percentile 76
 * → "Top 24% of your matches"; percentile 55 → null.
 *
 * @param {number} percentile        0–100, e.g. from getPercentileRank.
 * @returns {string | null}
 */
export function getPercentileCaption(percentile) {
  const p = Number(percentile);
  if (!Number.isFinite(p) || p < 70) return null;
  const top = Math.max(1, 100 - Math.round(p));
  return `Top ${top}% of your matches`;
}
