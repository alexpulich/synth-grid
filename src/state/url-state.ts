import type { Grid, ProbabilityGrid, NoteGrid, RatchetGrid, ConditionGrid, GateGrid, SlideGrid, SoundParams } from '../types';
import { NUM_ROWS, NUM_STEPS, NUM_BANKS, VELOCITY_OFF, VELOCITY_LOUD, DEFAULT_SOUND_PARAMS } from '../types';
import type { VelocityLevel } from '../types';

// V1: 1 bit per cell → 512 bits = 64 bytes + 4 metadata = 68 bytes (~91 chars)
// V2: 2 bits per cell → 1024 bits = 128 bytes + 4 metadata = 132 bytes (~176 chars)
// V3: V2 + 2 bits per cell probability → 2048 bits = 256 bytes + 4 metadata = 260 bytes (~347 chars)
// V4: V3 base + extension (noteGrids, ratchets, conditions, gates, slides, mixer, scale, sidechain, soundParams) = 1321 bytes (~1762 chars)
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

// V4 bit-level I/O helpers
function writeBits(bytes: Uint8Array, bitIndex: number, value: number, count: number): number {
  for (let i = count - 1; i >= 0; i--) {
    if ((value >> i) & 1) {
      bytes[Math.floor(bitIndex / 8)] |= 1 << (7 - (bitIndex % 8));
    }
    bitIndex++;
  }
  return bitIndex;
}

function readBits(bytes: Uint8Array, bitIndex: number, count: number): [number, number] {
  let value = 0;
  for (let i = 0; i < count; i++) {
    value = (value << 1) | ((bytes[Math.floor(bitIndex / 8)] >> (7 - (bitIndex % 8))) & 1);
    bitIndex++;
  }
  return [value, bitIndex];
}

/** Full decoded state — V1-V3 return base fields only, V4 includes extension fields */
export interface DecodedState {
  grids: Grid[];
  tempo: number;
  swing: number;
  activeBank: number;
  probabilities?: ProbabilityGrid[];
  noteGrids?: NoteGrid[];
  ratchets?: RatchetGrid[];
  conditions?: ConditionGrid[];
  gates?: GateGrid[];
  slides?: SlideGrid[];
  rowVolumes?: number[][];
  rowPans?: number[][];
  rowSwings?: number[][];
  reverbSends?: number[][];
  delaySends?: number[][];
  pitchOffsets?: number[][];
  scale?: number;
  rootNote?: number;
  humanize?: number;
  sidechainEnabled?: boolean;
  sidechainDepth?: number;
  sidechainRelease?: number;
  soundParams?: SoundParams[];
}

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

/** Legacy V2/V3 encoder — kept for backward compatibility */
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

/** V4 full-state encoder — includes all sequencer state */
export function encodeStateV4(state: DecodedState): string {
  const V4_SIZE = 1321;
  const bytes = new Uint8Array(V4_SIZE);
  let bitIndex = 0;

  // === V3 base (260 bytes) ===

  // Grid data: 2 bits per cell
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        const vel = (state.grids[bank]?.[row]?.[step] ?? 0) & 0x03;
        bitIndex = writeBits(bytes, bitIndex, vel, 2);
      }
    }
  }

  // Probability data: 2 bits per cell
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        const pct = Math.round((state.probabilities?.[bank]?.[row]?.[step] ?? 1.0) * 100);
        const bits = PROB_TO_BITS[pct] ?? 0;
        bitIndex = writeBits(bytes, bitIndex, bits, 2);
      }
    }
  }

  // V3 metadata (4 bytes at offset 256)
  const tempoInt = Math.round(state.tempo);
  bytes[256] = (tempoInt >> 8) & 0xff;
  bytes[257] = tempoInt & 0xff;
  bytes[258] = Math.round(state.swing * 510);
  bytes[259] = state.activeBank & 0x03;

  // === V4 extension (starts at byte 260) ===
  bitIndex = 260 * 8;

  // noteGrids: 5 bits per cell (-12..+12 → 0..24), 512 cells = 320 bytes
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        const note = (state.noteGrids?.[bank]?.[row]?.[step] ?? 0) + 12;
        bitIndex = writeBits(bytes, bitIndex, Math.max(0, Math.min(24, note)), 5);
      }
    }
  }

  // ratchets: 2 bits per cell (1-4 → 0-3), 512 cells = 128 bytes
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        const r = ((state.ratchets?.[bank]?.[row]?.[step] ?? 1) - 1) & 0x03;
        bitIndex = writeBits(bytes, bitIndex, r, 2);
      }
    }
  }

  // conditions: 3 bits per cell (0-5), 512 cells = 192 bytes
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        const c = (state.conditions?.[bank]?.[row]?.[step] ?? 0) & 0x07;
        bitIndex = writeBits(bytes, bitIndex, c, 3);
      }
    }
  }

  // gates: 2 bits per cell (0-3), 512 cells = 128 bytes
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        const g = (state.gates?.[bank]?.[row]?.[step] ?? 1) & 0x03;
        bitIndex = writeBits(bytes, bitIndex, g, 2);
      }
    }
  }

  // slides: 1 bit per cell, 512 cells = 64 bytes
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        const s = state.slides?.[bank]?.[row]?.[step] ? 1 : 0;
        bitIndex = writeBits(bytes, bitIndex, s, 1);
      }
    }
  }

  // === Byte-aligned section (starts at byte 1092) ===
  let bytePos = 1092;

  // rowVolumes: 4 banks × 8 rows, 1 byte each (0-255 → 0-1)
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      bytes[bytePos++] = Math.round((state.rowVolumes?.[bank]?.[row] ?? 0.8) * 255);
    }
  }

  // rowPans: 4 banks × 8 rows, 1 byte each (0-255 → -1..+1, midpoint 128 = 0)
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      const pan = state.rowPans?.[bank]?.[row] ?? 0;
      bytes[bytePos++] = Math.round(((pan + 1) / 2) * 255);
    }
  }

  // rowSwings: 4 banks × 8 rows, 1 byte each (0-255 → 0-0.75)
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      bytes[bytePos++] = Math.round(((state.rowSwings?.[bank]?.[row] ?? 0) / 0.75) * 255);
    }
  }

  // reverbSends: 4 banks × 8 rows, 1 byte each (0-255 → 0-1)
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      bytes[bytePos++] = Math.round((state.reverbSends?.[bank]?.[row] ?? 0.3) * 255);
    }
  }

  // delaySends: 4 banks × 8 rows, 1 byte each (0-255 → 0-1)
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      bytes[bytePos++] = Math.round((state.delaySends?.[bank]?.[row] ?? 0.25) * 255);
    }
  }

  // pitchOffsets: 4 banks × 8 rows, 1 byte each (-12..+12 → 0..24)
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      bytes[bytePos++] = (state.pitchOffsets?.[bank]?.[row] ?? 0) + 12;
    }
  }

  // scale: 1 byte (0-6)
  bytes[bytePos++] = state.scale ?? 0;
  // rootNote: 1 byte (0-11)
  bytes[bytePos++] = state.rootNote ?? 0;
  // humanize: 1 byte (0-255 → 0-1)
  bytes[bytePos++] = Math.round((state.humanize ?? 0) * 255);

  // sidechain: 2 bytes
  // Byte 1: enabled (bit 7) + depth (bits 0-6, 0-127 → 0-1)
  const scEnabled = state.sidechainEnabled ? 0x80 : 0;
  const scDepth = Math.round((state.sidechainDepth ?? 0.7) * 127) & 0x7F;
  bytes[bytePos++] = scEnabled | scDepth;
  // Byte 2: release (0-255 → 0.01-0.5)
  bytes[bytePos++] = Math.round(((state.sidechainRelease ?? 0.15) - 0.01) / 0.49 * 255);

  // soundParams: 8 instruments × 4 params (ADTP), 1 byte each = 32 bytes
  for (let row = 0; row < NUM_ROWS; row++) {
    const p = state.soundParams?.[row] ?? DEFAULT_SOUND_PARAMS;
    bytes[bytePos++] = Math.round(p.attack * 255);
    bytes[bytePos++] = Math.round(p.decay * 255);
    bytes[bytePos++] = Math.round(p.tone * 255);
    bytes[bytePos++] = Math.round(p.punch * 255);
  }

  return toBase64Url(bytes);
}

export function decodeState(hash: string): DecodedState | null {
  try {
    const bytes = fromBase64Url(hash);

    // V4 format: > 260 bytes (V3 base + extension data)
    if (bytes.length > 260) {
      return decodeV4(bytes);
    }

    // V3 format: 260 bytes (2 bits per cell + 2 bits probability)
    if (bytes.length >= 260) {
      return decodeV3(bytes);
    }

    // V2 format: 132 bytes (2 bits per cell)
    if (bytes.length >= 132) {
      return decodeV2(bytes);
    }

    // V1 format: 68 bytes (1 bit per cell)
    if (bytes.length >= 68) {
      return decodeV1(bytes);
    }

    return null;
  } catch {
    return null;
  }
}

function decodeV1(bytes: Uint8Array): DecodedState {
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

function decodeV2(bytes: Uint8Array): DecodedState {
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

function decodeV3(bytes: Uint8Array): DecodedState {
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

function decodeV4(bytes: Uint8Array): DecodedState {
  // Decode V3 base first
  const base = decodeV3(bytes);

  // === V4 extension (starts at byte 260) ===
  let bitIndex = 260 * 8;

  // noteGrids: 5 bits per cell → -12..+12
  const noteGrids: NoteGrid[] = [];
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const grid: number[][] = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      const rowArr: number[] = [];
      for (let step = 0; step < NUM_STEPS; step++) {
        let val: number;
        [val, bitIndex] = readBits(bytes, bitIndex, 5);
        rowArr.push(val - 12);
      }
      grid.push(rowArr);
    }
    noteGrids.push(grid);
  }

  // ratchets: 2 bits per cell → 1-4
  const ratchets: RatchetGrid[] = [];
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const grid: number[][] = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      const rowArr: number[] = [];
      for (let step = 0; step < NUM_STEPS; step++) {
        let val: number;
        [val, bitIndex] = readBits(bytes, bitIndex, 2);
        rowArr.push(val + 1);
      }
      grid.push(rowArr);
    }
    ratchets.push(grid);
  }

  // conditions: 3 bits per cell → 0-5
  const conditions: ConditionGrid[] = [];
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const grid: number[][] = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      const rowArr: number[] = [];
      for (let step = 0; step < NUM_STEPS; step++) {
        let val: number;
        [val, bitIndex] = readBits(bytes, bitIndex, 3);
        rowArr.push(val);
      }
      grid.push(rowArr);
    }
    conditions.push(grid);
  }

  // gates: 2 bits per cell → 0-3
  const gates: GateGrid[] = [];
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const grid: number[][] = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      const rowArr: number[] = [];
      for (let step = 0; step < NUM_STEPS; step++) {
        let val: number;
        [val, bitIndex] = readBits(bytes, bitIndex, 2);
        rowArr.push(val);
      }
      grid.push(rowArr);
    }
    gates.push(grid);
  }

  // slides: 1 bit per cell → boolean
  const slides: SlideGrid[] = [];
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const grid: boolean[][] = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      const rowArr: boolean[] = [];
      for (let step = 0; step < NUM_STEPS; step++) {
        let val: number;
        [val, bitIndex] = readBits(bytes, bitIndex, 1);
        rowArr.push(val === 1);
      }
      grid.push(rowArr);
    }
    slides.push(grid);
  }

  // === Byte-aligned section (starts at byte 1092) ===
  let bytePos = 1092;

  // rowVolumes: 4 banks × 8 rows → 0-1
  const rowVolumes: number[][] = [];
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const row: number[] = [];
    for (let r = 0; r < NUM_ROWS; r++) {
      row.push(bytes[bytePos++] / 255);
    }
    rowVolumes.push(row);
  }

  // rowPans: 4 banks × 8 rows → -1..+1
  const rowPans: number[][] = [];
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const row: number[] = [];
    for (let r = 0; r < NUM_ROWS; r++) {
      row.push((bytes[bytePos++] / 255) * 2 - 1);
    }
    rowPans.push(row);
  }

  // rowSwings: 4 banks × 8 rows → 0-0.75
  const rowSwings: number[][] = [];
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const row: number[] = [];
    for (let r = 0; r < NUM_ROWS; r++) {
      row.push((bytes[bytePos++] / 255) * 0.75);
    }
    rowSwings.push(row);
  }

  // reverbSends: 4 banks × 8 rows → 0-1
  const reverbSends: number[][] = [];
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const row: number[] = [];
    for (let r = 0; r < NUM_ROWS; r++) {
      row.push(bytes[bytePos++] / 255);
    }
    reverbSends.push(row);
  }

  // delaySends: 4 banks × 8 rows → 0-1
  const delaySends: number[][] = [];
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const row: number[] = [];
    for (let r = 0; r < NUM_ROWS; r++) {
      row.push(bytes[bytePos++] / 255);
    }
    delaySends.push(row);
  }

  // pitchOffsets: 4 banks × 8 rows → -12..+12
  const pitchOffsets: number[][] = [];
  for (let bank = 0; bank < NUM_BANKS; bank++) {
    const row: number[] = [];
    for (let r = 0; r < NUM_ROWS; r++) {
      row.push(bytes[bytePos++] - 12);
    }
    pitchOffsets.push(row);
  }

  // scale: 1 byte
  const scale = bytes[bytePos++];
  // rootNote: 1 byte
  const rootNote = bytes[bytePos++];
  // humanize: 1 byte → 0-1
  const humanize = bytes[bytePos++] / 255;

  // sidechain: 2 bytes
  const scByte1 = bytes[bytePos++];
  const sidechainEnabled = (scByte1 & 0x80) !== 0;
  const sidechainDepth = (scByte1 & 0x7F) / 127;
  const sidechainRelease = (bytes[bytePos++] / 255) * 0.49 + 0.01;

  // soundParams: 8 instruments × 4 params
  const soundParams: SoundParams[] = [];
  for (let row = 0; row < NUM_ROWS; row++) {
    soundParams.push({
      attack: bytes[bytePos++] / 255,
      decay: bytes[bytePos++] / 255,
      tone: bytes[bytePos++] / 255,
      punch: bytes[bytePos++] / 255,
    });
  }

  return {
    ...base,
    noteGrids,
    ratchets,
    conditions,
    gates,
    slides,
    rowVolumes,
    rowPans,
    rowSwings,
    reverbSends,
    delaySends,
    pitchOffsets,
    scale,
    rootNote,
    humanize,
    sidechainEnabled,
    sidechainDepth,
    sidechainRelease,
    soundParams,
  };
}
