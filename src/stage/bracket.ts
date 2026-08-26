import { randomBytes } from 'crypto';

export type StageType =
  'round_of_16' | 'quarterfinal' | 'semifinal' | 'final' | 'third_place';

// MVP: cantidad_jugadores_max restringida a potencias de 2, sin byes
// (CLAUDE.md). round_of_32 no existe todavía en el enum stage_type de
// Postgres — 32 queda sin soportar hasta que se agregue.
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

// Sortea pares a partir de una semilla registrada: mismo seed + mismos
// participantes siempre produce el mismo resultado (auditable/reproducible),
// sin depender de Math.random.
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

// FNV-1a: string -> entero 32-bit, usado como semilla numérica del PRNG.
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32: PRNG determinístico de 32 bits, suficiente para un sorteo
// auditable (no necesita ser criptográficamente seguro).
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
