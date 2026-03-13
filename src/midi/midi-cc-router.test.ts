import { describe, it, expect, vi } from 'vitest';
import { createMidiCCRouter } from './midi-cc-router';

function makeMockAudioEngine() {
  return {
    ctx: { currentTime: 0 },
    masterGain: { gain: { setValueAtTime: vi.fn() } },
    reverb: { setMix: vi.fn() },
    delay: { setFeedback: vi.fn(), setMix: vi.fn() },
    filter: { setFrequency: vi.fn(), setResonance: vi.fn() },
    saturation: { setDrive: vi.fn() },
    eq: { setLow: vi.fn(), setMid: vi.fn(), setHigh: vi.fn() },
    setRowVolume: vi.fn(),
    setRowPan: vi.fn(),
    setRowReverbSend: vi.fn(),
    setRowDelaySend: vi.fn(),
  };
}

function makeMockSequencer() {
  return {
    tempo: 120,
    humanize: 0,
    setRowVolume: vi.fn(),
    setRowPan: vi.fn(),
    setReverbSend: vi.fn(),
    setDelaySend: vi.fn(),
  };
}

describe('createMidiCCRouter', () => {
  it('tempo maps 0→30, 1→300', () => {
    const ae = makeMockAudioEngine();
    const seq = makeMockSequencer();
    const route = createMidiCCRouter(ae as never, seq as never);

    route('tempo', 0);
    expect(seq.tempo).toBe(30);

    route('tempo', 1);
    expect(seq.tempo).toBe(300);
  });

  it('master-volume sets gain', () => {
    const ae = makeMockAudioEngine();
    const seq = makeMockSequencer();
    const route = createMidiCCRouter(ae as never, seq as never);

    route('master-volume', 0.75);
    expect(ae.masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0.75, 0);
  });

  it('volume:0 sets row 0 volume on both sequencer and audio engine', () => {
    const ae = makeMockAudioEngine();
    const seq = makeMockSequencer();
    const route = createMidiCCRouter(ae as never, seq as never);

    route('volume:0', 0.8);
    expect(seq.setRowVolume).toHaveBeenCalledWith(0, 0.8);
    expect(ae.setRowVolume).toHaveBeenCalledWith(0, 0.8);
  });

  it('pan:0 maps 0-1 → -1..1', () => {
    const ae = makeMockAudioEngine();
    const seq = makeMockSequencer();
    const route = createMidiCCRouter(ae as never, seq as never);

    route('pan:0', 0);
    expect(seq.setRowPan).toHaveBeenCalledWith(0, -1);

    route('pan:0', 0.5);
    expect(seq.setRowPan).toHaveBeenCalledWith(0, 0);

    route('pan:0', 1);
    expect(seq.setRowPan).toHaveBeenCalledWith(0, 1);
  });

  it('invalid row index is ignored', () => {
    const ae = makeMockAudioEngine();
    const seq = makeMockSequencer();
    const route = createMidiCCRouter(ae as never, seq as never);

    route('volume:99', 0.5);
    expect(seq.setRowVolume).not.toHaveBeenCalled();

    route('pan:-1', 0.5);
    expect(seq.setRowPan).not.toHaveBeenCalled();
  });

  it('unknown target is silently ignored', () => {
    const ae = makeMockAudioEngine();
    const seq = makeMockSequencer();
    const route = createMidiCCRouter(ae as never, seq as never);

    // Should not throw
    expect(() => route('nonexistent', 0.5)).not.toThrow();
  });

  it('reverb-send and delay-send route to both sequencer and audio engine', () => {
    const ae = makeMockAudioEngine();
    const seq = makeMockSequencer();
    const route = createMidiCCRouter(ae as never, seq as never);

    route('reverb-send:2', 0.6);
    expect(seq.setReverbSend).toHaveBeenCalledWith(2, 0.6);
    expect(ae.setRowReverbSend).toHaveBeenCalledWith(2, 0.6);

    route('delay-send:3', 0.4);
    expect(seq.setDelaySend).toHaveBeenCalledWith(3, 0.4);
    expect(ae.setRowDelaySend).toHaveBeenCalledWith(3, 0.4);
  });

  it('humanize sets sequencer humanize', () => {
    const ae = makeMockAudioEngine();
    const seq = makeMockSequencer();
    const route = createMidiCCRouter(ae as never, seq as never);

    route('humanize', 0.5);
    expect(seq.humanize).toBe(0.5);
  });

  it('delay-feedback scales to 0.9 max', () => {
    const ae = makeMockAudioEngine();
    const seq = makeMockSequencer();
    const route = createMidiCCRouter(ae as never, seq as never);

    route('delay-feedback', 1);
    expect(ae.delay.setFeedback).toHaveBeenCalledWith(0.9);

    route('delay-feedback', 0.5);
    expect(ae.delay.setFeedback).toHaveBeenCalledWith(0.45);
  });

  it('effect controls route correctly', () => {
    const ae = makeMockAudioEngine();
    const seq = makeMockSequencer();
    const route = createMidiCCRouter(ae as never, seq as never);

    route('reverb-mix', 0.7);
    expect(ae.reverb.setMix).toHaveBeenCalledWith(0.7);

    route('delay-mix', 0.3);
    expect(ae.delay.setMix).toHaveBeenCalledWith(0.3);

    route('filter-cutoff', 0.5);
    expect(ae.filter.setFrequency).toHaveBeenCalledWith(0.5);

    route('filter-resonance', 0.8);
    expect(ae.filter.setResonance).toHaveBeenCalledWith(0.8);

    route('saturation-drive', 0.6);
    expect(ae.saturation.setDrive).toHaveBeenCalledWith(0.6);

    route('eq-low', 0.4);
    expect(ae.eq.setLow).toHaveBeenCalledWith(0.4);

    route('eq-mid', 0.5);
    expect(ae.eq.setMid).toHaveBeenCalledWith(0.5);

    route('eq-high', 0.6);
    expect(ae.eq.setHigh).toHaveBeenCalledWith(0.6);
  });
});
