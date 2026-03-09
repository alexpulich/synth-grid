import type { Grid } from '../types';
import { NUM_ROWS, NUM_STEPS, NUM_BANKS, VELOCITY_OFF, VELOCITY_LOUD } from '../types';
import type { VelocityLevel } from '../types';

// V1: 1 bit per cell → 512 bits = 64 bytes + 4 metadata = 68 bytes (~91 chars)
// V2: 2 bits per cell → 1024 bits = 128 bytes + 4 metadata = 132 bytes (~176 chars)
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

export function encodeState(
  grids: Grid[],
  tempo: number,
  swing: number,
  activeBank: number,
): string {
  // V2 format: 2 bits per cell
  const bytes = new Uint8Array(132);
  let bitIndex = 0;

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

  // Tempo as uint16 (bytes 128-129)
  const tempoInt = Math.round(tempo);
  bytes[128] = (tempoInt >> 8) & 0xff;
  bytes[129] = tempoInt & 0xff;

  // Swing as uint8 (byte 130)
  bytes[130] = Math.round(swing * 510);

  // Active bank (byte 131)
  bytes[131] = activeBank & 0x03;

  return toBase64Url(bytes);
}

export function decodeState(hash: string): {
  grids: Grid[];
  tempo: number;
  swing: number;
  activeBank: number;
} | null {
  try {
    const bytes = fromBase64Url(hash);

    // V1 format: 68 bytes (1 bit per cell)
    if (bytes.length >= 68 && bytes.length < 132) {
      return decodeV1(bytes);
    }

    // V2 format: 132 bytes (2 bits per cell)
    if (bytes.length >= 132) {
      return decodeV2(bytes);
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
