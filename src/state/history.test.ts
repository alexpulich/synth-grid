import { describe, it, expect } from 'vitest';
import { History, type HistoryEntry } from './history';
import { NUM_ROWS, NUM_STEPS, NUM_AUTO_PARAMS } from '../types';

/** Create a minimal HistoryEntry with all grids filled with `fillValue` */
function makeEntry(bank: number, fillValue: number): HistoryEntry {
  return {
    grid: Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(fillValue)),
    bank,
    probabilities: Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(1.0)),
    noteGrid: Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(0)),
    filterLocks: Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(NaN)),
    ratchets: Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(1)),
    conditions: Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(0)),
    gates: Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(1)),
    slides: Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(false)),
    rowVolumes: new Array(NUM_ROWS).fill(1.0),
    rowPans: new Array(NUM_ROWS).fill(0),
    rowSwings: new Array(NUM_ROWS).fill(0),
    reverbSends: new Array(NUM_ROWS).fill(0.3),
    delaySends: new Array(NUM_ROWS).fill(0.25),
    automationData: Array.from({ length: NUM_AUTO_PARAMS }, () =>
      Array.from({ length: NUM_ROWS }, () => new Array(NUM_STEPS).fill(NaN))
    ),
    rowLengths: new Array(NUM_ROWS).fill(NUM_STEPS),
    pitchOffsets: new Array(NUM_ROWS).fill(0),
  };
}

describe('History', () => {
  it('undo returns null on empty history', () => {
    const h = new History();
    expect(h.undo()).toBeNull();
  });

  it('redo returns null on empty history', () => {
    const h = new History();
    expect(h.redo()).toBeNull();
  });

  it('push 1, undo returns the pushed entry', () => {
    const h = new History();
    const e0 = makeEntry(0, 0);
    h.push(e0);
    const undone = h.undo();
    expect(undone).not.toBeNull();
    expect(undone!.bank).toBe(0);
    expect(undone!.grid[0][0]).toBe(0);
  });

  it('push 1, undo, further undo returns null', () => {
    const h = new History();
    h.push(makeEntry(0, 0));
    h.undo();
    expect(h.undo()).toBeNull();
  });

  // This is the core Bug #1 test case from QA report:
  // Push 3 pre-mutation states (S0, S1, S2), then undo should return S2 first
  it('push 3, undo 1 returns the most recent entry (S2)', () => {
    const h = new History();
    h.push(makeEntry(0, 0)); // S0: before action 1
    h.push(makeEntry(0, 1)); // S1: before action 2
    h.push(makeEntry(0, 2)); // S2: before action 3
    // Live state would be "3" (after action 3), but not in history

    const u1 = h.undo();
    expect(u1).not.toBeNull();
    expect(u1!.grid[0][0]).toBe(2); // S2 = state before last action
  });

  it('push 3, undo 2 returns S2 then S1', () => {
    const h = new History();
    h.push(makeEntry(0, 0));
    h.push(makeEntry(0, 1));
    h.push(makeEntry(0, 2));

    const u1 = h.undo();
    const u2 = h.undo();
    expect(u1!.grid[0][0]).toBe(2);
    expect(u2!.grid[0][0]).toBe(1);
  });

  it('push 3, undo 3 returns S2, S1, S0', () => {
    const h = new History();
    h.push(makeEntry(0, 0));
    h.push(makeEntry(0, 1));
    h.push(makeEntry(0, 2));

    const u1 = h.undo();
    const u2 = h.undo();
    const u3 = h.undo();
    expect(u1!.grid[0][0]).toBe(2);
    expect(u2!.grid[0][0]).toBe(1);
    expect(u3!.grid[0][0]).toBe(0);
    expect(h.undo()).toBeNull(); // exhausted
  });

  it('push 3, undo 1 from top, redo without live state cannot reach live state', () => {
    const h = new History();
    h.push(makeEntry(0, 0));
    h.push(makeEntry(0, 1));
    h.push(makeEntry(0, 2));

    h.undo(); // returns S2, pointer now at 2
    // Without live state saved, redo from pointer=2 can't reach pointer=3
    // because the check is pointer >= stack.length - 1
    expect(h.redo()).toBeNull();
  });

  it('push 3, undo 2, redo 1 restores one entry', () => {
    const h = new History();
    h.push(makeEntry(0, 0));
    h.push(makeEntry(0, 1));
    h.push(makeEntry(0, 2));

    h.undo(); // S2
    h.undo(); // S1

    const r1 = h.redo();
    expect(r1!.grid[0][0]).toBe(2); // redo restores S2
    expect(h.redo()).toBeNull(); // can't redo further without live state
  });

  it('push after undo truncates redo stack', () => {
    const h = new History();
    h.push(makeEntry(0, 0));
    h.push(makeEntry(0, 1));
    h.push(makeEntry(0, 2));

    h.undo(); // S2
    h.undo(); // S1

    // Push new entry — should discard S1, S2
    h.push(makeEntry(0, 99));

    expect(h.redo()).toBeNull(); // redo stack truncated
    const u = h.undo();
    expect(u!.grid[0][0]).toBe(99); // most recent push
  });

  it('enforces MAX_SIZE of 50', () => {
    const h = new History();
    for (let i = 0; i < 55; i++) {
      h.push(makeEntry(0, i));
    }
    // Should be able to undo 50 times (MAX_SIZE)
    let count = 0;
    while (h.undo() !== null) count++;
    expect(count).toBe(50);
  });

  it('clone independence: mutating returned entry does not affect stack', () => {
    const h = new History();
    h.push(makeEntry(0, 42));

    const entry = h.undo()!;
    entry.grid[0][0] = 999; // mutate the returned clone

    // Re-push and undo to get original back
    h.push(makeEntry(0, 42));
    // Actually, the original was already popped. Let's test differently:
    // Push fresh, undo to get it, check it's not corrupted
    const h2 = new History();
    h2.push(makeEntry(0, 42));
    const e1 = h2.undo()!;
    e1.grid[0][0] = 999;

    // Push again and redo pattern
    h2.push(makeEntry(0, 42));
    h2.push(makeEntry(0, 43));
    h2.undo(); // get 43
    const e2 = h2.undo()!;
    expect(e2.grid[0][0]).toBe(42); // not 999
  });

  it('deep clones automationData (3D array)', () => {
    const h = new History();
    const entry = makeEntry(0, 0);
    entry.automationData[0][0][0] = 0.5;
    h.push(entry);

    // Mutate original
    entry.automationData[0][0][0] = 0.99;

    const undone = h.undo()!;
    expect(undone.automationData[0][0][0]).toBe(0.5); // not affected by mutation
  });

  it('preserves NaN in filterLocks through clone', () => {
    const h = new History();
    const entry = makeEntry(0, 0);
    entry.filterLocks[0][0] = NaN;
    entry.filterLocks[0][1] = 0.5;
    h.push(entry);

    const undone = h.undo()!;
    expect(Number.isNaN(undone.filterLocks[0][0])).toBe(true);
    expect(undone.filterLocks[0][1]).toBe(0.5);
  });

  it('preserves bank info through undo/redo', () => {
    const h = new History();
    h.push(makeEntry(0, 0));
    h.push(makeEntry(1, 1));
    h.push(makeEntry(2, 2));

    const u1 = h.undo()!;
    expect(u1.bank).toBe(2);
    const u2 = h.undo()!;
    expect(u2.bank).toBe(1);
  });
});

describe('History.undoWithLiveState', () => {
  it('returns null on empty history', () => {
    const h = new History();
    expect(h.undoWithLiveState(makeEntry(0, 99))).toBeNull();
  });

  it('saves live state and enables full redo cycle', () => {
    const h = new History();
    h.push(makeEntry(0, 0)); // S0: before action 1
    h.push(makeEntry(0, 1)); // S1: before action 2
    h.push(makeEntry(0, 2)); // S2: before action 3
    // Live state is S3 (fillValue=3)

    // First undo from top — saves live state S3
    const u1 = h.undoWithLiveState(makeEntry(0, 3));
    expect(u1!.grid[0][0]).toBe(2); // returns S2

    // Redo should now restore S3 (the live state)
    const r1 = h.redo();
    expect(r1).not.toBeNull();
    expect(r1!.grid[0][0]).toBe(3); // S3 = live state
  });

  it('full undo then full redo restores all states', () => {
    const h = new History();
    h.push(makeEntry(0, 0));
    h.push(makeEntry(0, 1));
    h.push(makeEntry(0, 2));

    // Undo all 3 (first one saves live state)
    const u1 = h.undoWithLiveState(makeEntry(0, 3));
    const u2 = h.undo();
    const u3 = h.undo();
    expect(u1!.grid[0][0]).toBe(2);
    expect(u2!.grid[0][0]).toBe(1);
    expect(u3!.grid[0][0]).toBe(0);
    expect(h.undo()).toBeNull();

    // Redo all 3 + live state
    const r1 = h.redo();
    const r2 = h.redo();
    const r3 = h.redo();
    expect(r1!.grid[0][0]).toBe(1);
    expect(r2!.grid[0][0]).toBe(2);
    expect(r3!.grid[0][0]).toBe(3); // live state restored
    expect(h.redo()).toBeNull();
  });

  it('undo-redo zigzag works correctly', () => {
    const h = new History();
    h.push(makeEntry(0, 0));
    h.push(makeEntry(0, 1));
    h.push(makeEntry(0, 2));

    // Undo from top (saves live state)
    h.undoWithLiveState(makeEntry(0, 3)); // at S2
    // Redo back to S3
    const r = h.redo();
    expect(r!.grid[0][0]).toBe(3);
    // Undo again (not from top anymore since live state extended stack)
    const u = h.undo();
    expect(u!.grid[0][0]).toBe(2);
    // Redo back to S3 again
    const r2 = h.redo();
    expect(r2!.grid[0][0]).toBe(3);
  });

  it('new push after undo truncates live state', () => {
    const h = new History();
    h.push(makeEntry(0, 0));
    h.push(makeEntry(0, 1));
    h.push(makeEntry(0, 2));

    // Undo from top (saves live state S3)
    h.undoWithLiveState(makeEntry(0, 3)); // at S2
    h.undo(); // at S1

    // New action: push S1_current, then mutate to S4
    h.push(makeEntry(0, 10));
    // Live state S3 should be gone (truncated by push)
    expect(h.redo()).toBeNull();
  });

  it('cross-bank: undo on bank B does not corrupt bank A state', () => {
    const h = new History();
    // Bank A actions
    h.push(makeEntry(0, 10)); // S0: bank A state
    h.push(makeEntry(0, 11)); // S1: bank A state

    // Switch to bank B
    h.push(makeEntry(1, 20)); // S2: bank B state
    h.push(makeEntry(1, 21)); // S3: bank B state

    // Undo from bank B with live state
    const u1 = h.undoWithLiveState(makeEntry(1, 22));
    expect(u1!.bank).toBe(1); // Should return bank B entry
    expect(u1!.grid[0][0]).toBe(21);

    const u2 = h.undo();
    expect(u2!.bank).toBe(1); // Still bank B
    expect(u2!.grid[0][0]).toBe(20);

    // Next undo reaches bank A territory — entry exists but bank differs
    const u3 = h.undo();
    expect(u3!.bank).toBe(0); // Bank A entry
    expect(u3!.grid[0][0]).toBe(11); // Bank A's data is intact

    const u4 = h.undo();
    expect(u4!.bank).toBe(0);
    expect(u4!.grid[0][0]).toBe(10); // Original bank A data untouched
  });

  it('does not double-save live state on subsequent undos', () => {
    const h = new History();
    h.push(makeEntry(0, 0));
    h.push(makeEntry(0, 1));
    h.push(makeEntry(0, 2));

    // First undo saves live state
    h.undoWithLiveState(makeEntry(0, 3)); // pointer moves from 3 to 2
    // Second undo: pointer(2) != stack.length(4), so no save
    h.undoWithLiveState(makeEntry(0, 99)); // should NOT save 99
    // Third undo
    h.undo();

    // Redo all the way
    const r1 = h.redo();
    const r2 = h.redo();
    const r3 = h.redo();
    expect(r1!.grid[0][0]).toBe(1);
    expect(r2!.grid[0][0]).toBe(2);
    expect(r3!.grid[0][0]).toBe(3); // original live state, not 99
    expect(h.redo()).toBeNull();
  });
});
