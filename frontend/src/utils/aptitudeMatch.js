/**
 * Weighted aptitude match per RIASEC primary trait.
 * Weights are derived from the cognitive demands of each Holland code:
 *   R (Realistic)      → numerical 60%, logical 40%
 *   I (Investigative)  → logical 50%, analytical 30%, numerical 20%
 *   A (Artistic)       → verbal 60%, analytical 40%
 *   S (Social)         → verbal 70%, analytical 30%
 *   E (Enterprising)   → verbal 50%, logical 30%, analytical 20%
 *   C (Conventional)   → numerical 50%, analytical 30%, logical 20%
 */
export const RIASEC_APTITUDE_WEIGHTS = {
  R: { numerical_reasoning: 0.6, logical_reasoning: 0.4 },
  I: { logical_reasoning: 0.5, analytical_reasoning: 0.3, numerical_reasoning: 0.2 },
  A: { verbal_reasoning: 0.6, analytical_reasoning: 0.4 },
  S: { verbal_reasoning: 0.7, analytical_reasoning: 0.3 },
  E: { verbal_reasoning: 0.5, logical_reasoning: 0.3, analytical_reasoning: 0.2 },
  C: { numerical_reasoning: 0.5, analytical_reasoning: 0.3, logical_reasoning: 0.2 },
};

const ALL_KEYS = [
  'numerical_reasoning',
  'logical_reasoning',
  'verbal_reasoning',
  'analytical_reasoning',
];

function flatMean(aptitude_scores) {
  const vals = ALL_KEYS.map((k) => Number(aptitude_scores?.[k]) || 0);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/**
 * Returns a 0–100 aptitude match % for one career card.
 *
 * @param {string} career_name
 * @param {Object} career_categories  { career_name: "R"|"I"|"A"|"S"|"E"|"C" }
 * @param {Object} aptitude_scores    { numerical_reasoning, logical_reasoning,
 *                                      verbal_reasoning, analytical_reasoning: 0–100 }
 */
export function getAptitudeMatch(career_name, career_categories, aptitude_scores) {
  const trait = career_categories?.[career_name];
  const weights = RIASEC_APTITUDE_WEIGHTS[trait];
  if (!weights) return flatMean(aptitude_scores);

  let score = 0;
  for (const [key, w] of Object.entries(weights)) {
    score += w * (Number(aptitude_scores?.[key]) || 0);
  }
  return Math.round(Math.max(0, Math.min(100, score)));
}
