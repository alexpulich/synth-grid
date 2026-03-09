import type { Grid, ProbabilityGrid } from '../types';
import { NUM_ROWS, NUM_STEPS, NUM_BANKS, VELOCITY_OFF, VELOCITY_LOUD } from '../types';
import type { VelocityLevel } from '../types';

// V1: 1 bit per cell → 512 bits = 64 bytes + 4 metadata = 68 bytes (~91 chars)
// V2: 2 bits per cell → 1024 bits = 128 bytes + 4 metadata = 132 bytes (~176 chars)
// V3: V2 + 2 bits per cell probability → 2048 bits = 256 bytes + 4 metadata = 260 bytes (~347 chars)
// Detect format by decoded byte length

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Probability encoding: 2 bits → 0=100%, 1=75%, 2=50%, 3=25%
const PROB_TO_BITS: Record<number, number> = { 100: 0, 75: 1, 50: 2, 25: 3 };
const BITS_TO_PROB = [1.0, 0.75, 0.5, 0.25];

function hasNonDefaultProbabilities(probabilities: ProbabilityGrid[]): boolean {
  for (const bank of probabilities) {
    for (const row of bank) {
      for (const p of row) {
        if (p < 1.0) return true;
      }
    }
  }
  return false;
}

export function encodeState(
  grids: Grid[],
  tempo: number,
  swing: number,
  activeBank: number,
  probabilities?: ProbabilityGrid[],
): string {
  const useV3 = probabilities && hasNonDefaultProbabilities(probabilities);
  const totalBytes = useV3 ? 260 : 132;
  const bytes = new Uint8Array(totalBytes);
  let bitIndex = 0;

  // Grid data: 2 bits per cell (same as V2)
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        const vel = (grids[bank]?.[row]?.[step] ?? 0) & 0x03;
        const byteIdx = Math.floor(bitIndex / 8);
        const bitPos = 6 - (bitIndex % 8);
        bytes[byteIdx] |= vel << bitPos;
        bitIndex += 2;
      }
    }
  }

  // Probability data (V3 only): 2 bits per cell after grid data
  if (useV3 && probabilities) {
    for (let bank = 0; bank < NUM_BANKS; bank++) {
      for (let row = 0; row < NUM_ROWS; row++) {
        for (let step = 0; step < NUM_STEPS; step++) {
          const pct = Math.round((probabilities[bank]?.[row]?.[step] ?? 1.0) * 100);
          const bits = PROB_TO_BITS[pct] ?? 0;
          const byteIdx = Math.floor(bitIndex / 8);
          const bitPos = 6 - (bitIndex % 8);
          bytes[byteIdx] |= bits << bitPos;
          bitIndex += 2;
        }
      }
    }
  }

  // Metadata at end
  const metaOffset = useV3 ? 256 : 128;
  const tempoInt = Math.round(tempo);
  bytes[metaOffset] = (tempoInt >> 8) & 0xff;
  bytes[metaOffset + 1] = tempoInt & 0xff;
  bytes[metaOffset + 2] = Math.round(swing * 510);
  bytes[metaOffset + 3] = activeBank & 0x03;

  return toBase64Url(bytes);
}

export function decodeState(hash: string): {
  grids: Grid[];
  tempo: number;
  swing: number;
  activeBank: number;
  probabilities?: ProbabilityGrid[];
} | null {
  try {
    const bytes = fromBase64Url(hash);

    // V1 format: 68 bytes (1 bit per cell)
    if (bytes.length >= 68 && bytes.length < 132) {
      return decodeV1(bytes);
    }

    // V2 format: 132 bytes (2 bits per cell)
    if (bytes.length >= 132 && bytes.length < 260) {
      return decodeV2(bytes);
    }

    // V3 format: 260 bytes (2 bits per cell + 2 bits probability)
    if (bytes.length >= 260) {
      return decodeV3(bytes);
    }

    return null;
  } catch {
    return null;
  }
}

function decodeV1(bytes: Uint8Array): {
  grids: Grid[];
  tempo: number;
  swing: number;
  activeBank: number;
} {
  const grids: Grid[] = [];
  let bitIndex = 0;

  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const grid: Grid = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      const rowArr: number[] = [];
      for (let step = 0; step < NUM_STEPS; step++) {
        const byteIdx = Math.floor(bitIndex / 8);
        const bitPos = 7 - (bitIndex % 8);
        const on = ((bytes[byteIdx] >> bitPos) & 1) === 1;
        rowArr.push(on ? VELOCITY_LOUD : VELOCITY_OFF);
        bitIndex++;
      }
      grid.push(rowArr);
    }
    grids.push(grid);
  }

  const tempo = (bytes[64] << 8) | bytes[65];
  const swing = bytes[66] / 510;
  const activeBank = bytes[67] & 0x03;

  return { grids, tempo, swing, activeBank };
}

function decodeV2(bytes: Uint8Array): {
  grids: Grid[];
  tempo: number;
  swing: number;
  activeBank: number;
} {
  const grids: Grid[] = [];
  let bitIndex = 0;

  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const grid: Grid = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      const rowArr: number[] = [];
      for (let step = 0; step < NUM_STEPS; step++) {
        const byteIdx = Math.floor(bitIndex / 8);
        const bitPos = 6 - (bitIndex % 8);
        const vel = ((bytes[byteIdx] >> bitPos) & 0x03) as VelocityLevel;
        rowArr.push(vel);
        bitIndex += 2;
      }
      grid.push(rowArr);
    }
    grids.push(grid);
  }

  const tempo = (bytes[128] << 8) | bytes[129];
  const swing = bytes[130] / 510;
  const activeBank = bytes[131] & 0x03;

  return { grids, tempo, swing, activeBank };
}

function decodeV3(bytes: Uint8Array): {
  grids: Grid[];
  tempo: number;
  swing: number;
  activeBank: number;
  probabilities: ProbabilityGrid[];
} {
  const grids: Grid[] = [];
  let bitIndex = 0;

  // Grid data
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const grid: Grid = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      const rowArr: number[] = [];
      for (let step = 0; step < NUM_STEPS; step++) {
        const byteIdx = Math.floor(bitIndex / 8);
        const bitPos = 6 - (bitIndex % 8);
        const vel = ((bytes[byteIdx] >> bitPos) & 0x03) as VelocityLevel;
        rowArr.push(vel);
        bitIndex += 2;
      }
      grid.push(rowArr);
    }
    grids.push(grid);
  }

  // Probability data
  const probabilities: ProbabilityGrid[] = [];
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const probGrid: number[][] = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      const rowArr: number[] = [];
      for (let step = 0; step < NUM_STEPS; step++) {
        const byteIdx = Math.floor(bitIndex / 8);
        const bitPos = 6 - (bitIndex % 8);
        const bits = (bytes[byteIdx] >> bitPos) & 0x03;
        rowArr.push(BITS_TO_PROB[bits]);
        bitIndex += 2;
      }
      probGrid.push(rowArr);
    }
    probabilities.push(probGrid);
  }

  const tempo = (bytes[256] << 8) | bytes[257];
  const swing = bytes[258] / 510;
  const activeBank = bytes[259] & 0x03;

  return { grids, tempo, swing, activeBank, probabilities };
}
