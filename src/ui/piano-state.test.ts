import { describe, it, expect } from 'vitest';
import { computePitchRows, determineCellAction, getDragEffect } from './piano-state';
import { SCALES } from '../utils/scales';
import { VELOCITY_OFF, VELOCITY_LOUD } from '../types';

describe('computePitchRows', () => {
  it('chromatic scale returns 25 values (-12 to +12)', () => {
    const pitches = computePitchRows(SCALES[0]); // Chromatic
    expect(pitches).toHaveLength(25);
    expect(pitches[0]).toBe(12);
    expect(pitches[24]).toBe(-12);
  });

  it('major scale returns fewer rows than chromatic', () => {
    const pitches = computePitchRows(SCALES[1]); // Major
    expect(pitches.length).toBeLessThan(25);
    expect(pitches.length).toBeGreaterThan(10);
  });

  it('pentatonic scale returns fewer rows than major', () => {
    const major = computePitchRows(SCALES[1]);
    const penta = computePitchRows(SCALES[3]); // Pentatonic
    expect(penta.length).toBeLessThan(major.length);
  });

  it('results are sorted descending', () => {
    for (const scale of SCALES) {
      const pitches = computePitchRows(scale);
      for (let i = 1; i < pitches.length; i++) {
        expect(pitches[i]).toBeLessThan(pitches[i - 1]);
      }
    }
  });

  it('root (0) is always included', () => {
    for (const scale of SCALES) {
      const pitches = computePitchRows(scale);
      expect(pitches).toContain(0);
    }
  });
});

describe('determineCellAction', () => {
  it('returns activate for empty cell', () => {
    expect(determineCellAction(VELOCITY_OFF, 0, 5)).toBe('activate');
  });

  it('returns erase when pitch matches', () => {
    expect(determineCellAction(VELOCITY_LOUD, 5, 5)).toBe('erase');
  });

  it('returns move when pitch differs', () => {
    expect(determineCellAction(VELOCITY_LOUD, 3, 5)).toBe('move');
  });
});

describe('getDragEffect', () => {
  it('paint mode + empty cell → activate', () => {
    expect(getDragEffect('paint', VELOCITY_OFF, 0, 5)).toBe('activate');
  });

  it('paint mode + different pitch → move', () => {
    expect(getDragEffect('paint', VELOCITY_LOUD, 3, 5)).toBe('move');
  });

  it('paint mode + same pitch → null (skip)', () => {
    expect(getDragEffect('paint', VELOCITY_LOUD, 5, 5)).toBeNull();
  });

  it('erase mode + matching pitch → erase', () => {
    expect(getDragEffect('erase', VELOCITY_LOUD, 5, 5)).toBe('erase');
  });

  it('erase mode + non-matching pitch → null', () => {
    expect(getDragEffect('erase', VELOCITY_LOUD, 3, 5)).toBeNull();
  });

  it('erase mode + empty cell → null', () => {
    expect(getDragEffect('erase', VELOCITY_OFF, 0, 5)).toBeNull();
  });
});
