import { describe, it, expect } from 'vitest';
import { checkCondition, applySwing, midiNoteClamp } from './scheduler';
import { GATE_LEVELS } from '../types';

describe('checkCondition', () => {
  it('default (0) always returns true', () => {
    expect(checkCondition(0, 0)).toBe(true);
    expect(checkCondition(0, 5)).toBe(true);
  });

  it('1:2 fires on even loop counts', () => {
    expect(checkCondition(1, 0)).toBe(true);
    expect(checkCondition(1, 1)).toBe(false);
    expect(checkCondition(1, 2)).toBe(true);
    expect(checkCondition(1, 3)).toBe(false);
  });

  it('2:2 fires on odd loop counts', () => {
    expect(checkCondition(2, 0)).toBe(false);
    expect(checkCondition(2, 1)).toBe(true);
    expect(checkCondition(2, 2)).toBe(false);
    expect(checkCondition(2, 3)).toBe(true);
  });

  it('1:4 fires every 4th loop (0, 4, 8...)', () => {
    expect(checkCondition(3, 0)).toBe(true);
    expect(checkCondition(3, 1)).toBe(false);
    expect(checkCondition(3, 2)).toBe(false);
    expect(checkCondition(3, 3)).toBe(false);
    expect(checkCondition(3, 4)).toBe(true);
  });

  it('3:4 fires on loop count mod 4 === 2', () => {
    expect(checkCondition(4, 0)).toBe(false);
    expect(checkCondition(4, 2)).toBe(true);
    expect(checkCondition(4, 6)).toBe(true);
  });

  it('!1 (not first) fires on all loops except 0', () => {
    expect(checkCondition(5, 0)).toBe(false);
    expect(checkCondition(5, 1)).toBe(true);
    expect(checkCondition(5, 100)).toBe(true);
  });

  it('unknown condition index returns true (default)', () => {
    expect(checkCondition(99, 0)).toBe(true);
    expect(checkCondition(-1, 0)).toBe(true);
  });

  it('handles high loop counts correctly', () => {
    // 1:2 at loop 1000 (even)
    expect(checkCondition(1, 1000)).toBe(true);
    // 1:4 at loop 100 (divisible by 4)
    expect(checkCondition(3, 100)).toBe(true);
    // 1:4 at loop 101 (not divisible by 4)
    expect(checkCondition(3, 101)).toBe(false);
  });
});

describe('applySwing', () => {
  it('does not modify even steps', () => {
    expect(applySwing(1.0, 0, 0.5, 0.125)).toBe(1.0);
    expect(applySwing(1.0, 2, 0.5, 0.125)).toBe(1.0);
    expect(applySwing(1.0, 4, 0.75, 0.125)).toBe(1.0);
  });

  it('adds swing offset to odd steps', () => {
    // swing 0.5, stepDuration 0.125 → offset = 0.0625
    expect(applySwing(1.0, 1, 0.5, 0.125)).toBeCloseTo(1.0625);
    expect(applySwing(1.0, 3, 0.5, 0.125)).toBeCloseTo(1.0625);
  });

  it('zero swing returns base time for odd steps', () => {
    expect(applySwing(1.0, 1, 0, 0.125)).toBe(1.0);
  });

  it('max swing (0.75) shifts odd step by 75% of step duration', () => {
    // 0.75 * 0.125 = 0.09375
    expect(applySwing(2.0, 1, 0.75, 0.125)).toBeCloseTo(2.09375);
  });
});

describe('midiNoteClamp', () => {
  it('returns sum when in range', () => {
    expect(midiNoteClamp(60, 0)).toBe(60);
    expect(midiNoteClamp(60, 5)).toBe(65);
    expect(midiNoteClamp(60, -12)).toBe(48);
  });

  it('clamps to 0 when result is negative', () => {
    expect(midiNoteClamp(10, -20)).toBe(0);
    expect(midiNoteClamp(0, -5)).toBe(0);
  });

  it('clamps to 127 when result exceeds max', () => {
    expect(midiNoteClamp(120, 10)).toBe(127);
    expect(midiNoteClamp(127, 1)).toBe(127);
  });

  it('rounds fractional values', () => {
    expect(midiNoteClamp(60, 0.4)).toBe(60);
    expect(midiNoteClamp(60, 0.6)).toBe(61);
  });

  it('handles boundary values exactly', () => {
    expect(midiNoteClamp(0, 0)).toBe(0);
    expect(midiNoteClamp(127, 0)).toBe(127);
    expect(midiNoteClamp(0, 127)).toBe(127);
  });
});

describe('scheduling math', () => {
  it('stepDuration = 60 / tempo / 4', () => {
    // At 120 BPM: 60/120/4 = 0.125s
    expect(60 / 120 / 4).toBe(0.125);
    // At 60 BPM: 60/60/4 = 0.25s
    expect(60 / 60 / 4).toBe(0.25);
    // At 240 BPM: 60/240/4 = 0.0625s
    expect(60 / 240 / 4).toBe(0.0625);
  });

  it('gate duration uses GATE_LEVELS multiplier', () => {
    const stepDuration = 0.125; // 120 BPM
    expect(stepDuration * GATE_LEVELS[0]).toBeCloseTo(0.03125); // short (25%)
    expect(stepDuration * GATE_LEVELS[1]).toBeCloseTo(0.0625);  // normal (50%)
    expect(stepDuration * GATE_LEVELS[2]).toBeCloseTo(0.09375); // long (75%)
    expect(stepDuration * GATE_LEVELS[3]).toBeCloseTo(0.125);   // held (100%)
  });

  it('ratchet sub-duration divides step evenly', () => {
    const stepDuration = 0.125;
    for (const ratchetCount of [1, 2, 3, 4]) {
      const subDuration = stepDuration / ratchetCount;
      expect(subDuration * ratchetCount).toBeCloseTo(stepDuration);
    }
  });
});
