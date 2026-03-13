import { describe, it, expect } from 'vitest';
import { PRESETS } from './presets';
import { NUM_ROWS, NUM_STEPS } from '../types';

describe('PRESETS', () => {
  it('contains exactly 8 presets', () => {
    expect(PRESETS.length).toBe(8);
  });

  it('all presets have non-empty names', () => {
    for (const preset of PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
    }
  });

  it('all preset names are unique', () => {
    const names = PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all grids have correct dimensions (8 rows × 16 steps)', () => {
    for (const preset of PRESETS) {
      expect(preset.grid.length).toBe(NUM_ROWS);
      for (const row of preset.grid) {
        expect(row.length).toBe(NUM_STEPS);
      }
    }
  });

  it('all grid values are valid velocity levels (0-3)', () => {
    for (const preset of PRESETS) {
      for (const row of preset.grid) {
        for (const cell of row) {
          expect(cell).toBeGreaterThanOrEqual(0);
          expect(cell).toBeLessThanOrEqual(3);
          expect(Number.isInteger(cell)).toBe(true);
        }
      }
    }
  });

  it('every preset has at least one active cell', () => {
    for (const preset of PRESETS) {
      const hasActive = preset.grid.some((row) => row.some((cell) => cell > 0));
      expect(hasActive).toBe(true);
    }
  });

  it('every preset has kick row (row 0) active', () => {
    for (const preset of PRESETS) {
      const kickActive = preset.grid[0].some((cell) => cell > 0);
      expect(kickActive).toBe(true);
    }
  });

  it('inactive cells are exactly 0', () => {
    for (const preset of PRESETS) {
      for (const row of preset.grid) {
        for (const cell of row) {
          if (cell === 0) {
            expect(cell).toBe(0);
          }
        }
      }
    }
  });
});
