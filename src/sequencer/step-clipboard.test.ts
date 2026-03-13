import { describe, it, expect } from 'vitest';
import { StepClipboard, type StepData } from './step-clipboard';

function makeStepData(overrides?: Partial<StepData>): StepData {
  return {
    velocities: [3, 0, 2, 0, 1, 0, 0, 0],
    probabilities: [1, 1, 0.75, 1, 0.5, 1, 1, 1],
    notes: [0, 0, 0, 0, 5, 3, 7, 0],
    filterLocks: [NaN, NaN, 0.5, NaN, NaN, NaN, NaN, NaN],
    ratchets: [1, 1, 2, 1, 1, 1, 1, 1],
    conditions: [0, 0, 1, 0, 0, 0, 0, 0],
    gates: [1, 1, 2, 1, 0, 1, 1, 1],
    slides: [false, false, false, false, true, false, false, false],
    ...overrides,
  };
}

describe('StepClipboard', () => {
  it('returns null when empty', () => {
    const cb = new StepClipboard();
    expect(cb.paste()).toBeNull();
  });

  it('has correct initial state', () => {
    const cb = new StepClipboard();
    expect(cb.hasData).toBe(false);
    expect(cb.sourceStep).toBe(-1);
  });

  it('sets hasData and sourceStep after copy', () => {
    const cb = new StepClipboard();
    cb.copy(4, makeStepData());
    expect(cb.hasData).toBe(true);
    expect(cb.sourceStep).toBe(4);
  });

  it('paste returns deep clone of copied data', () => {
    const cb = new StepClipboard();
    const original = makeStepData();
    cb.copy(0, original);
    const pasted = cb.paste()!;
    expect(pasted.velocities).toEqual(original.velocities);
    expect(pasted.slides).toEqual(original.slides);
    // Not the same reference
    expect(pasted.velocities).not.toBe(original.velocities);
  });

  it('paste twice returns independent copies', () => {
    const cb = new StepClipboard();
    cb.copy(0, makeStepData());
    const p1 = cb.paste()!;
    const p2 = cb.paste()!;
    p1.velocities[0] = 99;
    expect(p2.velocities[0]).toBe(3);
  });

  it('mutating original does not affect clipboard', () => {
    const cb = new StepClipboard();
    const original = makeStepData();
    cb.copy(0, original);
    original.velocities[0] = 99;
    const pasted = cb.paste()!;
    expect(pasted.velocities[0]).toBe(3);
  });

  it('mutating paste result does not affect clipboard', () => {
    const cb = new StepClipboard();
    cb.copy(0, makeStepData());
    const pasted = cb.paste()!;
    pasted.velocities[0] = 99;
    const pasted2 = cb.paste()!;
    expect(pasted2.velocities[0]).toBe(3);
  });

  it('copies with automation data', () => {
    const cb = new StepClipboard();
    const data = makeStepData({ automationData: [[0.5, 0.3, NaN, NaN, 0.8, NaN, NaN, NaN]] });
    cb.copy(2, data);
    const pasted = cb.paste()!;
    expect(pasted.automationData).toEqual([[0.5, 0.3, NaN, NaN, 0.8, NaN, NaN, NaN]]);
    expect(pasted.automationData![0]).not.toBe(data.automationData![0]);
  });

  it('copies without automation data (undefined)', () => {
    const cb = new StepClipboard();
    cb.copy(0, makeStepData());
    const pasted = cb.paste()!;
    expect(pasted.automationData).toBeUndefined();
  });
});
