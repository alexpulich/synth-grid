import { describe, it, expect } from 'vitest';
import { SCALES, scaleDegreesToSemitones, semitonesToScaleDegree, semitoneToNoteName } from './scales';

const chromatic = SCALES[0]; // Chromatic
const major = SCALES[1];     // Major: [0,2,4,5,7,9,11]

describe('scaleDegreesToSemitones', () => {
  it('chromatic scale is identity mapping', () => {
    for (let i = 0; i < 12; i++) {
      expect(scaleDegreesToSemitones(chromatic, i)).toBe(i);
    }
  });

  it('major scale degrees map correctly', () => {
    expect(scaleDegreesToSemitones(major, 0)).toBe(0);  // C
    expect(scaleDegreesToSemitones(major, 1)).toBe(2);  // D
    expect(scaleDegreesToSemitones(major, 2)).toBe(4);  // E
    expect(scaleDegreesToSemitones(major, 3)).toBe(5);  // F
    expect(scaleDegreesToSemitones(major, 4)).toBe(7);  // G
    expect(scaleDegreesToSemitones(major, 5)).toBe(9);  // A
    expect(scaleDegreesToSemitones(major, 6)).toBe(11); // B
  });

  it('multi-octave: degree 7 in major = octave 1 root', () => {
    expect(scaleDegreesToSemitones(major, 7)).toBe(12);
  });

  it('multi-octave: degree 9 in major = octave 1 third', () => {
    expect(scaleDegreesToSemitones(major, 9)).toBe(16); // 12 + 4
  });

  it('negative degrees wrap correctly', () => {
    // degree -1 in major: octave -1, index 6 → -12 + 11 = -1
    expect(scaleDegreesToSemitones(major, -1)).toBe(-1);
  });

  it('handles empty intervals', () => {
    expect(scaleDegreesToSemitones({ name: 'Empty', intervals: [] }, 5)).toBe(0);
  });
});

describe('semitonesToScaleDegree', () => {
  it('chromatic round-trip is identity', () => {
    for (let i = 0; i < 24; i++) {
      const semitones = scaleDegreesToSemitones(chromatic, i);
      expect(semitonesToScaleDegree(chromatic, semitones)).toBe(i);
    }
  });

  it('major scale round-trip', () => {
    for (let i = 0; i < 14; i++) {
      const semitones = scaleDegreesToSemitones(major, i);
      expect(semitonesToScaleDegree(major, semitones)).toBe(i);
    }
  });

  it('snaps to nearest scale degree for out-of-scale semitones', () => {
    // semitone 1 (C#) is between C(0) and D(2) in major — closer to C
    const degree = semitonesToScaleDegree(major, 1);
    expect(degree).toBe(0); // snaps to C
  });

  it('handles negative semitones', () => {
    const degree = semitonesToScaleDegree(major, -12);
    expect(degree).toBe(-7); // one octave down = -7 degrees in major
  });
});

describe('semitoneToNoteName', () => {
  it('root C, offset 0 = C', () => {
    expect(semitoneToNoteName(0, 0)).toBe('C');
  });

  it('root C, offset 4 = E', () => {
    expect(semitoneToNoteName(0, 4)).toBe('E');
  });

  it('root A (9), offset 0 = A', () => {
    expect(semitoneToNoteName(9, 0)).toBe('A');
  });

  it('wraps past 12', () => {
    expect(semitoneToNoteName(0, 12)).toBe('C');
    expect(semitoneToNoteName(0, 13)).toBe('C#');
  });

  it('handles negative offset', () => {
    // C - 1 semitone = B
    expect(semitoneToNoteName(0, -1)).toBe('B');
  });
});
