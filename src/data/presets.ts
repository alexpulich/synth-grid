import type { Grid } from '../types';
import { NUM_ROWS, NUM_STEPS, VELOCITY_OFF, VELOCITY_LOUD } from '../types';

// Row indices: 0=Kick, 1=Snare, 2=HiHat, 3=Clap, 4=Bass, 5=Lead, 6=Pad, 7=Perc

function makeGrid(patterns: Record<number, number[]>): Grid {
  const grid: Grid = Array.from({ length: NUM_ROWS }, () =>
    new Array<number>(NUM_STEPS).fill(VELOCITY_OFF),
  );
  for (const [row, steps] of Object.entries(patterns)) {
    for (const step of steps) {
      grid[Number(row)][step] = VELOCITY_LOUD;
    }
  }
  return grid;
}

export interface Preset {
  name: string;
  grid: Grid;
}

export const PRESETS: Preset[] = [
  {
    name: 'Four on the Floor',
    grid: makeGrid({
      0: [0, 4, 8, 12],
      1: [4, 12],
      2: [0, 2, 4, 6, 8, 10, 12, 14],
      4: [0, 4, 8, 12],
    }),
  },
  {
    name: 'Boom Bap',
    grid: makeGrid({
      0: [0, 9],
      1: [4, 12],
      2: [0, 2, 4, 6, 8, 10, 12, 14],
      3: [4],
      4: [0, 9, 10],
    }),
  },
  {
    name: 'Breakbeat',
    grid: makeGrid({
      0: [0, 6, 10],
      1: [4, 12, 14],
      2: [0, 2, 4, 6, 8, 10, 12, 14],
      7: [2, 8],
      4: [0, 6, 10],
    }),
  },
  {
    name: 'Reggaeton',
    grid: makeGrid({
      0: [0, 4, 8, 12],
      1: [3, 7, 11, 15],
      2: [0, 2, 4, 6, 8, 10, 12, 14],
      3: [3, 7, 11, 15],
      4: [0, 3, 8, 11],
    }),
  },
  {
    name: 'Trap',
    grid: makeGrid({
      0: [0, 7, 8],
      1: [4, 12],
      2: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      3: [4, 12],
      4: [0, 7, 8],
    }),
  },
  {
    name: 'House',
    grid: makeGrid({
      0: [0, 4, 8, 12],
      3: [4, 12],
      2: [2, 6, 10, 14],
      4: [0, 3, 8, 11],
      6: [0],
      7: [2, 10],
    }),
  },
  {
    name: 'DnB',
    grid: makeGrid({
      0: [0, 10],
      1: [4, 14],
      2: [0, 2, 4, 6, 8, 10, 12, 14],
      4: [0, 3, 6, 10, 13],
      7: [8],
    }),
  },
  {
    name: 'Minimal',
    grid: makeGrid({
      0: [0, 8],
      2: [4, 12],
      7: [6, 14],
      5: [0, 6],
    }),
  },
];
