import { randomBytes } from 'crypto';

export type StageType =
  'round_of_16' | 'quarterfinal' | 'semifinal' | 'final' | 'third_place';

// MVP: player count restricted to powers of 2, no byes (CLAUDE.md).
// round_of_32 doesn't exist yet in Postgres' stage_type enum — 32 stays
// unsupported until it's added.
export const STAGE_SEQUENCE_BY_SIZE: Record<number, StageType[]> = {
  4: ['semifinal', 'final', 'third_place'],
  8: ['quarterfinal', 'semifinal', 'final', 'third_place'],
  16: ['round_of_16', 'quarterfinal', 'semifinal', 'final', 'third_place'],
};

export function buildStageSequence(maxPlayers: number): StageType[] {
  const sequence = STAGE_SEQUENCE_BY_SIZE[maxPlayers];
  if (!sequence) {
    throw new Error(
      `Unsupported bracket size: ${maxPlayers} players (supported: ${Object.keys(
        STAGE_SEQUENCE_BY_SIZE,
      ).join(', ')})`,
    );
  }
  return sequence;
}

export function generateSeed(): string {
  return randomBytes(16).toString('hex');
}

// Draws pairs from a recorded seed: same seed + same participants always
// produces the same result (auditable/reproducible), without relying on Math.random.
export function drawPairs(
  participantIds: string[],
  seed: string,
): [string, string][] {
  if (participantIds.length % 2 !== 0) {
    throw new Error(
      'Cannot draw pairs from an odd number of participants — MVP does not support byes',
    );
  }
  if (new Set(participantIds).size !== participantIds.length) {
    throw new Error('Duplicate participant ids in draw');
  }

  const shuffled = seededShuffle(participantIds, seed);
  const pairs: [string, string][] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  return pairs;
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const rng = mulberry32(hashSeed(seed));
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// FNV-1a: string -> 32-bit integer, used as the PRNG's numeric seed.
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32: deterministic 32-bit PRNG, good enough for an auditable draw
// (doesn't need to be cryptographically secure).
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
