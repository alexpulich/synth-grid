import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRouter = vi.fn();
vi.mock('./midi-cc-router', () => ({
  createMidiCCRouter: vi.fn(() => mockRouter),
}));

import { createMidiCCRouter } from './midi-cc-router';
import { wireMidi } from './midi-wiring';

function createMocks() {
  return {
    midiManager: {
      onNote: vi.fn(),
      onCC: vi.fn(),
      onClock: vi.fn(),
    },
    midiInput: { handleNote: vi.fn() },
    midiLearn: { handleCC: vi.fn(), onApply: vi.fn() },
    midiClock: { handleClockByte: vi.fn() },
    audioEngine: {},
    sequencer: {},
  };
}

describe('wireMidi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers onNote callback that delegates to midiInput.handleNote', () => {
    const m = createMocks();
    wireMidi(m.midiManager as never, m.midiInput as never, m.midiLearn as never, m.midiClock as never, m.audioEngine as never, m.sequencer as never);

    const noteCallback = m.midiManager.onNote.mock.calls[0][0];
    noteCallback(60, 127, 1);
    expect(m.midiInput.handleNote).toHaveBeenCalledWith(60, 127, 1);
  });

  it('registers onCC callback that delegates to midiLearn.handleCC', () => {
    const m = createMocks();
    wireMidi(m.midiManager as never, m.midiInput as never, m.midiLearn as never, m.midiClock as never, m.audioEngine as never, m.sequencer as never);

    const ccCallback = m.midiManager.onCC.mock.calls[0][0];
    ccCallback(74, 64, 0);
    expect(m.midiLearn.handleCC).toHaveBeenCalledWith(74, 64, 0);
  });

  it('with midiClock: registers onClock callback', () => {
    const m = createMocks();
    wireMidi(m.midiManager as never, m.midiInput as never, m.midiLearn as never, m.midiClock as never, m.audioEngine as never, m.sequencer as never);

    expect(m.midiManager.onClock).toHaveBeenCalledTimes(1);
    const clockCallback = m.midiManager.onClock.mock.calls[0][0];
    clockCallback(0xF8);
    expect(m.midiClock.handleClockByte).toHaveBeenCalledWith(0xF8);
  });

  it('without midiClock: does not register onClock', () => {
    const m = createMocks();
    wireMidi(m.midiManager as never, m.midiInput as never, m.midiLearn as never, undefined, m.audioEngine as never, m.sequencer as never);

    expect(m.midiManager.onClock).not.toHaveBeenCalled();
  });

  it('calls midiLearn.onApply with result of createMidiCCRouter', () => {
    const m = createMocks();
    wireMidi(m.midiManager as never, m.midiInput as never, m.midiLearn as never, m.midiClock as never, m.audioEngine as never, m.sequencer as never);

    expect(createMidiCCRouter).toHaveBeenCalledWith(m.audioEngine, m.sequencer);
    expect(m.midiLearn.onApply).toHaveBeenCalledWith(mockRouter);
  });

  it('forwards note arguments correctly', () => {
    const m = createMocks();
    wireMidi(m.midiManager as never, m.midiInput as never, m.midiLearn as never, m.midiClock as never, m.audioEngine as never, m.sequencer as never);

    const noteCallback = m.midiManager.onNote.mock.calls[0][0];
    noteCallback(48, 80, 9);
    expect(m.midiInput.handleNote).toHaveBeenCalledWith(48, 80, 9);
  });

  it('forwards CC arguments correctly', () => {
    const m = createMocks();
    wireMidi(m.midiManager as never, m.midiInput as never, m.midiLearn as never, m.midiClock as never, m.audioEngine as never, m.sequencer as never);

    const ccCallback = m.midiManager.onCC.mock.calls[0][0];
    ccCallback(1, 127, 15);
    expect(m.midiLearn.handleCC).toHaveBeenCalledWith(1, 127, 15);
  });

  it('forwards clock status byte correctly', () => {
    const m = createMocks();
    wireMidi(m.midiManager as never, m.midiInput as never, m.midiLearn as never, m.midiClock as never, m.audioEngine as never, m.sequencer as never);

    const clockCallback = m.midiManager.onClock.mock.calls[0][0];
    clockCallback(0xFA); // Start
    expect(m.midiClock.handleClockByte).toHaveBeenCalledWith(0xFA);
  });

  it('registers all three callbacks on midiManager', () => {
    const m = createMocks();
    wireMidi(m.midiManager as never, m.midiInput as never, m.midiLearn as never, m.midiClock as never, m.audioEngine as never, m.sequencer as never);

    expect(m.midiManager.onNote).toHaveBeenCalledTimes(1);
    expect(m.midiManager.onCC).toHaveBeenCalledTimes(1);
    expect(m.midiManager.onClock).toHaveBeenCalledTimes(1);
  });
});
