import { describe, it, expect } from 'vitest';
import { defaultData, FACTORY_PRESETS } from './factory-presets';
import { NUM_ROWS, NUM_STEPS, NUM_BANKS, VELOCITY_OFF } from '../types';

describe('defaultData', () => {
  it('creates grids with correct dimensions (4 banks × 8 rows × 16 steps)', () => {
    const data = defaultData();
    expect(data.grids.length).toBe(NUM_BANKS);
    for (const grid of data.grids) {
      expect(grid.length).toBe(NUM_ROWS);
      for (const row of grid) {
        expect(row.length).toBe(NUM_STEPS);
      }
    }
  });

  it('initializes all grids to VELOCITY_OFF', () => {
    const data = defaultData();
    for (const grid of data.grids) {
      for (const row of grid) {
        for (const cell of row) {
          expect(cell).toBe(VELOCITY_OFF);
        }
      }
    }
  });

  it('has correct default values for tempo, scale, humanize', () => {
    const data = defaultData();
    expect(data.tempo).toBe(120);
    expect(data.selectedScale).toBe(0);
    expect(data.humanize).toBe(0);
  });

  it('has 8 soundParams entries', () => {
    const data = defaultData();
    expect(data.soundParams.length).toBe(NUM_ROWS);
  });
});

describe('fourOnTheFloor', () => {
  it('has tempo 125 and kick on beats 0/4/8/12', () => {
    const data = FACTORY_PRESETS[0].data();
    expect(data.tempo).toBe(125);
    const kick = data.grids[0][0];
    expect([kick[0], kick[4], kick[8], kick[12]]).toEqual([3, 3, 3, 3]);
    expect(kick[1]).toBe(VELOCITY_OFF);
  });
});

describe('funkyBreaks', () => {
  it('has tempo 100, swing set, and noteGrids populated', () => {
    const data = FACTORY_PRESETS[1].data();
    expect(data.tempo).toBe(100);
    expect(data.rowSwings[0].some((s: number) => s > 0)).toBe(true);
    expect(data.noteGrids[0][4][3]).toBe(5);
    expect(data.noteGrids[0][4][10]).toBe(3);
  });
});

describe('ambientDrift', () => {
  it('has tempo 85, scale 3, and probabilities < 1.0', () => {
    const data = FACTORY_PRESETS[2].data();
    expect(data.tempo).toBe(85);
    expect(data.selectedScale).toBe(3);
    expect(data.probabilities[0][2][2]).toBe(0.5);
    expect(data.probabilities[0][2][14]).toBe(0.75);
  });
});

describe('technoMinimal', () => {
  it('has tempo 132, sidechain enabled, and ratchets > 1', () => {
    const data = FACTORY_PRESETS[3].data();
    expect(data.tempo).toBe(132);
    expect(data.sidechainEnabled).toBe(true);
    expect(data.ratchets[0][7][3]).toBe(2);
    expect(data.ratchets[0][7][11]).toBe(3);
  });
});

describe('cross-preset invariants', () => {
  it('all preset IDs are unique', () => {
    const ids = FACTORY_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all grid values are valid velocity levels (0-3)', () => {
    for (const preset of FACTORY_PRESETS) {
      const data = preset.data();
      for (const grid of data.grids) {
        for (const row of grid) {
          for (const cell of row) {
            expect(cell).toBeGreaterThanOrEqual(0);
            expect(cell).toBeLessThanOrEqual(3);
          }
        }
      }
    }
  });

  it('grid dimensions match constants', () => {
    for (const preset of FACTORY_PRESETS) {
      const data = preset.data();
      expect(data.grids.length).toBe(NUM_BANKS);
      expect(data.grids[0].length).toBe(NUM_ROWS);
      expect(data.grids[0][0].length).toBe(NUM_STEPS);
    }
  });

  it('probabilities are in [0, 1]', () => {
    for (const preset of FACTORY_PRESETS) {
      const data = preset.data();
      for (const bank of data.probabilities) {
        for (const row of bank) {
          for (const p of row) {
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});
