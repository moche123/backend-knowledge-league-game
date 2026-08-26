import {
  computeQuality,
  computeResult,
  computeVelocity,
} from './match-scoring-formula';

describe('computeQuality', () => {
  it('is 100 when the score sum equals the denominator (perfect match)', () => {
    expect(computeQuality(100, 100)).toBe(100);
  });

  it('is 0 when nothing was scored', () => {
    expect(computeQuality(0, 100)).toBe(0);
  });

  it('is proportional in between', () => {
    expect(computeQuality(50, 100)).toBe(50);
  });

  it('clamps at 100 even if the score sum somehow exceeds the denominator', () => {
    expect(computeQuality(120, 100)).toBe(100);
  });

  it('returns 0 for a zero/negative denominator instead of dividing by zero', () => {
    expect(computeQuality(10, 0)).toBe(0);
  });
});

describe('computeVelocity', () => {
  it('splits 50/50 when both players took the same time', () => {
    const { velocityA, velocityB } = computeVelocity(60, 60, 300);
    expect(velocityA).toBe(50);
    expect(velocityB).toBe(50);
  });

  it('rewards the faster player above 50, the slower below', () => {
    const { velocityA, velocityB } = computeVelocity(30, 90, 300);
    expect(velocityA).toBeGreaterThan(50);
    expect(velocityB).toBeLessThan(50);
    expect(velocityA + velocityB).toBe(100);
  });

  it('caps at 0/100 for the maximum possible time difference', () => {
    const { velocityA, velocityB } = computeVelocity(300, 0, 300);
    expect(velocityA).toBe(0);
    expect(velocityB).toBe(100);
  });

  it('clamps beyond the theoretical max (defensive) instead of going out of range', () => {
    const { velocityA, velocityB } = computeVelocity(1000, 0, 300);
    expect(velocityA).toBe(0);
    expect(velocityB).toBe(100);
  });

  it('falls back to neutral 50/50 when maxPossibleDiffSeconds is 0', () => {
    const { velocityA, velocityB } = computeVelocity(10, 5, 0);
    expect(velocityA).toBe(50);
    expect(velocityB).toBe(50);
  });
});

describe('computeResult — 70% quality + 30% velocity', () => {
  it('a perfect-quality, slowest player still beats an empty-quality, fastest player', () => {
    // Roadmap case: velocity never reverses a LARGE quality gap.
    const resultA = computeResult(100, 0); // perfect quality, the slowest
    const resultB = computeResult(0, 100); // no quality, the fastest
    expect(resultA).toBeGreaterThan(resultB);
    expect(resultA).toBe(70);
    expect(resultB).toBe(30);
  });

  it('a quality gap bigger than 30 points weighted (>~42.86 raw) is mathematically unflippable by velocity', () => {
    const qualityA = 80;
    const qualityB = 30; // 50-point raw gap, 35 weighted — > 30
    const resultA = computeResult(qualityA, 0); // A with the worst possible velocity
    const resultB = computeResult(qualityB, 100); // B with the best possible velocity
    expect(resultA).toBeGreaterThan(resultB);
  });

  it('a small quality gap CAN be decided by velocity (that is the point of the 30%)', () => {
    const qualityA = 51;
    const qualityB = 50; // minimal quality gap
    const resultA = computeResult(qualityA, 0); // A extremely slow
    const resultB = computeResult(qualityB, 100); // B extremely fast
    expect(resultB).toBeGreaterThan(resultA);
  });

  it('equal quality and velocity produce equal results', () => {
    expect(computeResult(60, 60)).toBe(computeResult(60, 60));
  });
});
