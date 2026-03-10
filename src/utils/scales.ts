export interface ScaleDefinition {
  name: string;
  intervals: number[]; // semitones from root
}

export const SCALES: ScaleDefinition[] = [
  { name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'Pentatonic', intervals: [0, 2, 4, 7, 9] },
  { name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
  { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
];

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Convert a scale degree (can be negative / multi-octave) to semitone offset */
export function scaleDegreesToSemitones(scale: ScaleDefinition, degree: number): number {
  const len = scale.intervals.length;
  if (len === 0) return 0;
  const octave = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return octave * 12 + scale.intervals[idx];
}

/** Convert semitone offset to the nearest scale degree */
export function semitonesToScaleDegree(scale: ScaleDefinition, semitones: number): number {
  const len = scale.intervals.length;
  if (len === 0) return 0;
  const octave = Math.floor(semitones / 12);
  const remainder = ((semitones % 12) + 12) % 12;

  // Find closest interval
  let bestIdx = 0;
  let bestDist = 12;
  for (let i = 0; i < len; i++) {
    const dist = Math.abs(scale.intervals[i] - remainder);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return octave * len + bestIdx;
}

/** Get note name for a semitone offset from a root note */
export function semitoneToNoteName(rootNote: number, offset: number): string {
  const idx = (((rootNote + offset) % 12) + 12) % 12;
  return NOTE_NAMES[idx];
}
