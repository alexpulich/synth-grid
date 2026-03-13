import { describe, it, expect, afterEach, vi } from 'vitest';
import { MuteState } from './mute-state';
import { eventBus } from '../utils/event-bus';

describe('MuteState', () => {
  let muteState: MuteState;
  const unsubs: (() => void)[] = [];

  afterEach(() => {
    unsubs.forEach(u => u());
    unsubs.length = 0;
  });

  function create(): MuteState {
    return new MuteState();
  }

  it('initial: all rows audible, soloRow null', () => {
    muteState = create();
    for (let i = 0; i < 8; i++) {
      expect(muteState.isRowAudible(i)).toBe(true);
    }
    expect(muteState.getState().soloRow).toBeNull();
  });

  it('toggleMute flips muted state', () => {
    muteState = create();
    muteState.toggleMute(2);
    expect(muteState.isRowAudible(2)).toBe(false);
  });

  it('toggleMute twice restores audibility', () => {
    muteState = create();
    muteState.toggleMute(3);
    muteState.toggleMute(3);
    expect(muteState.isRowAudible(3)).toBe(true);
  });

  it('toggleSolo makes only solo row audible', () => {
    muteState = create();
    muteState.toggleSolo(1);
    expect(muteState.isRowAudible(1)).toBe(true);
    expect(muteState.isRowAudible(0)).toBe(false);
    expect(muteState.isRowAudible(2)).toBe(false);
  });

  it('toggleSolo same row disengages solo', () => {
    muteState = create();
    muteState.toggleSolo(1);
    muteState.toggleSolo(1);
    expect(muteState.getState().soloRow).toBeNull();
    expect(muteState.isRowAudible(0)).toBe(true);
    expect(muteState.isRowAudible(1)).toBe(true);
  });

  it('toggleMute on solo row clears solo', () => {
    muteState = create();
    muteState.toggleSolo(2);
    muteState.toggleMute(2);
    expect(muteState.getState().soloRow).toBeNull();
    // Row 2 is now muted
    expect(muteState.isRowAudible(2)).toBe(false);
    // Other rows are audible again
    expect(muteState.isRowAudible(0)).toBe(true);
  });

  it('loadState restores and emits mute:changed', () => {
    muteState = create();
    const fn = vi.fn();
    unsubs.push(eventBus.on('mute:changed', fn));
    muteState.loadState({ muted: [true, false, false, false, false, false, false, false], soloRow: null });
    expect(muteState.isRowAudible(0)).toBe(false);
    expect(fn).toHaveBeenCalled();
  });

  it('getState returns copy (no mutation leak)', () => {
    muteState = create();
    const state1 = muteState.getState();
    state1.muted[0] = true;
    expect(muteState.isRowAudible(0)).toBe(true);
  });
});
