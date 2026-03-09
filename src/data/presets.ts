import type { Grid } from '../types';
import { NUM_ROWS, NUM_STEPS } from '../types';

// Row indices: 0=Kick, 1=Snare, 2=HiHat, 3=Clap, 4=Bass, 5=Lead, 6=Pad, 7=Perc

function makeGrid(patterns: Record<number, number[]>): Grid {
  const grid: Grid = Array.from({ length: NUM_ROWS }, () =>
    new Array<boolean>(NUM_STEPS).fill(false),
  );
  for (const [row, steps] of Object.entries(patterns)) {
    for (const step of steps) {
      grid[Number(row)][step] = true;
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
      0: [0, 4, 8, 12],          // Kick on every beat
      1: [4, 12],                  // Snare on 2 and 4
      2: [0, 2, 4, 6, 8, 10, 12, 14], // Hi-hat 8ths
      4: [0, 4, 8, 12],          // Bass follows kick
    }),
  },
  {
    name: 'Boom Bap',
    grid: makeGrid({
      0: [0, 9],                   // Kick on 1 and off-beat
      1: [4, 12],                  // Snare on 2 and 4
      2: [0, 2, 4, 6, 8, 10, 12, 14], // Hi-hat 8ths
      3: [4],                      // Clap accent
      4: [0, 9, 10],              // Bass syncopated
    }),
  },
  {
    name: 'Breakbeat',
    grid: makeGrid({
      0: [0, 6, 10],              // Syncopated kick
      1: [4, 12, 14],             // Snare with ghost
      2: [0, 2, 4, 6, 8, 10, 12, 14],
      7: [2, 8],                   // Perc fills
      4: [0, 6, 10],              // Bass follows kick
    }),
  },
  {
    name: 'Reggaeton',
    grid: makeGrid({
      0: [0, 4, 8, 12],           // Four on the floor
      1: [3, 7, 11, 15],          // Snare on offbeats (dembow)
      2: [0, 2, 4, 6, 8, 10, 12, 14],
      3: [3, 7, 11, 15],          // Clap doubles snare
      4: [0, 3, 8, 11],           // Bass syncopated
    }),
  },
  {
    name: 'Trap',
    grid: makeGrid({
      0: [0, 7, 8],               // Kick sparse
      1: [4, 12],                  // Snare
      2: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // Hi-hat rolls
      3: [4, 12],                  // Clap on snare
      4: [0, 7, 8],               // 808 bass
    }),
  },
  {
    name: 'House',
    grid: makeGrid({
      0: [0, 4, 8, 12],           // Four on the floor
      3: [4, 12],                  // Clap on 2 and 4
      2: [2, 6, 10, 14],          // Open hat offbeats
      4: [0, 3, 8, 11],           // Bass groove
      6: [0],                      // Pad on 1
      7: [2, 10],                  // Perc accent
    }),
  },
  {
    name: 'DnB',
    grid: makeGrid({
      0: [0, 10],                  // Kick
      1: [4, 14],                  // Snare syncopated
      2: [0, 2, 4, 6, 8, 10, 12, 14],
      4: [0, 3, 6, 10, 13],       // Fast bass
      7: [8],                      // Perc ghost
    }),
  },
  {
    name: 'Minimal',
    grid: makeGrid({
      0: [0, 8],                   // Sparse kick
      2: [4, 12],                  // Hat on beats 2 and 4
      7: [6, 14],                  // Perc offbeats
      5: [0, 6],                   // Lead sparse melody
    }),
  },
];
