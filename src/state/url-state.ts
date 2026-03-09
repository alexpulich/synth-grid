import type { Grid } from '../types';
import { NUM_ROWS, NUM_STEPS, NUM_BANKS } from '../types';

// Binary pack: 4 banks × 8 rows × 16 steps = 512 bits = 64 bytes
// + tempo (2 bytes, uint16) + swing (1 byte, 0-255 maps to 0-0.5) + activeBank (1 byte)
// Total: 68 bytes → base64url ~91 chars

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
  const bytes = new Uint8Array(68);
  let bitIndex = 0;

  // Pack grid bits
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        if (grids[bank]?.[row]?.[step]) {
          const byteIdx = Math.floor(bitIndex / 8);
          const bitPos = 7 - (bitIndex % 8);
          bytes[byteIdx] |= 1 << bitPos;
        }
        bitIndex++;
      }
    }
  }

  // Tempo as uint16 (bytes 64-65)
  const tempoInt = Math.round(tempo);
  bytes[64] = (tempoInt >> 8) & 0xff;
  bytes[65] = tempoInt & 0xff;

  // Swing as uint8 (byte 66): 0-255 maps to 0.0-0.5
  bytes[66] = Math.round(swing * 510);

  // Active bank (byte 67)
  bytes[67] = activeBank & 0x03;

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
    if (bytes.length < 68) return null;

    const grids: Grid[] = [];
    let bitIndex = 0;

    for (let bank = 0; bank < NUM_BANKS; bank++) {
      const grid: Grid = [];
      for (let row = 0; row < NUM_ROWS; row++) {
        const rowArr: boolean[] = [];
        for (let step = 0; step < NUM_STEPS; step++) {
          const byteIdx = Math.floor(bitIndex / 8);
          const bitPos = 7 - (bitIndex % 8);
          rowArr.push(((bytes[byteIdx] >> bitPos) & 1) === 1);
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
  } catch {
    return null;
  }
}
