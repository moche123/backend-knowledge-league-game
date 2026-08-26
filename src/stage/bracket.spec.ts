import {
  buildStageSequence,
  drawPairs,
  generateSeed,
  STAGE_SEQUENCE_BY_SIZE,
} from './bracket';

describe('buildStageSequence', () => {
  it('returns the full elimination tree for 4 players', () => {
    expect(buildStageSequence(4)).toEqual([
      'semifinal',
      'final',
      'third_place',
    ]);
  });

  it('returns the full elimination tree for 8 players', () => {
    expect(buildStageSequence(8)).toEqual([
      'quarterfinal',
      'semifinal',
      'final',
      'third_place',
    ]);
  });

  it('returns the full elimination tree for 16 players', () => {
    expect(buildStageSequence(16)).toEqual([
      'round_of_16',
      'quarterfinal',
      'semifinal',
      'final',
      'third_place',
    ]);
  });

  it('throws for an unsupported bracket size (e.g. 32 — no round_of_32 yet)', () => {
    expect(() => buildStageSequence(32)).toThrow(/Unsupported bracket size/);
  });

  it('every supported size ends in final, third_place', () => {
    for (const sequence of Object.values(STAGE_SEQUENCE_BY_SIZE)) {
      expect(sequence.slice(-2)).toEqual(['final', 'third_place']);
    }
  });
});

describe('drawPairs', () => {
  const eightPlayers = Array.from({ length: 8 }, (_, i) => `player-${i + 1}`);

  it('pairs every participant exactly once (even count)', () => {
    const pairs = drawPairs(eightPlayers, 'fixed-seed');
    expect(pairs).toHaveLength(4);

    const paired = pairs.flat();
    expect(paired).toHaveLength(8);
    expect(new Set(paired).size).toBe(8);
    for (const id of eightPlayers) {
      expect(paired).toContain(id);
    }
  });

  it('never pairs a player against themselves', () => {
    const pairs = drawPairs(eightPlayers, 'another-seed');
    for (const [a, b] of pairs) {
      expect(a).not.toBe(b);
    }
  });

  it('is deterministic: same participants + same seed → same pairs', () => {
    const first = drawPairs(eightPlayers, 'reproducible-seed');
    const second = drawPairs([...eightPlayers], 'reproducible-seed');
    expect(second).toEqual(first);
  });

  it('different seeds produce a different draw (auditable, not fixed)', () => {
    const first = drawPairs(eightPlayers, 'seed-a');
    const second = drawPairs(eightPlayers, 'seed-b');
    expect(second).not.toEqual(first);
  });

  it('throws on an odd number of participants — MVP does not support byes/walkover at draw time', () => {
    const sevenPlayers = eightPlayers.slice(0, 7);
    expect(() => drawPairs(sevenPlayers, 'seed')).toThrow(/odd number/);
  });

  it('throws on duplicate participant ids', () => {
    const withDuplicate = ['a', 'b', 'c', 'a'];
    expect(() => drawPairs(withDuplicate, 'seed')).toThrow(/Duplicate/);
  });

  it('handles the smallest bracket (2 players → 1 pair)', () => {
    const pairs = drawPairs(['a', 'b'], 'seed');
    expect(pairs).toHaveLength(1);
    expect(new Set(pairs[0])).toEqual(new Set(['a', 'b']));
  });
});

describe('generateSeed', () => {
  it('generates a non-empty hex string', () => {
    const seed = generateSeed();
    expect(seed).toMatch(/^[0-9a-f]+$/);
    expect(seed.length).toBeGreaterThan(0);
  });

  it('generates a different seed on every call', () => {
    expect(generateSeed()).not.toBe(generateSeed());
  });
});
