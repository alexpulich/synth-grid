import { describe, it, expect, afterEach, vi } from 'vitest';
import { MidiLearn } from './midi-learn';
import { eventBus } from '../utils/event-bus';

describe('MidiLearn', () => {
  let learn: MidiLearn;
  const unsubs: (() => void)[] = [];

  afterEach(() => {
    unsubs.forEach(u => u());
    unsubs.length = 0;
  });

  function create(): MidiLearn {
    return new MidiLearn();
  }

  it('initial state: not armed, no pending CC, no mappings', () => {
    learn = create();
    expect(learn.armed).toBe(false);
    expect(learn.pendingCC).toBeNull();
    expect(learn.currentMappings).toEqual([]);
  });

  it('armLearn sets armed state and emits event', () => {
    learn = create();
    const fn = vi.fn();
    unsubs.push(eventBus.on('midi:learn-toggle', fn));
    learn.armLearn();
    expect(learn.armed).toBe(true);
    expect(learn.pendingCC).toBeNull();
    expect(fn).toHaveBeenCalledWith(true);
  });

  it('handleCC in armed mode captures pending CC', () => {
    learn = create();
    const fn = vi.fn();
    unsubs.push(eventBus.on('midi:cc-captured', fn));
    learn.armLearn();
    learn.handleCC(74, 100, 0);
    expect(learn.pendingCC).toEqual({ cc: 74, channel: 0 });
    expect(fn).toHaveBeenCalledWith({ cc: 74, channel: 0 });
  });

  it('handleCC in armed mode with pending CC does not overwrite', () => {
    learn = create();
    learn.armLearn();
    learn.handleCC(74, 100, 0);
    learn.handleCC(75, 50, 1);
    // Second CC should be routed through mappings, not captured
    expect(learn.pendingCC).toEqual({ cc: 74, channel: 0 });
  });

  it('assignTarget creates mapping and disarms', () => {
    learn = create();
    const toggleFn = vi.fn();
    const mappingFn = vi.fn();
    unsubs.push(eventBus.on('midi:learn-toggle', toggleFn));
    unsubs.push(eventBus.on('midi:mapping-changed', mappingFn));

    learn.armLearn();
    learn.handleCC(74, 100, 0);
    learn.assignTarget('filter');

    expect(learn.armed).toBe(false);
    expect(learn.pendingCC).toBeNull();
    expect(learn.currentMappings).toEqual([{ cc: 74, channel: 0, target: 'filter' }]);
    expect(toggleFn).toHaveBeenLastCalledWith(false);
    expect(mappingFn).toHaveBeenCalledWith([{ cc: 74, channel: 0, target: 'filter' }]);
  });

  it('assignTarget without pending CC is a no-op', () => {
    learn = create();
    learn.assignTarget('filter');
    expect(learn.currentMappings).toEqual([]);
  });

  it('handleCC with mapping calls onApply with normalized value', () => {
    learn = create();
    const applyFn = vi.fn();
    learn.onApply(applyFn);

    // Create a mapping
    learn.armLearn();
    learn.handleCC(74, 100, 0);
    learn.assignTarget('filter');

    // Now send CC through normal path
    learn.handleCC(74, 127, 0);
    expect(applyFn).toHaveBeenCalledWith('filter', 1); // 127/127 = 1

    learn.handleCC(74, 0, 0);
    expect(applyFn).toHaveBeenCalledWith('filter', 0); // 0/127 = 0
  });

  it('duplicate CC replaces previous mapping', () => {
    learn = create();

    // Map CC 74 ch0 -> filter
    learn.armLearn();
    learn.handleCC(74, 100, 0);
    learn.assignTarget('filter');

    // Map CC 74 ch0 -> volume (same CC, different target)
    learn.armLearn();
    learn.handleCC(74, 100, 0);
    learn.assignTarget('volume');

    expect(learn.currentMappings).toHaveLength(1);
    expect(learn.currentMappings[0].target).toBe('volume');
  });

  it('duplicate target replaces previous mapping', () => {
    learn = create();

    // Map CC 74 -> filter
    learn.armLearn();
    learn.handleCC(74, 100, 0);
    learn.assignTarget('filter');

    // Map CC 75 -> filter (same target, different CC)
    learn.armLearn();
    learn.handleCC(75, 100, 0);
    learn.assignTarget('filter');

    expect(learn.currentMappings).toHaveLength(1);
    expect(learn.currentMappings[0].cc).toBe(75);
  });

  it('removeMapping removes by target and emits event', () => {
    learn = create();
    const fn = vi.fn();
    unsubs.push(eventBus.on('midi:mapping-changed', fn));

    learn.armLearn();
    learn.handleCC(74, 100, 0);
    learn.assignTarget('filter');

    learn.removeMapping('filter');
    expect(learn.currentMappings).toEqual([]);
    expect(fn).toHaveBeenLastCalledWith([]);
  });

  it('loadMappings restores state', () => {
    learn = create();
    const mappings = [
      { cc: 74, channel: 0, target: 'filter' },
      { cc: 1, channel: 0, target: 'volume' },
    ];
    learn.loadMappings(mappings);
    expect(learn.currentMappings).toEqual(mappings);
    // Verify it's a copy
    mappings.push({ cc: 10, channel: 1, target: 'pan' });
    expect(learn.currentMappings).toHaveLength(2);
  });

  it('cancelLearn clears armed and pending state', () => {
    learn = create();
    const fn = vi.fn();
    unsubs.push(eventBus.on('midi:learn-toggle', fn));

    learn.armLearn();
    learn.handleCC(74, 100, 0);
    learn.cancelLearn();

    expect(learn.armed).toBe(false);
    expect(learn.pendingCC).toBeNull();
    expect(fn).toHaveBeenLastCalledWith(false);
  });
});
