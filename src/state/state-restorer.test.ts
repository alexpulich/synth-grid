import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NUM_ROWS } from '../types';

// Mock url-state
vi.mock('./url-state', () => ({
  decodeState: vi.fn(),
}));

// Mock local-storage
vi.mock('./local-storage', () => ({
  AutoSave: { load: vi.fn() },
}));

import { restoreAppState } from './state-restorer';
import { decodeState } from './url-state';
import { AutoSave } from './local-storage';

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    sequencer: {
      loadFullState: vi.fn(),
      setScale: vi.fn(),
      setSidechain: vi.fn(),
      loadSoundParams: vi.fn(),
      getSoundParams: vi.fn(() => ({ attack: 0 })),
      setRowSwing: vi.fn(),
      loadMidiOutputConfigs: vi.fn(),
      midiOutputGlobalEnabled: false,
      humanize: 0,
    },
    audioEngine: {
      soundParams: Array.from({ length: NUM_ROWS }, () => ({})),
      saturation: { setDrive: vi.fn(), setTone: vi.fn() },
      eq: { setLow: vi.fn(), setMid: vi.fn(), setHigh: vi.fn() },
      delay: { setTimeFromDivision: vi.fn() },
      sampleEngine: { loadMetas: vi.fn() },
      useSample: new Array(NUM_ROWS).fill(false),
    },
    midiLearn: { loadMappings: vi.fn() },
    muteScenes: { loadScenes: vi.fn() },
    midiClock: { setMode: vi.fn() },
    effectsPanel: { setDelayDivisionIndex: vi.fn() },
    metronomeUI: { setEnabled: vi.fn() },
    ...overrides,
  } as never;
}

function makeMinimalSaved(overrides: Record<string, unknown> = {}) {
  return {
    grids: [[[0]]],
    tempo: 120,
    swing: 0,
    activeBank: 0,
    probabilities: [[[1]]],
    pitchOffsets: [[0]],
    ...overrides,
  };
}

describe('restoreAppState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', { location: { hash: '' } });
  });

  it('returns hadUrlHash: true when hash present', () => {
    vi.stubGlobal('window', { location: { hash: '#abc' } });
    (decodeState as ReturnType<typeof vi.fn>).mockReturnValue({
      grids: [[[0]]], tempo: 120, swing: 0, activeBank: 0,
    });
    const result = restoreAppState(makeDeps());
    expect(result.hadUrlHash).toBe(true);
  });

  it('returns hadUrlHash: false when no hash', () => {
    (AutoSave.load as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const result = restoreAppState(makeDeps());
    expect(result.hadUrlHash).toBe(false);
  });

  it('calls decodeState + loadFullState when hash exists', () => {
    vi.stubGlobal('window', { location: { hash: '#test' } });
    const decoded = {
      grids: [[[1]]], tempo: 130, swing: 0.1, activeBank: 1,
      probabilities: undefined, pitchOffsets: undefined, noteGrids: undefined,
      rowVolumes: undefined, rowPans: undefined, ratchets: undefined,
      conditions: undefined, rowSwings: undefined, gates: undefined,
      slides: undefined, reverbSends: undefined, delaySends: undefined,
    };
    (decodeState as ReturnType<typeof vi.fn>).mockReturnValue(decoded);
    const deps = makeDeps();
    restoreAppState(deps);
    expect(decodeState).toHaveBeenCalledWith('test');
    expect((deps as any).sequencer.loadFullState).toHaveBeenCalled();
  });

  it('falls through to localStorage when no hash', () => {
    (AutoSave.load as ReturnType<typeof vi.fn>).mockReturnValue(makeMinimalSaved());
    const deps = makeDeps();
    restoreAppState(deps);
    expect(decodeState).not.toHaveBeenCalled();
    expect((deps as any).sequencer.loadFullState).toHaveBeenCalled();
  });
});

describe('restoreFromLocalStorage (via restoreAppState)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', { location: { hash: '' } });
  });

  it('returns early when AutoSave.load() returns null', () => {
    (AutoSave.load as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const deps = makeDeps();
    restoreAppState(deps);
    expect((deps as any).sequencer.loadFullState).not.toHaveBeenCalled();
  });

  it('converts null to NaN for filterLocks', () => {
    const saved = makeMinimalSaved({
      filterLocks: [[[null, 0.5, null]]],
    });
    (AutoSave.load as ReturnType<typeof vi.fn>).mockReturnValue(saved);
    const deps = makeDeps();
    restoreAppState(deps);
    const call = (deps as any).sequencer.loadFullState.mock.calls[0];
    // filterLocks is the 10th argument (index 9)
    const fl = call[9];
    expect(fl[0][0][0]).toBeNaN();
    expect(fl[0][0][1]).toBe(0.5);
    expect(fl[0][0][2]).toBeNaN();
  });

  it('converts null to NaN for automationData', () => {
    const saved = makeMinimalSaved({
      automationData: [[[[null, 0.3, null]]]],
    });
    (AutoSave.load as ReturnType<typeof vi.fn>).mockReturnValue(saved);
    const deps = makeDeps();
    restoreAppState(deps);
    const call = (deps as any).sequencer.loadFullState.mock.calls[0];
    // automationData is the 18th argument (index 17)
    const ad = call[17];
    expect(ad[0][0][0][0]).toBeNaN();
    expect(ad[0][0][0][1]).toBe(0.3);
    expect(ad[0][0][0][2]).toBeNaN();
  });

  it('distributes global swing to rows when no rowSwings saved', () => {
    const saved = makeMinimalSaved({ swing: 0.3 });
    (AutoSave.load as ReturnType<typeof vi.fn>).mockReturnValue(saved);
    const deps = makeDeps();
    restoreAppState(deps);
    expect((deps as any).sequencer.setRowSwing).toHaveBeenCalledTimes(NUM_ROWS);
    for (let i = 0; i < NUM_ROWS; i++) {
      expect((deps as any).sequencer.setRowSwing).toHaveBeenCalledWith(i, 0.3);
    }
  });

  it('does not distribute swing when rowSwings are present', () => {
    const saved = makeMinimalSaved({ swing: 0.3, rowSwings: [[0.1]] });
    (AutoSave.load as ReturnType<typeof vi.fn>).mockReturnValue(saved);
    const deps = makeDeps();
    restoreAppState(deps);
    expect((deps as any).sequencer.setRowSwing).not.toHaveBeenCalled();
  });

  it('restores saturation drive and tone', () => {
    const saved = makeMinimalSaved({ saturationDrive: 0.8, saturationTone: 0.6 });
    (AutoSave.load as ReturnType<typeof vi.fn>).mockReturnValue(saved);
    const deps = makeDeps();
    restoreAppState(deps);
    expect((deps as any).audioEngine.saturation.setDrive).toHaveBeenCalledWith(0.8);
    expect((deps as any).audioEngine.saturation.setTone).toHaveBeenCalledWith(0.6);
  });

  it('restores EQ low/mid/high', () => {
    const saved = makeMinimalSaved({ eqLow: 1.5, eqMid: 0.8, eqHigh: 1.2 });
    (AutoSave.load as ReturnType<typeof vi.fn>).mockReturnValue(saved);
    const deps = makeDeps();
    restoreAppState(deps);
    expect((deps as any).audioEngine.eq.setLow).toHaveBeenCalledWith(1.5);
    expect((deps as any).audioEngine.eq.setMid).toHaveBeenCalledWith(0.8);
    expect((deps as any).audioEngine.eq.setHigh).toHaveBeenCalledWith(1.2);
  });

  it('restores delay division and calls effectsPanel', () => {
    const saved = makeMinimalSaved({ delayDivision: 2, tempo: 140 });
    (AutoSave.load as ReturnType<typeof vi.fn>).mockReturnValue(saved);
    const deps = makeDeps();
    restoreAppState(deps);
    expect((deps as any).audioEngine.delay.setTimeFromDivision).toHaveBeenCalled();
    expect((deps as any).effectsPanel.setDelayDivisionIndex).toHaveBeenCalledWith(2);
  });

  it('restores MIDI CC mappings', () => {
    const mappings = [{ cc: 1, channel: 0, target: 'volume', row: 0 }];
    const saved = makeMinimalSaved({ midiMappings: mappings });
    (AutoSave.load as ReturnType<typeof vi.fn>).mockReturnValue(saved);
    const deps = makeDeps();
    restoreAppState(deps);
    expect((deps as any).midiLearn.loadMappings).toHaveBeenCalledWith(mappings);
  });

  it('restores sample metadata and useSample flags', () => {
    const metas = [{ trimStart: 0, trimEnd: 1, loop: false }];
    const useSample = [true, false, false, false, false, false, false, false];
    const saved = makeMinimalSaved({ sampleMetas: metas, useSample });
    (AutoSave.load as ReturnType<typeof vi.fn>).mockReturnValue(saved);
    const deps = makeDeps();
    restoreAppState(deps);
    expect((deps as any).audioEngine.sampleEngine.loadMetas).toHaveBeenCalledWith(metas);
    expect((deps as any).audioEngine.useSample[0]).toBe(true);
  });

  it('restores mute scenes', () => {
    const scenes = [{ mutes: [true, false] }, null];
    const saved = makeMinimalSaved({ muteScenes: scenes });
    (AutoSave.load as ReturnType<typeof vi.fn>).mockReturnValue(saved);
    const deps = makeDeps();
    restoreAppState(deps);
    expect((deps as any).muteScenes.loadScenes).toHaveBeenCalledWith(scenes);
  });

  it('restores MIDI output config and clock mode', () => {
    const configs = [{ channel: 0, enabled: true }];
    const saved = makeMinimalSaved({
      midiOutputConfigs: configs,
      midiOutputGlobalEnabled: true,
      midiClockMode: 'send',
    });
    (AutoSave.load as ReturnType<typeof vi.fn>).mockReturnValue(saved);
    const deps = makeDeps();
    restoreAppState(deps);
    expect((deps as any).sequencer.loadMidiOutputConfigs).toHaveBeenCalledWith(configs);
    expect((deps as any).sequencer.midiOutputGlobalEnabled).toBe(true);
    expect((deps as any).midiClock.setMode).toHaveBeenCalledWith('send');
  });
});
