import type { PatternData } from '../state/pattern-library-storage';
import { NUM_ROWS, NUM_STEPS, NUM_BANKS, VELOCITY_OFF, VELOCITY_LOUD, VELOCITY_MEDIUM, VELOCITY_SOFT, DEFAULT_SOUND_PARAMS } from '../types';
import type { VelocityLevel } from '../types';

function emptyGrid(): number[][] {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(VELOCITY_OFF));
}

function emptyProbs(): number[][] {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(1.0));
}

function emptyNotes(): number[][] {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(0));
}

function emptyFilterLocks(): (number | null)[][] {
  return Array.from({ length: NUM_ROWS }, () => new Array<number | null>(NUM_STEPS).fill(null));
}

function emptyRatchets(): number[][] {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(1));
}

function emptyConditions(): number[][] {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(0));
}

function emptyGates(): number[][] {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(1));
}

function emptySlides(): boolean[][] {
  return Array.from({ length: NUM_ROWS }, () => new Array<boolean>(NUM_STEPS).fill(false));
}

export function defaultData(): PatternData {
  return {
    grids: Array.from({ length: NUM_BANKS }, emptyGrid),
    probabilities: Array.from({ length: NUM_BANKS }, emptyProbs),
    pitchOffsets: Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0)),
    noteGrids: Array.from({ length: NUM_BANKS }, emptyNotes),
    rowVolumes: Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0.8)),
    rowPans: Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0)),
    filterLocks: Array.from({ length: NUM_BANKS }, emptyFilterLocks),
    ratchets: Array.from({ length: NUM_BANKS }, emptyRatchets),
    conditions: Array.from({ length: NUM_BANKS }, emptyConditions),
    gates: Array.from({ length: NUM_BANKS }, emptyGates),
    slides: Array.from({ length: NUM_BANKS }, emptySlides),
    rowSwings: Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0)),
    reverbSends: Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0.3)),
    delaySends: Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0.25)),
    tempo: 120,
    selectedScale: 0,
    rootNote: 0,
    soundParams: Array.from({ length: NUM_ROWS }, () => ({ ...DEFAULT_SOUND_PARAMS })),
    humanize: 0,
    sidechainEnabled: false,
    sidechainDepth: 0.7,
    sidechainRelease: 0.15,
    saturationDrive: 0,
    saturationTone: 0.7,
    eqLow: 0.5,
    eqMid: 0.5,
    eqHigh: 0.5,
    delayDivision: 3,
  };
}

function setSteps(grid: number[][], row: number, steps: number[], vel: VelocityLevel = VELOCITY_LOUD): void {
  for (const s of steps) grid[row][s] = vel;
}

function fourOnTheFloor(): PatternData {
  const data = defaultData();
  data.tempo = 125;
  const g = data.grids[0];
  // Kick: four on the floor
  setSteps(g, 0, [0, 4, 8, 12]);
  // Snare: 2 and 4
  setSteps(g, 1, [4, 12]);
  // Hi-hat: every step
  setSteps(g, 2, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], VELOCITY_MEDIUM);
  // Open hi-hat accents
  setSteps(g, 2, [2, 6, 10, 14], VELOCITY_LOUD);
  // Clap with snare
  setSteps(g, 3, [4, 12], VELOCITY_MEDIUM);
  return data;
}

function funkyBreaks(): PatternData {
  const data = defaultData();
  data.tempo = 100;
  const g = data.grids[0];
  // Kick: syncopated
  setSteps(g, 0, [0, 3, 6, 10]);
  // Snare: backbeat + ghost
  setSteps(g, 1, [4, 12]);
  setSteps(g, 1, [7, 15], VELOCITY_SOFT);
  // Hi-hat: 16ths
  setSteps(g, 2, [0, 2, 4, 6, 8, 10, 12, 14], VELOCITY_MEDIUM);
  setSteps(g, 2, [1, 3, 5, 7, 9, 11, 13, 15], VELOCITY_SOFT);
  // Clap: syncopated
  setSteps(g, 3, [4, 11], VELOCITY_MEDIUM);
  // Bass: simple line
  setSteps(g, 4, [0, 3, 8, 10]);
  data.noteGrids[0][4][3] = 5;
  data.noteGrids[0][4][10] = 3;
  data.rowSwings[0] = new Array<number>(NUM_ROWS).fill(0.15);
  return data;
}

function ambientDrift(): PatternData {
  const data = defaultData();
  data.tempo = 85;
  data.selectedScale = 3; // Dorian
  data.humanize = 0.4;
  const g = data.grids[0];
  // Sparse kick
  setSteps(g, 0, [0, 10], VELOCITY_MEDIUM);
  // Soft snare
  setSteps(g, 1, [8], VELOCITY_SOFT);
  // Hi-hat ghost
  setSteps(g, 2, [2, 6, 14], VELOCITY_SOFT);
  // Pad: sustained
  setSteps(g, 6, [0, 8]);
  data.noteGrids[0][6][0] = 0;
  data.noteGrids[0][6][8] = 3;
  // Lead: sparse melody
  setSteps(g, 5, [4, 12], VELOCITY_MEDIUM);
  data.noteGrids[0][5][4] = 5;
  data.noteGrids[0][5][12] = 7;
  // Reverb heavy
  data.reverbSends[0] = new Array<number>(NUM_ROWS).fill(0.6);
  data.delaySends[0] = new Array<number>(NUM_ROWS).fill(0.4);
  // Probabilities for variation
  data.probabilities[0][2][2] = 0.5;
  data.probabilities[0][2][14] = 0.75;
  return data;
}

function technoMinimal(): PatternData {
  const data = defaultData();
  data.tempo = 132;
  data.sidechainEnabled = true;
  data.saturationDrive = 0.3;
  const g = data.grids[0];
  // Kick: 4/4
  setSteps(g, 0, [0, 4, 8, 12]);
  // Hi-hat: offbeats
  setSteps(g, 2, [2, 6, 10, 14], VELOCITY_MEDIUM);
  // Clap: 2 and 4
  setSteps(g, 3, [4, 12], VELOCITY_MEDIUM);
  // Perc: syncopated
  setSteps(g, 7, [3, 7, 11], VELOCITY_SOFT);
  // Bass: driving
  setSteps(g, 4, [0, 4, 8, 12]);
  setSteps(g, 4, [3, 7], VELOCITY_MEDIUM);
  // Ratchets on perc
  data.ratchets[0][7][3] = 2;
  data.ratchets[0][7][11] = 3;
  return data;
}

export const FACTORY_PRESETS = [
  { id: 'factory-four-on-the-floor', name: 'Four on the Floor', data: fourOnTheFloor },
  { id: 'factory-funky-breaks', name: 'Funky Breaks', data: funkyBreaks },
  { id: 'factory-ambient-drift', name: 'Ambient Drift', data: ambientDrift },
  { id: 'factory-techno-minimal', name: 'Techno Minimal', data: technoMinimal },
];
