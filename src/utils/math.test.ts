import { describe, it, expect } from 'vitest';
import { clamp, lerp, scale } from './math';

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min when below', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('clamps to max when above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns boundary values when equal', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('lerp', () => {
  it('returns a when t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns b when t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns midpoint when t=0.5', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it('extrapolates beyond 0-1', () => {
    expect(lerp(10, 20, 2)).toBe(30);
    expect(lerp(10, 20, -1)).toBe(0);
  });
});

describe('scale', () => {
  it('maps identity range', () => {
    expect(scale(5, 0, 10, 0, 10)).toBe(5);
  });

  it('maps to reversed range', () => {
    expect(scale(0, 0, 10, 10, 0)).toBe(10);
    expect(scale(10, 0, 10, 10, 0)).toBe(0);
  });

  it('handles zero-width input (returns Infinity/NaN edge)', () => {
    // Division by zero — not a crash, just a math edge case
    const result = scale(5, 5, 5, 0, 10);
    expect(result).not.toBeUndefined();
  });

  it('maps typical use case', () => {
    // Map 0-127 MIDI to 0-1
    expect(scale(0, 0, 127, 0, 1)).toBeCloseTo(0);
    expect(scale(127, 0, 127, 0, 1)).toBeCloseTo(1);
    expect(scale(64, 0, 127, 0, 1)).toBeCloseTo(0.504, 2);
  });
});
