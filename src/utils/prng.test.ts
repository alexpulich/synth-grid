import { describe, it, expect } from 'vitest';
import { mulberry32 } from './prng';

describe('mulberry32', () => {
  it('same seed produces same sequence', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);

    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());

    expect(seq1).toEqual(seq2);
  });

  it('different seeds produce different sequences', () => {
    const rng1 = mulberry32(1);
    const rng2 = mulberry32(2);

    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());

    expect(seq1).not.toEqual(seq2);
  });

  it('output is in range [0, 1)', () => {
    const rng = mulberry32(12345);

    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});
