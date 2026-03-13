import { describe, it, expect } from 'vitest';
import { BankStateManager, createEmptyGrid, createEmptyProbGrid, createEmptyNoteGrid, createEmptyFilterLockGrid, createEmptyRatchetGrid, createEmptyConditionGrid, createEmptyGateGrid, createEmptySlideGrid, createEmptyAutomationData } from './bank-state';
import { NUM_ROWS, NUM_STEPS, NUM_BANKS, NUM_AUTO_PARAMS, VELOCITY_OFF } from '../types';

describe('BankStateManager', () => {
  function create(): BankStateManager {
    return new BankStateManager();
  }

  it('initializes all banks with correct dimensions', () => {
    const bs = create();
    expect(bs.grids).toHaveLength(NUM_BANKS);
    expect(bs.probabilities).toHaveLength(NUM_BANKS);
    expect(bs.noteGrids).toHaveLength(NUM_BANKS);
    expect(bs.filterLocks).toHaveLength(NUM_BANKS);
    expect(bs.ratchets).toHaveLength(NUM_BANKS);
    expect(bs.conditions).toHaveLength(NUM_BANKS);
    expect(bs.gates).toHaveLength(NUM_BANKS);
    expect(bs.slides).toHaveLength(NUM_BANKS);
    expect(bs.rowSwings).toHaveLength(NUM_BANKS);
    expect(bs.reverbSends).toHaveLength(NUM_BANKS);
    expect(bs.delaySends).toHaveLength(NUM_BANKS);
    expect(bs.automationData).toHaveLength(NUM_BANKS);
    expect(bs.rowLengths).toHaveLength(NUM_BANKS);
    expect(bs.pitchOffsets).toHaveLength(NUM_BANKS);
    expect(bs.rowVolumes).toHaveLength(NUM_BANKS);
    expect(bs.rowPans).toHaveLength(NUM_BANKS);

    // Check inner dimensions for bank 0
    expect(bs.grids[0]).toHaveLength(NUM_ROWS);
    expect(bs.grids[0][0]).toHaveLength(NUM_STEPS);
    expect(bs.automationData[0]).toHaveLength(NUM_AUTO_PARAMS);
    expect(bs.automationData[0][0]).toHaveLength(NUM_ROWS);
    expect(bs.automationData[0][0][0]).toHaveLength(NUM_STEPS);
  });

  it('initializes with correct default values', () => {
    const bs = create();
    expect(bs.grids[0][0][0]).toBe(VELOCITY_OFF);
    expect(bs.probabilities[0][0][0]).toBe(1.0);
    expect(bs.rowVolumes[0][0]).toBe(0.8);
    expect(bs.rowPans[0][0]).toBe(0);
    expect(bs.reverbSends[0][0]).toBe(0.3);
    expect(bs.delaySends[0][0]).toBe(0.25);
    expect(bs.ratchets[0][0][0]).toBe(1);
    expect(bs.conditions[0][0][0]).toBe(0);
    expect(bs.gates[0][0][0]).toBe(1);
    expect(bs.slides[0][0][0]).toBe(false);
    expect(bs.rowLengths[0][0]).toBe(NUM_STEPS);
    expect(bs.pitchOffsets[0][0]).toBe(0);
    expect(Number.isNaN(bs.filterLocks[0][0][0])).toBe(true);
    expect(Number.isNaN(bs.automationData[0][0][0][0])).toBe(true);
  });

  it('captureEntry returns current bank state', () => {
    const bs = create();
    bs.grids[0][0][0] = 3;
    bs.rowVolumes[0][2] = 0.5;
    const entry = bs.captureEntry(0);
    expect(entry.bank).toBe(0);
    expect(entry.grid[0][0]).toBe(3);
    expect(entry.rowVolumes[2]).toBe(0.5);
  });

  it('restoreEntry applies state atomically', () => {
    const bs = create();
    const entry = {
      bank: 1,
      grid: createEmptyGrid(),
      probabilities: createEmptyProbGrid(),
      noteGrid: createEmptyNoteGrid(),
      filterLocks: createEmptyFilterLockGrid(),
      ratchets: createEmptyRatchetGrid(),
      conditions: createEmptyConditionGrid(),
      gates: createEmptyGateGrid(),
      slides: createEmptySlideGrid(),
      rowVolumes: new Array<number>(NUM_ROWS).fill(0.6),
      rowPans: new Array<number>(NUM_ROWS).fill(0.1),
      rowSwings: new Array<number>(NUM_ROWS).fill(0.2),
      reverbSends: new Array<number>(NUM_ROWS).fill(0.5),
      delaySends: new Array<number>(NUM_ROWS).fill(0.4),
      automationData: createEmptyAutomationData(),
      rowLengths: new Array<number>(NUM_ROWS).fill(12),
      pitchOffsets: new Array<number>(NUM_ROWS).fill(3),
    };
    entry.grid[0][0] = 3;

    bs.restoreEntry(entry);

    expect(bs.grids[1][0][0]).toBe(3);
    expect(bs.rowVolumes[1][0]).toBe(0.6);
    expect(bs.rowLengths[1][0]).toBe(12);
    expect(bs.pitchOffsets[1][0]).toBe(3);
  });

  it('bank isolation: modifying bank 0 does not affect bank 1', () => {
    const bs = create();
    bs.grids[0][0][0] = 3;
    bs.rowVolumes[0][0] = 0.1;
    expect(bs.grids[1][0][0]).toBe(VELOCITY_OFF);
    expect(bs.rowVolumes[1][0]).toBe(0.8);
  });

  it('clearBank resets all layers to defaults', () => {
    const bs = create();
    bs.grids[0][0][0] = 3;
    bs.rowVolumes[0][0] = 0.1;
    bs.pitchOffsets[0][0] = 5;
    bs.reverbSends[0][0] = 0.9;

    bs.clearBank(0);

    expect(bs.grids[0][0][0]).toBe(VELOCITY_OFF);
    expect(bs.rowVolumes[0][0]).toBe(0.8);
    expect(bs.pitchOffsets[0][0]).toBe(0);
    expect(bs.reverbSends[0][0]).toBe(0.3);
  });

  it('clearBank does not affect other banks', () => {
    const bs = create();
    bs.grids[1][0][0] = 3;
    bs.clearBank(0);
    expect(bs.grids[1][0][0]).toBe(3);
  });

  it('loadAllBanks restores from partial data', () => {
    const bs = create();
    const grids = Array.from({ length: NUM_BANKS }, () => createEmptyGrid());
    grids[0][0][0] = 2;
    const rowVolumes = [new Array<number>(NUM_ROWS).fill(0.5)];

    bs.loadAllBanks({ grids, rowVolumes });

    expect(bs.grids[0][0][0]).toBe(2);
    expect(bs.rowVolumes[0][0]).toBe(0.5);
    // Bank 1 rowVolumes not provided — reset to default
    expect(bs.rowVolumes[1][0]).toBe(0.8);
    // Probabilities not provided — reset to default
    expect(bs.probabilities[0][0][0]).toBe(1.0);
  });
});

describe('factory functions', () => {
  it('createEmptyGrid has correct shape and values', () => {
    const g = createEmptyGrid();
    expect(g).toHaveLength(NUM_ROWS);
    expect(g[0]).toHaveLength(NUM_STEPS);
    expect(g[0][0]).toBe(VELOCITY_OFF);
  });

  it('factory functions produce independent arrays', () => {
    const a = createEmptyProbGrid();
    const b = createEmptyProbGrid();
    a[0][0] = 0.5;
    expect(b[0][0]).toBe(1.0);
  });
});
