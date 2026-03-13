import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Transport } from './transport';
import { eventBus } from '../utils/event-bus';

function createMockSequencer() {
  return {
    isPlaying: false,
    currentStep: 0,
    _tempo: 120,
    get tempo() { return this._tempo; },
    set tempo(v: number) { this._tempo = v; eventBus.emit('tempo:changed', v); },
    patternChain: {
      songMode: false,
      length: 0,
      resetPosition: vi.fn(),
      getCurrentChainBank: vi.fn(() => null),
    },
    clearQueue: vi.fn(),
    setBank: vi.fn(),
    getMidiOutputConfig: vi.fn(() => ({ enabled: false, portId: null, channel: 0, baseNote: 60 })),
  } as any;
}

function createMockScheduler() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
  } as any;
}

function createMockAudioEngine() {
  return {
    resume: vi.fn(),
  } as any;
}

describe('Transport', () => {
  let sequencer: ReturnType<typeof createMockSequencer>;
  let scheduler: ReturnType<typeof createMockScheduler>;
  let audioEngine: ReturnType<typeof createMockAudioEngine>;
  let transport: Transport;
  const unsubs: (() => void)[] = [];

  beforeEach(() => {
    sequencer = createMockSequencer();
    scheduler = createMockScheduler();
    audioEngine = createMockAudioEngine();
    vi.stubGlobal('window', { addEventListener: vi.fn() });
    vi.stubGlobal('performance', { now: vi.fn(() => 0) });
    transport = new Transport(sequencer, scheduler, audioEngine);
  });

  afterEach(() => {
    unsubs.forEach(u => u());
    unsubs.length = 0;
    vi.restoreAllMocks();
  });

  it('play sets isPlaying, calls resume + start, emits transport:play', () => {
    const fn = vi.fn();
    unsubs.push(eventBus.on('transport:play', fn));
    transport.play();
    expect(sequencer.isPlaying).toBe(true);
    expect(audioEngine.resume).toHaveBeenCalled();
    expect(scheduler.start).toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
  });

  it('play when already playing is no-op', () => {
    sequencer.isPlaying = true;
    transport.play();
    expect(audioEngine.resume).not.toHaveBeenCalled();
    expect(scheduler.start).not.toHaveBeenCalled();
  });

  it('stop clears isPlaying, calls stop, resets step, emits transport:stop', () => {
    const fn = vi.fn();
    unsubs.push(eventBus.on('transport:stop', fn));
    sequencer.isPlaying = true;
    sequencer.currentStep = 5;
    transport.stop();
    expect(sequencer.isPlaying).toBe(false);
    expect(scheduler.stop).toHaveBeenCalled();
    expect(sequencer.currentStep).toBe(0);
    expect(fn).toHaveBeenCalled();
  });

  it('toggle alternates play/stop', () => {
    transport.toggle();
    expect(sequencer.isPlaying).toBe(true);
    transport.toggle();
    expect(sequencer.isPlaying).toBe(false);
  });

  it('tapTempo: 2 taps 500ms apart → 120 BPM', () => {
    vi.mocked(performance.now).mockReturnValueOnce(0).mockReturnValueOnce(500);
    transport.tapTempo();
    transport.tapTempo();
    expect(sequencer.tempo).toBe(120);
  });

  it('tapTempo: 3+ taps averages intervals', () => {
    vi.mocked(performance.now)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(400)
      .mockReturnValueOnce(800);
    transport.tapTempo();
    transport.tapTempo();
    transport.tapTempo();
    expect(sequencer.tempo).toBe(150);
  });

  it('tapTempo: >2s gap resets tap history', () => {
    vi.mocked(performance.now)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(500)
      .mockReturnValueOnce(3000)
      .mockReturnValueOnce(3500);
    transport.tapTempo();
    transport.tapTempo();
    transport.tapTempo();
    transport.tapTempo();
    expect(sequencer.tempo).toBe(120);
  });

  it('tapTempo: caps at 8 entries', () => {
    const times = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500];
    let i = 0;
    vi.mocked(performance.now).mockImplementation(() => times[i++]);
    for (let t = 0; t < times.length; t++) {
      transport.tapTempo();
    }
    expect(sequencer.tempo).toBe(120);
  });

  it('play with songMode resets position and sets bank', () => {
    sequencer.patternChain.songMode = true;
    sequencer.patternChain.length = 2;
    sequencer.patternChain.getCurrentChainBank.mockReturnValue(1);
    transport.play();
    expect(sequencer.patternChain.resetPosition).toHaveBeenCalled();
    expect(sequencer.setBank).toHaveBeenCalledWith(1);
  });

  it('stop calls clearQueue', () => {
    sequencer.isPlaying = true;
    transport.stop();
    expect(sequencer.clearQueue).toHaveBeenCalled();
  });
});
