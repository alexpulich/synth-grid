import { describe, it, expect, vi } from 'vitest';
import { captureSnapshot, loadSnapshot } from './pattern-snapshot';
import { NUM_ROWS } from '../types';

function makeSequencer() {
  const grids = [Array.from({ length: NUM_ROWS }, () => new Array(16).fill(0))];
  const probs = [Array.from({ length: NUM_ROWS }, () => new Array(16).fill(100))];
  const pitchOffsets = [new Array(NUM_ROWS).fill(0)];
  const noteGrids = [Array.from({ length: NUM_ROWS }, () => new Array(16).fill(0))];
  const rowVolumes = [new Array(NUM_ROWS).fill(80)];
  const rowPans = [new Array(NUM_ROWS).fill(0)];
  const filterLocks = [Array.from({ length: NUM_ROWS }, () => [NaN, 5, NaN])];
  const ratchets = [Array.from({ length: NUM_ROWS }, () => new Array(16).fill(1))];
  const conditions = [Array.from({ length: NUM_ROWS }, () => new Array(16).fill(0))];
  const gates = [Array.from({ length: NUM_ROWS }, () => new Array(16).fill(1))];
  const slides = [Array.from({ length: NUM_ROWS }, () => new Array(16).fill(false))];
  const rowSwings = [new Array(NUM_ROWS).fill(0)];
  const reverbSends = [new Array(NUM_ROWS).fill(0)];
  const delaySends = [new Array(NUM_ROWS).fill(0)];
  const automationData = [[
    Array.from({ length: NUM_ROWS }, () => [NaN, 0.5, NaN]),
    Array.from({ length: NUM_ROWS }, () => [NaN, NaN, NaN]),
    Array.from({ length: NUM_ROWS }, () => [NaN, NaN, NaN]),
    Array.from({ length: NUM_ROWS }, () => [NaN, NaN, NaN]),
  ]];
  const rowLengths = [new Array(NUM_ROWS).fill(16)];
  const soundParams = Array.from({ length: NUM_ROWS }, () => ({ attack: 0, decay: 0.2, sustain: 0.5, release: 0.1 }));

  return {
    getAllGrids: () => grids,
    getAllProbabilities: () => probs,
    getAllPitchOffsets: () => pitchOffsets,
    getAllNoteGrids: () => noteGrids,
    getAllRowVolumes: () => rowVolumes,
    getAllRowPans: () => rowPans,
    getAllFilterLocks: () => filterLocks,
    getAllRatchets: () => ratchets,
    getAllConditions: () => conditions,
    getAllGates: () => gates,
    getAllSlides: () => slides,
    getAllRowSwings: () => rowSwings,
    getAllReverbSends: () => reverbSends,
    getAllDelaySends: () => delaySends,
    getAllAutomation: () => automationData,
    getAllRowLengths: () => rowLengths,
    getAllSoundParams: () => soundParams,
    getSoundParams: (row: number) => soundParams[row],
    tempo: 120,
    selectedScale: 0,
    rootNote: 0,
    humanize: 0,
    sidechainEnabled: false,
    sidechainDepth: 0.5,
    sidechainRelease: 0.2,
    loadFullState: vi.fn(),
    setScale: vi.fn(),
    setSidechain: vi.fn(),
    loadSoundParams: vi.fn(),
  } as never;
}

function makeAudioEngine() {
  return {
    saturation: { drive: 1, tone: 0.5, setDrive: vi.fn(), setTone: vi.fn() },
    eq: { low: 0, mid: 0, high: 0, setLow: vi.fn(), setMid: vi.fn(), setHigh: vi.fn() },
    delay: { setTimeFromDivision: vi.fn() },
    soundParams: Array.from({ length: NUM_ROWS }, () => ({})),
  } as never;
}

describe('captureSnapshot', () => {
  it('converts NaN in filterLocks to null', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = captureSnapshot(seq, ae, () => 0);
    expect(snap.filterLocks[0][0][0]).toBeNull();
    expect(snap.filterLocks[0][0][1]).toBe(5);
  });

  it('converts NaN in automationData to null', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = captureSnapshot(seq, ae, () => 0);
    expect(snap.automationData![0][0][0][0]).toBeNull();
    expect(snap.automationData![0][0][0][1]).toBe(0.5);
  });

  it('preserves numeric filterLock values', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = captureSnapshot(seq, ae, () => 0);
    expect(snap.filterLocks[0][0][1]).toBe(5);
  });

  it('includes all expected top-level fields', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = captureSnapshot(seq, ae, () => 2);
    expect(snap.tempo).toBe(120);
    expect(snap.selectedScale).toBe(0);
    expect(snap.rootNote).toBe(0);
    expect(snap.humanize).toBe(0);
    expect(snap.sidechainEnabled).toBe(false);
    expect(snap.saturationDrive).toBe(1);
    expect(snap.eqLow).toBe(0);
    expect(snap.delayDivision).toBe(2);
  });

  it('produces deep copies (source mutation does not affect snapshot)', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = captureSnapshot(seq, ae, () => 0);
    // Mutate source grid
    (seq as { getAllGrids: () => number[][][] }).getAllGrids()[0][0][0] = 3;
    expect(snap.grids[0][0][0]).toBe(0);
  });

  it('invokes getDelayDivisionIndex callback', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const cb = vi.fn().mockReturnValue(5);
    const snap = captureSnapshot(seq, ae, cb);
    expect(cb).toHaveBeenCalledOnce();
    expect(snap.delayDivision).toBe(5);
  });
});

describe('loadSnapshot', () => {
  function makeSnap() {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    return captureSnapshot(seq, ae, () => 1);
  }

  it('converts null in filterLocks to NaN for loadFullState', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = makeSnap();
    snap.filterLocks[0][0][0] = null;
    loadSnapshot(snap, seq, ae);
    const call = (seq as { loadFullState: ReturnType<typeof vi.fn> }).loadFullState.mock.calls[0];
    // filterLocks is argument index 9
    expect(isNaN(call[9][0][0][0])).toBe(true);
  });

  it('converts null in automationData to NaN for loadFullState', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = makeSnap();
    snap.automationData![0][0][0][0] = null;
    loadSnapshot(snap, seq, ae);
    const call = (seq as { loadFullState: ReturnType<typeof vi.fn> }).loadFullState.mock.calls[0];
    // automationData is argument index 17
    expect(isNaN(call[17][0][0][0][0])).toBe(true);
  });

  it('calls loadFullState with correct argument order', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = makeSnap();
    loadSnapshot(snap, seq, ae);
    const fn = (seq as { loadFullState: ReturnType<typeof vi.fn> }).loadFullState;
    expect(fn).toHaveBeenCalledOnce();
    // First arg = grids, second = tempo
    const call = fn.mock.calls[0];
    expect(call[1]).toBe(snap.tempo);
  });

  it('calls setScale with correct params', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = makeSnap();
    snap.selectedScale = 3;
    snap.rootNote = 5;
    loadSnapshot(snap, seq, ae);
    const fn = (seq as { setScale: ReturnType<typeof vi.fn> }).setScale;
    expect(fn).toHaveBeenCalledWith(3, 5);
  });

  it('calls setSidechain with correct params', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = makeSnap();
    snap.sidechainEnabled = true;
    snap.sidechainDepth = 0.8;
    snap.sidechainRelease = 0.4;
    loadSnapshot(snap, seq, ae);
    const fn = (seq as { setSidechain: ReturnType<typeof vi.fn> }).setSidechain;
    expect(fn).toHaveBeenCalledWith(true, 0.8, 0.4);
  });

  it('assigns humanize value', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = makeSnap();
    snap.humanize = 0.75;
    loadSnapshot(snap, seq, ae);
    expect((seq as { humanize: number }).humanize).toBe(0.75);
  });

  it('calls saturation and EQ setters', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = makeSnap();
    snap.saturationDrive = 2;
    snap.saturationTone = 0.7;
    snap.eqLow = 3;
    snap.eqMid = -2;
    snap.eqHigh = 1;
    loadSnapshot(snap, seq, ae);
    const a = ae as { saturation: { setDrive: ReturnType<typeof vi.fn>; setTone: ReturnType<typeof vi.fn> }; eq: { setLow: ReturnType<typeof vi.fn>; setMid: ReturnType<typeof vi.fn>; setHigh: ReturnType<typeof vi.fn> } };
    expect(a.saturation.setDrive).toHaveBeenCalledWith(2);
    expect(a.saturation.setTone).toHaveBeenCalledWith(0.7);
    expect(a.eq.setLow).toHaveBeenCalledWith(3);
    expect(a.eq.setMid).toHaveBeenCalledWith(-2);
    expect(a.eq.setHigh).toHaveBeenCalledWith(1);
  });

  it('calls effectsPanel when valid delayDivision', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = makeSnap();
    snap.delayDivision = 1;
    const panel = {
      setDelayDivisionIndex: vi.fn(),
      refresh: vi.fn(),
    };
    loadSnapshot(snap, seq, ae, panel);
    expect(panel.setDelayDivisionIndex).toHaveBeenCalledWith(1);
    expect(panel.refresh).toHaveBeenCalled();
  });

  it('does not call effectsPanel when delayDivision is undefined', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = makeSnap();
    delete (snap as unknown as Record<string, unknown>).delayDivision;
    const panel = {
      setDelayDivisionIndex: vi.fn(),
      refresh: vi.fn(),
    };
    loadSnapshot(snap, seq, ae, panel);
    expect(panel.setDelayDivisionIndex).not.toHaveBeenCalled();
  });

  it('does not call effectsPanel when delayDivision out of range', () => {
    const seq = makeSequencer();
    const ae = makeAudioEngine();
    const snap = makeSnap();
    snap.delayDivision = 999;
    const panel = {
      setDelayDivisionIndex: vi.fn(),
      refresh: vi.fn(),
    };
    loadSnapshot(snap, seq, ae, panel);
    expect(panel.setDelayDivisionIndex).not.toHaveBeenCalled();
  });
});
