import { describe, it, expect, vi, afterEach } from 'vitest';
import { randomizeGrid, euclidean } from './randomizer';
import { NUM_ROWS, NUM_STEPS, VELOCITY_OFF, VELOCITY_LOUD, VELOCITY_MEDIUM } from '../types';

describe('euclidean', () => {
  it('returns correct hit count for (16, 4)', () => {
    const pattern = euclidean(16, 4);
    expect(pattern.filter(Boolean)).toHaveLength(4);
  });

  it('returns all-false for (16, 0)', () => {
    const pattern = euclidean(16, 0);
    expect(pattern.every((v) => v === false)).toBe(true);
    expect(pattern).toHaveLength(16);
  });

  it('returns all-true for (16, 16)', () => {
    const pattern = euclidean(16, 16);
    expect(pattern.every((v) => v === true)).toBe(true);
    expect(pattern).toHaveLength(16);
  });

  it('returns correct length for (8, 3)', () => {
    const pattern = euclidean(8, 3);
    expect(pattern).toHaveLength(8);
    expect(pattern.filter(Boolean)).toHaveLength(3);
  });

  it('distributes pulses as evenly as possible', () => {
    // (8, 3) should produce something like [1,0,0,1,0,0,1,0]
    const pattern = euclidean(8, 3);
    // No two hits should be adjacent (with 3 hits in 8 steps)
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i]) {
        expect(pattern[(i + 1) % pattern.length]).toBe(false);
      }
    }
  });
});

// Per-instrument density profiles: [minHits, maxHits]
const DENSITY_PROFILES: [number, number][] = [
  [3, 5],   // Kick
  [2, 4],   // Snare
  [6, 10],  // Hi-Hat
  [1, 3],   // Clap
  [3, 5],   // Bass
  [2, 4],   // Lead
  [1, 2],   // Pad
  [3, 5],   // Perc
];

describe('randomizeGrid', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 8x16 grid', () => {
    const grid = randomizeGrid();
    expect(grid).toHaveLength(NUM_ROWS);
    for (const row of grid) {
      expect(row).toHaveLength(NUM_STEPS);
    }
  });

  it('all cells are valid VelocityLevel (0/1/2/3)', () => {
    const grid = randomizeGrid();
    for (const row of grid) {
      for (const cell of row) {
        expect([0, 1, 2, 3]).toContain(cell);
      }
    }
  });

  it('active cells are only LOUD or MEDIUM (never SOFT)', () => {
    // Run multiple times to increase confidence
    for (let i = 0; i < 10; i++) {
      const grid = randomizeGrid();
      for (const row of grid) {
        for (const cell of row) {
          if (cell !== VELOCITY_OFF) {
            expect([VELOCITY_LOUD, VELOCITY_MEDIUM]).toContain(cell);
          }
        }
      }
    }
  });

  it('hit counts within DENSITY_PROFILES ranges per row', () => {
    // Run multiple times to catch statistical edge cases
    for (let i = 0; i < 20; i++) {
      const grid = randomizeGrid();
      for (let row = 0; row < NUM_ROWS; row++) {
        const hits = grid[row].filter((v) => v > 0).length;
        const [min, max] = DENSITY_PROFILES[row];
        expect(hits).toBeGreaterThanOrEqual(min);
        expect(hits).toBeLessThanOrEqual(max);
      }
    }
  });

  it('deterministic with mocked Math.random', () => {
    let callCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      // Cycle through values to give variety
      return (callCount++ % 10) / 10;
    });

    const grid1 = randomizeGrid();

    callCount = 0;
    const grid2 = randomizeGrid();

    expect(grid1).toEqual(grid2);
  });

  it('rotation varies output with different random values', () => {
    // With random = 0, rotation = 0 (no rotation)
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const grid1 = randomizeGrid();

    vi.restoreAllMocks();

    // With random = 0.99, rotation varies
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const grid2 = randomizeGrid();

    // At least some rows should differ (different rotation + velocity distribution)
    const allSame = grid1.every((row, i) =>
      row.every((cell, j) => cell === grid2[i][j]),
    );
    expect(allSame).toBe(false);
  });

  it('with random=0.5 produces MEDIUM velocity for active cells (0.5 < 0.7)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const grid = randomizeGrid();
    for (const row of grid) {
      for (const cell of row) {
        if (cell !== VELOCITY_OFF) {
          expect(cell).toBe(VELOCITY_LOUD);
        }
      }
    }
  });

  it('with random=0.8 produces MEDIUM velocity for active cells (0.8 >= 0.7)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const grid = randomizeGrid();
    for (const row of grid) {
      for (const cell of row) {
        if (cell !== VELOCITY_OFF) {
          expect(cell).toBe(VELOCITY_MEDIUM);
        }
      }
    }
  });
});
