import { describe, it, expect } from 'vitest';
import { createBitcrushCurve } from './performance-fx';

describe('createBitcrushCurve', () => {
  it('returns Float32Array of length 65536', () => {
    const curve = createBitcrushCurve(4);
    expect(curve).toBeInstanceOf(Float32Array);
    expect(curve.length).toBe(65536);
  });

  it('4-bit: values quantized to 16 levels', () => {
    const curve = createBitcrushCurve(4);
    const uniqueValues = new Set(curve);
    // 16 steps maps input [-1,1] to at most ~33 distinct quantized levels (±16 + 0)
    expect(uniqueValues.size).toBeLessThanOrEqual(33);
    expect(uniqueValues.size).toBeGreaterThanOrEqual(16);
  });

  it('8-bit: values quantized to 256 levels', () => {
    const curve = createBitcrushCurve(8);
    const uniqueValues = new Set(curve);
    // 256 steps → at most ~513 distinct levels
    expect(uniqueValues.size).toBeLessThanOrEqual(513);
    expect(uniqueValues.size).toBeGreaterThanOrEqual(256);
  });

  it('endpoints approximately -1 and +1', () => {
    const curve = createBitcrushCurve(4);
    // First element: x ≈ -1
    expect(curve[0]).toBeCloseTo(-1, 0);
    // Last element: x ≈ +1
    expect(curve[65535]).toBeCloseTo(1, 0);
  });

  it('midpoint approximately 0', () => {
    const curve = createBitcrushCurve(4);
    const mid = curve[32768]; // x = (32768/65536)*2-1 = 0
    expect(mid).toBeCloseTo(0, 1);
  });

  it('1-bit: only produces values near -1, 0, +1', () => {
    const curve = createBitcrushCurve(1);
    const uniqueValues = new Set(curve);
    // 2 steps: round(x*2)/2 → values in {-1, -0.5, 0, 0.5, 1}
    expect(uniqueValues.size).toBeLessThanOrEqual(5);
    for (const v of uniqueValues) {
      expect(Math.abs(v)).toBeLessThanOrEqual(1.01);
    }
  });

  it('output is monotonically non-decreasing', () => {
    const curve = createBitcrushCurve(4);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
    }
  });
});
