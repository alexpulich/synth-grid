import { describe, it, expect, beforeEach } from 'vitest';
import { Sequencer } from './sequencer';
import { NUM_ROWS, NUM_STEPS, VELOCITY_OFF, VELOCITY_LOUD, VELOCITY_SOFT, VELOCITY_MEDIUM } from '../types';
import { eventBus } from '../utils/event-bus';

describe('Sequencer', () => {
  let sequencer: Sequencer;

  beforeEach(() => {
    sequencer = new Sequencer();
  });

  describe('toggleCell', () => {
    it('toggles off cell to VELOCITY_LOUD', () => {
      sequencer.toggleCell(0, 0);
      expect(sequencer.getCurrentGrid()[0][0]).toBe(VELOCITY_LOUD);
    });

    it('toggles active cell to VELOCITY_OFF', () => {
      sequencer.toggleCell(0, 0); // on
      sequencer.toggleCell(0, 0); // off
      expect(sequencer.getCurrentGrid()[0][0]).toBe(VELOCITY_OFF);
    });

    it('resets ratchet to 1 when toggling off', () => {
      sequencer.toggleCell(0, 0); // on
      sequencer.setRatchet(0, 0, 3);
      expect(sequencer.getRatchet(0, 0)).toBe(3);
      sequencer.toggleCell(0, 0); // off
      expect(sequencer.getRatchet(0, 0)).toBe(1);
    });
  });

  describe('cycleVelocity', () => {
    it('cycles through 0 -> 1 -> 2 -> 3 -> 0', () => {
      expect(sequencer.getCurrentGrid()[0][0]).toBe(VELOCITY_OFF);
      sequencer.cycleVelocity(0, 0);
      expect(sequencer.getCurrentGrid()[0][0]).toBe(VELOCITY_SOFT);
      sequencer.cycleVelocity(0, 0);
      expect(sequencer.getCurrentGrid()[0][0]).toBe(VELOCITY_MEDIUM);
      sequencer.cycleVelocity(0, 0);
      expect(sequencer.getCurrentGrid()[0][0]).toBe(VELOCITY_LOUD);
      sequencer.cycleVelocity(0, 0);
      expect(sequencer.getCurrentGrid()[0][0]).toBe(VELOCITY_OFF);
    });

    it('emits cell:toggled with correct velocity', () => {
      let emitted: { row: number; step: number; velocity: number } | null = null;
      const unsub = eventBus.on('cell:toggled', (data) => { emitted = data; });
      sequencer.cycleVelocity(2, 5);
      expect(emitted).toEqual({ row: 2, step: 5, velocity: VELOCITY_SOFT });
      unsub();
    });

    it('emits cell:toggled on each cycle', () => {
      const velocities: number[] = [];
      const unsub = eventBus.on('cell:toggled', (data) => { velocities.push(data.velocity); });
      sequencer.cycleVelocity(0, 0);
      sequencer.cycleVelocity(0, 0);
      sequencer.cycleVelocity(0, 0);
      expect(velocities).toEqual([VELOCITY_SOFT, VELOCITY_MEDIUM, VELOCITY_LOUD]);
      unsub();
    });
  });

  describe('setCell', () => {
    it('sets cell to specific velocity directly', () => {
      sequencer.setCell(0, 0, VELOCITY_MEDIUM);
      expect(sequencer.getCurrentGrid()[0][0]).toBe(VELOCITY_MEDIUM);
    });

    it('is no-op when setting same value (no event emitted)', () => {
      sequencer.setCell(0, 0, VELOCITY_LOUD);
      let emitCount = 0;
      const unsub = eventBus.on('cell:toggled', () => { emitCount++; });
      sequencer.setCell(0, 0, VELOCITY_LOUD); // same value
      expect(emitCount).toBe(0);
      unsub();
    });

    it('resets ratchet to 1 when setting to VELOCITY_OFF', () => {
      sequencer.setCell(0, 0, VELOCITY_LOUD);
      sequencer.setRatchet(0, 0, 4);
      expect(sequencer.getRatchet(0, 0)).toBe(4);
      sequencer.setCell(0, 0, VELOCITY_OFF);
      expect(sequencer.getRatchet(0, 0)).toBe(1);
    });
  });

  describe('clearCurrentBank', () => {
    it('resets all grid cells to VELOCITY_OFF', () => {
      sequencer.toggleCell(0, 0);
      sequencer.toggleCell(3, 7);
      sequencer.toggleCell(7, 15);
      sequencer.clearCurrentBank();
      const grid = sequencer.getCurrentGrid();
      for (let row = 0; row < NUM_ROWS; row++) {
        for (let step = 0; step < NUM_STEPS; step++) {
          expect(grid[row][step]).toBe(VELOCITY_OFF);
        }
      }
    });

    it('resets probabilities to 1.0', () => {
      sequencer.setProbability(0, 0, 0.5);
      sequencer.clearCurrentBank();
      const probs = sequencer.getCurrentProbabilities();
      for (let row = 0; row < NUM_ROWS; row++) {
        for (let step = 0; step < NUM_STEPS; step++) {
          expect(probs[row][step]).toBe(1.0);
        }
      }
    });

    it('resets row volumes to 0.8, pans to 0, reverb sends to 0.3, delay sends to 0.25, row lengths to NUM_STEPS', () => {
      sequencer.setRowVolume(0, 0.5);
      sequencer.setRowPan(0, -0.8);
      sequencer.setReverbSend(0, 0.9);
      sequencer.setDelaySend(0, 0.9);
      sequencer.setRowLength(0, 4);
      sequencer.clearCurrentBank();
      for (let row = 0; row < NUM_ROWS; row++) {
        expect(sequencer.getRowVolume(row)).toBe(0.8);
        expect(sequencer.getRowPan(row)).toBe(0);
        expect(sequencer.getReverbSend(row)).toBe(0.3);
        expect(sequencer.getDelaySend(row)).toBe(0.25);
        expect(sequencer.getRowLength(row)).toBe(NUM_STEPS);
      }
    });

    it('emits grid:cleared', () => {
      let cleared = false;
      const unsub = eventBus.on('grid:cleared', () => { cleared = true; });
      sequencer.clearCurrentBank();
      expect(cleared).toBe(true);
      unsub();
    });
  });

  describe('setBank / queueBank / processQueue', () => {
    it('setBank changes activeBank immediately', () => {
      sequencer.setBank(2);
      expect(sequencer.activeBank).toBe(2);
    });

    it('queueBank when not playing calls setBank directly', () => {
      sequencer.isPlaying = false;
      sequencer.queueBank(1);
      expect(sequencer.activeBank).toBe(1);
      expect(sequencer.queuedBank).toBeNull();
    });

    it('queueBank when playing sets queuedBank', () => {
      sequencer.isPlaying = true;
      sequencer.queueBank(2);
      expect(sequencer.queuedBank).toBe(2);
      expect(sequencer.activeBank).toBe(0); // unchanged
    });

    it('queueBank same bank toggles it off (sets to null)', () => {
      sequencer.isPlaying = true;
      sequencer.queueBank(2);
      expect(sequencer.queuedBank).toBe(2);
      sequencer.queueBank(2);
      expect(sequencer.queuedBank).toBeNull();
    });

    it('processQueue switches bank and clears queue', () => {
      sequencer.isPlaying = true;
      sequencer.queueBank(3);
      sequencer.processQueue();
      expect(sequencer.activeBank).toBe(3);
      expect(sequencer.queuedBank).toBeNull();
    });
  });

  describe('copyStep / pasteStep', () => {
    it('copies all data layers from a step and pastes to target', () => {
      sequencer.toggleCell(0, 0); // VELOCITY_LOUD at row 0, step 0
      sequencer.setProbability(0, 0, 0.5);
      sequencer.setRatchet(0, 0, 3);
      sequencer.copyStep(0);
      sequencer.pasteStep(5);
      const grid = sequencer.getCurrentGrid();
      expect(grid[0][5]).toBe(VELOCITY_LOUD);
      expect(sequencer.getCurrentProbabilities()[0][5]).toBe(0.5);
      expect(sequencer.getRatchet(0, 5)).toBe(3);
    });

    it('paste applies copied data to target step preserving other steps', () => {
      sequencer.toggleCell(0, 0);
      sequencer.toggleCell(1, 3);
      sequencer.copyStep(0);
      sequencer.pasteStep(5);
      // Step 3 row 1 should still be active
      expect(sequencer.getCurrentGrid()[1][3]).toBe(VELOCITY_LOUD);
      // Step 5 row 0 should now be active from paste
      expect(sequencer.getCurrentGrid()[0][5]).toBe(VELOCITY_LOUD);
    });

    it('paste with empty clipboard is no-op (no crash)', () => {
      // No copyStep called, clipboard is empty
      expect(() => sequencer.pasteStep(5)).not.toThrow();
      // Grid should still be all zeros
      expect(sequencer.getCurrentGrid()[0][5]).toBe(VELOCITY_OFF);
    });
  });

  describe('rotateLeft / rotateRight', () => {
    it('rotateLeft shifts grid left by 1 (first element wraps to end)', () => {
      sequencer.toggleCell(0, 0); // LOUD at step 0
      sequencer.rotateLeft();
      const grid = sequencer.getCurrentGrid();
      expect(grid[0][0]).toBe(VELOCITY_OFF);
      expect(grid[0][NUM_STEPS - 1]).toBe(VELOCITY_LOUD);
    });

    it('rotateRight shifts grid right by 1 (last element wraps to start)', () => {
      sequencer.toggleCell(0, NUM_STEPS - 1); // LOUD at last step
      sequencer.rotateRight();
      const grid = sequencer.getCurrentGrid();
      expect(grid[0][NUM_STEPS - 1]).toBe(VELOCITY_OFF);
      expect(grid[0][0]).toBe(VELOCITY_LOUD);
    });

    it('rotation wraps correctly for mid-pattern values', () => {
      sequencer.toggleCell(0, 3); // LOUD at step 3
      sequencer.rotateRight();
      expect(sequencer.getCurrentGrid()[0][4]).toBe(VELOCITY_LOUD);
      expect(sequencer.getCurrentGrid()[0][3]).toBe(VELOCITY_OFF);
    });

    it('respects per-row lengths: only rotates within row length', () => {
      sequencer.setRowLength(0, 4);
      // Set up a pattern in first 4 steps: [LOUD, OFF, OFF, OFF, ...]
      sequencer.toggleCell(0, 0);
      sequencer.rotateRight();
      const grid = sequencer.getCurrentGrid();
      // Within length 4: last (step 3) wraps to step 0
      // Step 0 was LOUD, should now be at step 1
      expect(grid[0][0]).toBe(VELOCITY_OFF); // step 3 (was OFF) wrapped to 0
      expect(grid[0][1]).toBe(VELOCITY_LOUD); // step 0 (was LOUD) shifted to 1
      expect(grid[0][2]).toBe(VELOCITY_OFF);
      expect(grid[0][3]).toBe(VELOCITY_OFF);
    });
  });

  describe('applyEuclidean', () => {
    it('applies correct pattern for known inputs', () => {
      // euclidean(16, 4) with no rotation should produce evenly spaced hits
      sequencer.applyEuclidean(0, 4, 0);
      const grid = sequencer.getCurrentGrid();
      const pattern = Array.from({ length: NUM_STEPS }, (_, i) => grid[0][i]);
      const hitCount = pattern.filter(v => v === VELOCITY_LOUD).length;
      expect(hitCount).toBe(4);
    });

    it('clears steps beyond row length to VELOCITY_OFF', () => {
      sequencer.setRowLength(0, 8);
      sequencer.applyEuclidean(0, 3, 0);
      const grid = sequencer.getCurrentGrid();
      // Steps 8-15 should all be off
      for (let step = 8; step < NUM_STEPS; step++) {
        expect(grid[0][step]).toBe(VELOCITY_OFF);
      }
      // 3 hits within 8 steps
      let hits = 0;
      for (let step = 0; step < 8; step++) {
        if (grid[0][step] === VELOCITY_LOUD) hits++;
      }
      expect(hits).toBe(3);
    });

    it('emits grid:cleared', () => {
      let cleared = false;
      const unsub = eventBus.on('grid:cleared', () => { cleared = true; });
      sequencer.applyEuclidean(0, 4, 0);
      expect(cleared).toBe(true);
      unsub();
    });
  });

  describe('copyBank / pasteBank', () => {
    it('deep copies grid, probabilities, noteGrid', () => {
      sequencer.toggleCell(0, 0);
      sequencer.setProbability(1, 2, 0.75);
      sequencer.copyBank();
      // Modify original after copy
      sequencer.toggleCell(0, 0); // toggle off
      sequencer.pasteBank();
      // Should restore copied state
      expect(sequencer.getCurrentGrid()[0][0]).toBe(VELOCITY_LOUD);
      expect(sequencer.getCurrentProbabilities()[1][2]).toBe(0.75);
    });

    it('paste restores copied data to current bank', () => {
      sequencer.toggleCell(0, 0);
      sequencer.copyBank();
      sequencer.setBank(1); // switch to bank 1
      sequencer.pasteBank();
      expect(sequencer.getCurrentGrid()[0][0]).toBe(VELOCITY_LOUD);
    });

    it('paste with null clipboard is no-op', () => {
      expect(() => sequencer.pasteBank()).not.toThrow();
      expect(sequencer.getCurrentGrid()[0][0]).toBe(VELOCITY_OFF);
    });
  });

  describe('setPitchOffset', () => {
    it('clamps to -12..12 range', () => {
      sequencer.setPitchOffset(0, 20);
      expect(sequencer.getPitchOffset(0)).toBe(12);
      sequencer.setPitchOffset(0, -20);
      expect(sequencer.getPitchOffset(0)).toBe(-12);
    });

    it('emits pitch:changed with correct row and offset', () => {
      let emitted: { row: number; offset: number } | null = null;
      const unsub = eventBus.on('pitch:changed', (data) => { emitted = data; });
      sequencer.setPitchOffset(3, 5);
      expect(emitted).toEqual({ row: 3, offset: 5 });
      unsub();
    });
  });

  describe('setRowVolume / setRowPan', () => {
    it('volume clamps to 0..1', () => {
      sequencer.setRowVolume(0, 1.5);
      expect(sequencer.getRowVolume(0)).toBe(1);
      sequencer.setRowVolume(0, -0.5);
      expect(sequencer.getRowVolume(0)).toBe(0);
    });

    it('pan clamps to -1..1', () => {
      sequencer.setRowPan(0, 2);
      expect(sequencer.getRowPan(0)).toBe(1);
      sequencer.setRowPan(0, -2);
      expect(sequencer.getRowPan(0)).toBe(-1);
    });

    it('setting volume emits volume:changed', () => {
      let emitted: { row: number; volume: number } | null = null;
      const unsub = eventBus.on('volume:changed', (data) => { emitted = data; });
      sequencer.setRowVolume(2, 0.6);
      expect(emitted).toEqual({ row: 2, volume: 0.6 });
      unsub();
    });

    it('setting pan emits pan:changed', () => {
      let emitted: { row: number; pan: number } | null = null;
      const unsub = eventBus.on('pan:changed', (data) => { emitted = data; });
      sequencer.setRowPan(1, -0.5);
      expect(emitted).toEqual({ row: 1, pan: -0.5 });
      unsub();
    });
  });

  describe('randomizeRow', () => {
    it('density 0 sets all steps to VELOCITY_OFF', () => {
      // First fill the row
      for (let step = 0; step < NUM_STEPS; step++) {
        sequencer.setCell(0, step, VELOCITY_LOUD);
      }
      sequencer.randomizeRow(0, 0);
      const grid = sequencer.getCurrentGrid();
      for (let step = 0; step < NUM_STEPS; step++) {
        expect(grid[0][step]).toBe(VELOCITY_OFF);
      }
    });

    it('density 1 sets all steps to VELOCITY_LOUD', () => {
      sequencer.randomizeRow(0, 1);
      const grid = sequencer.getCurrentGrid();
      for (let step = 0; step < NUM_STEPS; step++) {
        expect(grid[0][step]).toBe(VELOCITY_LOUD);
      }
    });

    it('respects row length (beyond-length steps are VELOCITY_OFF)', () => {
      sequencer.setRowLength(0, 4);
      sequencer.randomizeRow(0, 1);
      const grid = sequencer.getCurrentGrid();
      // Steps beyond row length should be off
      for (let step = 4; step < NUM_STEPS; step++) {
        expect(grid[0][step]).toBe(VELOCITY_OFF);
      }
    });

    it('pushes history', () => {
      sequencer.randomizeRow(0, 0.5);
      // Verify by checking undo restores previous state
      sequencer.undo();
      const gridRestored = sequencer.getCurrentGrid()[0];
      for (let step = 0; step < NUM_STEPS; step++) {
        expect(gridRestored[step]).toBe(VELOCITY_OFF);
      }
    });
  });
});
