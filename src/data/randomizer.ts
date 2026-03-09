import type { Grid } from '../types';
import { NUM_ROWS, NUM_STEPS, VELOCITY_OFF, VELOCITY_LOUD, VELOCITY_MEDIUM } from '../types';
import type { VelocityLevel } from '../types';

// Bjorklund / Euclidean rhythm algorithm
function euclidean(steps: number, pulses: number): boolean[] {
  if (pulses >= steps) return new Array(steps).fill(true);
  if (pulses <= 0) return new Array(steps).fill(false);

  let pattern: number[][] = [];
  let remainder: number[][] = [];

  for (let i = 0; i < steps; i++) {
    if (i < pulses) {
      pattern.push([1]);
    } else {
      remainder.push([0]);
    }
  }

  while (remainder.length > 1) {
    const newPattern: number[][] = [];
    const minLen = Math.min(pattern.length, remainder.length);

    for (let i = 0; i < minLen; i++) {
      newPattern.push([...pattern[i], ...remainder[i]]);
    }

    const leftoverPattern = pattern.slice(minLen);
    const leftoverRemainder = remainder.slice(minLen);

    pattern = newPattern;
    remainder = leftoverPattern.length > 0 ? leftoverPattern : leftoverRemainder;
  }

  if (remainder.length > 0) {
    pattern.push(...remainder);
  }

  return pattern.flat().map((v) => v === 1);
}

// Per-instrument density profiles: [minHits, maxHits]
const DENSITY_PROFILES: [number, number][] = [
  [3, 5],   // Kick
  [2, 4],   // Snare
  [6, 10],  // Hi-Hat
  [1, 3],   // Clap
  [3, 5],   // Bass
  [2, 4],   // Lead
  [1, 2],   // Pad
  [3, 5],   // Perc
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomizeGrid(): Grid {
  const grid: Grid = [];

  for (let row = 0; row < NUM_ROWS; row++) {
    const [minHits, maxHits] = DENSITY_PROFILES[row];
    const hits = randInt(minHits, maxHits);
    const pattern = euclidean(NUM_STEPS, hits);

    // Random rotation for variety
    const rotation = randInt(0, NUM_STEPS - 1);
    const rotated = [...pattern.slice(rotation), ...pattern.slice(0, rotation)];

    // Convert booleans to velocity levels: 70% loud, 30% medium
    const velocityRow: VelocityLevel[] = rotated.map((on) => {
      if (!on) return VELOCITY_OFF as VelocityLevel;
      return (Math.random() < 0.7 ? VELOCITY_LOUD : VELOCITY_MEDIUM) as VelocityLevel;
    });

    grid.push(velocityRow);
  }

  return grid;
}
