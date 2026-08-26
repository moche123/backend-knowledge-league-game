// Match scoring formula (see CLAUDE.md):
//   normalizedQuality  = (sum(ai_score) / event_max_score) * 100
//   normalizedVelocity = f(time_diff_vs_opponent) scaled to 0-100
//   finalResult = 0.70 * normalizedQuality + 0.30 * normalizedVelocity
//
// The 70/30 split is fixed. Velocity must never be able to reverse a large
// quality gap: at this weight, velocity can move at most 30 points (100 vs 0
// velocity → ±30), so a weighted quality gap greater than 30 points (quality
// diff > 30/0.7 ≈ 42.86) is mathematically impossible to reverse regardless
// of velocity — see tests.

const QUALITY_WEIGHT = 0.7;
const VELOCITY_WEIGHT = 0.3;

export function computeQuality(scoreSum: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return clamp((scoreSum / denominator) * 100, 0, 100);
}

// elapsedSecondsA/B: how long each player took to answer (or the full
// timeLimit, if they didn't answer that question — "used the whole time",
// neither rewarding nor extra-penalizing beyond what quality already does).
// maxPossibleDiffSeconds: theoretical ceiling of the difference (sum of the
// timeLimit of every question in the match) — so the ratio always falls in
// [-1, 1] regardless of how many questions the match has.
export function computeVelocity(
  elapsedSecondsA: number,
  elapsedSecondsB: number,
  maxPossibleDiffSeconds: number,
): { velocityA: number; velocityB: number } {
  if (maxPossibleDiffSeconds <= 0) {
    return { velocityA: 50, velocityB: 50 };
  }
  const diff = elapsedSecondsA - elapsedSecondsB; // positive = A slower
  const ratio = clamp(diff / maxPossibleDiffSeconds, -1, 1);
  const velocityA = clamp(50 - ratio * 50, 0, 100);
  const velocityB = 100 - velocityA;
  return { velocityA, velocityB };
}

export function computeResult(quality: number, velocity: number): number {
  return round2(QUALITY_WEIGHT * quality + VELOCITY_WEIGHT * velocity);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
