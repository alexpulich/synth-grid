import { describe, it, expect, afterEach, vi } from 'vitest';
import { PatternChain, MAX_CHAIN_LENGTH } from './pattern-chain';
import { eventBus } from '../utils/event-bus';

describe('PatternChain', () => {
  let chain: PatternChain;
  const unsubs: (() => void)[] = [];

  afterEach(() => {
    unsubs.forEach(u => u());
    unsubs.length = 0;
  });

  function create(): PatternChain {
    return new PatternChain();
  }

  it('initial: empty chain, songMode false, position 0', () => {
    chain = create();
    expect(chain.length).toBe(0);
    expect(chain.songMode).toBe(false);
    expect(chain.chainPosition).toBe(0);
  });

  it('addToChain appends and emits chain:updated', () => {
    chain = create();
    const fn = vi.fn();
    unsubs.push(eventBus.on('chain:updated', fn));
    chain.addToChain(0);
    chain.addToChain(1);
    expect(chain.getChain()).toEqual([0, 1]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('addToChain at MAX_CHAIN_LENGTH is no-op', () => {
    chain = create();
    for (let i = 0; i < MAX_CHAIN_LENGTH; i++) chain.addToChain(i % 4);
    expect(chain.length).toBe(MAX_CHAIN_LENGTH);
    chain.addToChain(0);
    expect(chain.length).toBe(MAX_CHAIN_LENGTH);
  });

  it('removeFromChain removes and clips position if needed', () => {
    chain = create();
    chain.addToChain(0);
    chain.addToChain(1);
    chain.addToChain(2);
    // Advance to position 2
    chain.advanceChain();
    chain.advanceChain();
    expect(chain.chainPosition).toBe(2);
    // Remove last → position should clip to 0
    chain.removeFromChain(2);
    expect(chain.getChain()).toEqual([0, 1]);
    expect(chain.chainPosition).toBe(0);
  });

  it('removeFromChain with invalid index is no-op', () => {
    chain = create();
    chain.addToChain(0);
    chain.removeFromChain(-1);
    chain.removeFromChain(5);
    expect(chain.length).toBe(1);
  });

  it('clearChain empties and resets position', () => {
    chain = create();
    chain.addToChain(0);
    chain.addToChain(1);
    chain.advanceChain();
    chain.clearChain();
    expect(chain.length).toBe(0);
    expect(chain.chainPosition).toBe(0);
  });

  it('toggleSongMode flips, resets position, and emits', () => {
    chain = create();
    const fn = vi.fn();
    unsubs.push(eventBus.on('chain:mode-changed', fn));
    chain.toggleSongMode();
    expect(chain.songMode).toBe(true);
    expect(chain.chainPosition).toBe(0);
    expect(fn).toHaveBeenCalledWith(true);
    chain.toggleSongMode();
    expect(chain.songMode).toBe(false);
    expect(fn).toHaveBeenCalledWith(false);
  });

  it('advanceChain increments, wraps, and returns bank', () => {
    chain = create();
    chain.addToChain(2);
    chain.addToChain(3);
    chain.addToChain(1);
    // Position starts at 0, advance → 1
    expect(chain.advanceChain()).toBe(3);
    expect(chain.chainPosition).toBe(1);
    // advance → 2
    expect(chain.advanceChain()).toBe(1);
    // advance → wraps to 0
    expect(chain.advanceChain()).toBe(2);
    expect(chain.chainPosition).toBe(0);
  });

  it('advanceChain on empty returns null', () => {
    chain = create();
    expect(chain.advanceChain()).toBeNull();
  });

  it('getCurrentChainBank returns current or null', () => {
    chain = create();
    expect(chain.getCurrentChainBank()).toBeNull();
    chain.addToChain(3);
    expect(chain.getCurrentChainBank()).toBe(3);
  });

  it('moveItem reorders correctly', () => {
    chain = create();
    chain.addToChain(0);
    chain.addToChain(1);
    chain.addToChain(2);
    chain.moveItem(0, 2);
    expect(chain.getChain()).toEqual([1, 2, 0]);
  });

  it('moveItem: position tracks when active item moves', () => {
    chain = create();
    chain.addToChain(0);
    chain.addToChain(1);
    chain.addToChain(2);
    // Position is 0, move item 0 to 2
    chain.moveItem(0, 2);
    expect(chain.chainPosition).toBe(2);
  });

  it('moveItem: position adjusts when item crosses it (forward)', () => {
    chain = create();
    chain.addToChain(0);
    chain.addToChain(1);
    chain.addToChain(2);
    chain.addToChain(3);
    // Advance position to 2
    chain.advanceChain(); // 1
    chain.advanceChain(); // 2
    // Move item 0 to 3 (forward past position 2)
    chain.moveItem(0, 3);
    // fromIndex(0) < position(2), toIndex(3) >= position(2) → position--
    expect(chain.chainPosition).toBe(1);
  });

  it('moveItem: position adjusts when item crosses it (backward)', () => {
    chain = create();
    chain.addToChain(0);
    chain.addToChain(1);
    chain.addToChain(2);
    chain.addToChain(3);
    // Advance position to 1
    chain.advanceChain(); // 1
    // Move item 3 to 0 (backward past position 1)
    chain.moveItem(3, 0);
    // fromIndex(3) > position(1), toIndex(0) <= position(1) → position++
    expect(chain.chainPosition).toBe(2);
  });
});
