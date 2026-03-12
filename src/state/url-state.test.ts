import { describe, it, expect } from 'vitest';
import { encodeState, encodeStateV4, decodeState, type DecodedState } from './url-state';
import { NUM_ROWS, NUM_STEPS, NUM_BANKS, VELOCITY_OFF, VELOCITY_LOUD, VELOCITY_SOFT, VELOCITY_MEDIUM, DEFAULT_SOUND_PARAMS } from '../types';
import type { Grid, ProbabilityGrid } from '../types';

function makeEmptyGrids(): Grid[] {
  return Array.from({ length: NUM_BANKS }, () =>
    Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(VELOCITY_OFF))
  );
}

function makeDefaultProbs(): ProbabilityGrid[] {
  return Array.from({ length: NUM_BANKS }, () =>
    Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(1.0))
  );
}

describe('encodeState / decodeState V2/V3 round-trip', () => {
  it('empty grids round-trip', () => {
    const grids = makeEmptyGrids();
    const hash = encodeState(grids, 120, 0, 0);
    const decoded = decodeState(hash);
    expect(decoded).not.toBeNull();
    expect(decoded!.grids).toEqual(grids);
    expect(decoded!.tempo).toBe(120);
    expect(decoded!.swing).toBeCloseTo(0, 1);
    expect(decoded!.activeBank).toBe(0);
  });

  it('preserves velocity levels', () => {
    const grids = makeEmptyGrids();
    grids[0][0][0] = VELOCITY_SOFT;
    grids[0][0][1] = VELOCITY_MEDIUM;
    grids[0][0][2] = VELOCITY_LOUD;
    const hash = encodeState(grids, 120, 0, 0);
    const decoded = decodeState(hash)!;
    expect(decoded.grids[0][0][0]).toBe(VELOCITY_SOFT);
    expect(decoded.grids[0][0][1]).toBe(VELOCITY_MEDIUM);
    expect(decoded.grids[0][0][2]).toBe(VELOCITY_LOUD);
  });

  it('preserves tempo edge cases', () => {
    const grids = makeEmptyGrids();
    for (const tempo of [30, 120, 300]) {
      const hash = encodeState(grids, tempo, 0, 0);
      const decoded = decodeState(hash)!;
      expect(decoded.tempo).toBe(tempo);
    }
  });

  it('preserves active bank', () => {
    const grids = makeEmptyGrids();
    for (let bank = 0; bank < NUM_BANKS; bank++) {
      const hash = encodeState(grids, 120, 0, bank);
      const decoded = decodeState(hash)!;
      expect(decoded.activeBank).toBe(bank);
    }
  });

  it('V3: preserves probabilities', () => {
    const grids = makeEmptyGrids();
    grids[0][0][0] = VELOCITY_LOUD;
    const probs = makeDefaultProbs();
    probs[0][0][0] = 0.75;
    probs[0][1][3] = 0.5;
    probs[0][2][7] = 0.25;

    const hash = encodeState(grids, 120, 0, 0, probs);
    const decoded = decodeState(hash)!;
    expect(decoded.probabilities).toBeDefined();
    expect(decoded.probabilities![0][0][0]).toBe(0.75);
    expect(decoded.probabilities![0][1][3]).toBe(0.5);
    expect(decoded.probabilities![0][2][7]).toBe(0.25);
  });
});

describe('encodeStateV4 / decodeState V4 round-trip', () => {
  function makeV4State(): DecodedState {
    return {
      grids: makeEmptyGrids(),
      tempo: 140,
      swing: 0.3,
      activeBank: 2,
      probabilities: makeDefaultProbs(),
      noteGrids: Array.from({ length: NUM_BANKS }, () =>
        Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(0))
      ),
      ratchets: Array.from({ length: NUM_BANKS }, () =>
        Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(1))
      ),
      conditions: Array.from({ length: NUM_BANKS }, () =>
        Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(0))
      ),
      gates: Array.from({ length: NUM_BANKS }, () =>
        Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(1))
      ),
      slides: Array.from({ length: NUM_BANKS }, () =>
        Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(false))
      ),
      rowVolumes: Array.from({ length: NUM_BANKS }, () => new Array(NUM_ROWS).fill(1.0)),
      rowPans: Array.from({ length: NUM_BANKS }, () => new Array(NUM_ROWS).fill(0)),
      rowSwings: Array.from({ length: NUM_BANKS }, () => new Array(NUM_ROWS).fill(0)),
      reverbSends: Array.from({ length: NUM_BANKS }, () => new Array(NUM_ROWS).fill(0.3)),
      delaySends: Array.from({ length: NUM_BANKS }, () => new Array(NUM_ROWS).fill(0.25)),
      pitchOffsets: Array.from({ length: NUM_BANKS }, () => new Array(NUM_ROWS).fill(0)),
      scale: 0,
      rootNote: 0,
      humanize: 0,
      sidechainEnabled: false,
      sidechainDepth: 0.5,
      sidechainRelease: 0.1,
      soundParams: Array.from({ length: NUM_ROWS }, () => ({ ...DEFAULT_SOUND_PARAMS })),
    };
  }

  it('round-trips default V4 state', () => {
    const state = makeV4State();
    const hash = encodeStateV4(state);
    const decoded = decodeState(hash);
    expect(decoded).not.toBeNull();
    expect(decoded!.tempo).toBe(140);
    expect(decoded!.activeBank).toBe(2);
  });

  it('preserves non-default velocity in V4', () => {
    const state = makeV4State();
    state.grids[0][0][0] = VELOCITY_LOUD;
    state.grids[1][3][8] = VELOCITY_SOFT;
    const hash = encodeStateV4(state);
    const decoded = decodeState(hash)!;
    expect(decoded.grids[0][0][0]).toBe(VELOCITY_LOUD);
    expect(decoded.grids[1][3][8]).toBe(VELOCITY_SOFT);
  });

  it('preserves ratchet values', () => {
    const state = makeV4State();
    state.ratchets![0][0][0] = 3;
    state.ratchets![0][2][5] = 4;
    const hash = encodeStateV4(state);
    const decoded = decodeState(hash)!;
    expect(decoded.ratchets![0][0][0]).toBe(3);
    expect(decoded.ratchets![0][2][5]).toBe(4);
  });

  it('preserves slide booleans', () => {
    const state = makeV4State();
    state.slides![0][4][0] = true;
    state.slides![0][5][3] = true;
    const hash = encodeStateV4(state);
    const decoded = decodeState(hash)!;
    expect(decoded.slides![0][4][0]).toBe(true);
    expect(decoded.slides![0][5][3]).toBe(true);
    expect(decoded.slides![0][0][0]).toBe(false);
  });

  it('preserves scale and rootNote', () => {
    const state = makeV4State();
    state.scale = 2;     // Minor
    state.rootNote = 9;  // A
    const hash = encodeStateV4(state);
    const decoded = decodeState(hash)!;
    expect(decoded.scale).toBe(2);
    expect(decoded.rootNote).toBe(9);
  });

  it('preserves row volumes approximately (8-bit quantization)', () => {
    const state = makeV4State();
    state.rowVolumes![0][0] = 0.5;
    state.rowVolumes![0][1] = 0.0;
    const hash = encodeStateV4(state);
    const decoded = decodeState(hash)!;
    expect(decoded.rowVolumes![0][0]).toBeCloseTo(0.5, 1);
    expect(decoded.rowVolumes![0][1]).toBeCloseTo(0.0, 1);
  });
});

describe('decodeState error handling', () => {
  it('returns null for empty string', () => {
    expect(decodeState('')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(decodeState('not-valid-base64!!!')).toBeNull();
  });

  it('returns null for too-short data', () => {
    expect(decodeState('AAAA')).toBeNull();
  });
});
