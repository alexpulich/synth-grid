import { describe, it, expect } from 'vitest';
import { euclidean, rotatePattern } from './euclidean';

describe('euclidean', () => {
  it('distributes 4 pulses across 8 steps evenly', () => {
    const pattern = euclidean(8, 4);
    expect(pattern).toHaveLength(8);
    expect(pattern.filter(Boolean)).toHaveLength(4);
    // Bjorklund: [1,0,1,0,1,0,1,0]
    expect(pattern).toEqual([true, false, true, false, true, false, true, false]);
  });

  it('distributes 3 pulses across 8 steps', () => {
    const pattern = euclidean(8, 3);
    expect(pattern).toHaveLength(8);
    expect(pattern.filter(Boolean)).toHaveLength(3);
    // Bjorklund: [1,0,0,1,0,0,1,0]
    expect(pattern).toEqual([true, false, false, true, false, false, true, false]);
  });

  it('distributes 5 pulses across 8 steps', () => {
    const pattern = euclidean(8, 5);
    expect(pattern).toHaveLength(8);
    expect(pattern.filter(Boolean)).toHaveLength(5);
  });

  it('four-on-the-floor: 4 pulses in 16 steps', () => {
    const pattern = euclidean(16, 4);
    expect(pattern).toHaveLength(16);
    expect(pattern.filter(Boolean)).toHaveLength(4);
    // Evenly spaced: every 4th step
    expect(pattern).toEqual([
      true, false, false, false,
      true, false, false, false,
      true, false, false, false,
      true, false, false, false,
    ]);
  });

  it('returns empty array for 0 steps', () => {
    expect(euclidean(0, 0)).toEqual([]);
  });

  it('returns all false for 0 pulses', () => {
    expect(euclidean(4, 0)).toEqual([false, false, false, false]);
  });

  it('returns all true when pulses >= steps', () => {
    expect(euclidean(4, 4)).toEqual([true, true, true, true]);
    expect(euclidean(4, 5)).toEqual([true, true, true, true]);
  });

  it('handles 1 pulse', () => {
    const pattern = euclidean(8, 1);
    expect(pattern.filter(Boolean)).toHaveLength(1);
    expect(pattern[0]).toBe(true);
  });

  it('handles negative steps', () => {
    expect(euclidean(-1, 2)).toEqual([]);
  });
});

describe('rotatePattern', () => {
  it('returns same array with 0 rotation', () => {
    expect(rotatePattern([1, 2, 3, 4], 0)).toEqual([1, 2, 3, 4]);
  });

  it('rotates right by 2', () => {
    expect(rotatePattern([1, 2, 3, 4, 5], 2)).toEqual([3, 4, 5, 1, 2]);
  });

  it('handles empty array', () => {
    expect(rotatePattern([], 3)).toEqual([]);
  });

  it('handles rotation equal to length (full cycle)', () => {
    expect(rotatePattern([1, 2, 3], 3)).toEqual([1, 2, 3]);
  });

  it('handles rotation larger than length', () => {
    expect(rotatePattern([1, 2, 3], 5)).toEqual([3, 1, 2]);
  });

  it('handles negative rotation', () => {
    // -1 mod 4 = 3 → rotate by 3
    expect(rotatePattern([1, 2, 3, 4], -1)).toEqual([4, 1, 2, 3]);
  });
});
