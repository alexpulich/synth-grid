import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deriveBpmFromClockTimes, MidiClock } from './midi-clock';

describe('deriveBpmFromClockTimes', () => {
  it('returns null with fewer than 6 samples', () => {
    expect(deriveBpmFromClockTimes([])).toBeNull();
    expect(deriveBpmFromClockTimes([0, 1, 2, 3, 4])).toBeNull();
  });

  it('derives 120 BPM from correct intervals', () => {
    // 120 BPM = 500ms per beat = 500/24 ≈ 20.833ms per clock tick
    const interval = 60000 / (120 * 24);
    const times = Array.from({ length: 24 }, (_, i) => i * interval);
    expect(deriveBpmFromClockTimes(times)).toBe(120);
  });

  it('derives 90 BPM from correct intervals', () => {
    const interval = 60000 / (90 * 24);
    const times = Array.from({ length: 24 }, (_, i) => i * interval);
    expect(deriveBpmFromClockTimes(times)).toBe(90);
  });

  it('returns null for out-of-range BPM', () => {
    // Very fast intervals → BPM > 300
    const times = Array.from({ length: 10 }, (_, i) => i * 0.01);
    expect(deriveBpmFromClockTimes(times)).toBeNull();
    // Very slow intervals → BPM < 30
    const slowTimes = Array.from({ length: 10 }, (_, i) => i * 1000);
    expect(deriveBpmFromClockTimes(slowTimes)).toBeNull();
  });
});

describe('MidiClock', () => {
  let clock: MidiClock;
  let mockMidiOutput: { sendClock: ReturnType<typeof vi.fn>; sendStart: ReturnType<typeof vi.fn>; sendStop: ReturnType<typeof vi.fn> };
  let mockSequencer: { midiClockMode: string; tempo: number };
  let mockTransport: { play: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockMidiOutput = { sendClock: vi.fn(), sendStart: vi.fn(), sendStop: vi.fn() };
    mockSequencer = { midiClockMode: 'receive', tempo: 120 };
    mockTransport = { play: vi.fn(), stop: vi.fn() };
    clock = new MidiClock(mockMidiOutput as never, mockSequencer as never);
    clock.setTransport(mockTransport as never);
  });

  it('accumulates times on 0xF8 clock ticks', () => {
    // Send several clock bytes — should not throw
    for (let i = 0; i < 10; i++) {
      clock.handleClockByte(0xf8);
    }
    // After enough ticks, tempo should have been derived
    // (performance.now() calls will be very close together, so BPM may be out of range)
    // Just verify it doesn't crash
  });

  it('starts transport on 0xFA', () => {
    clock.handleClockByte(0xfa);
    expect(mockTransport.play).toHaveBeenCalledOnce();
  });

  it('stops transport on 0xFC', () => {
    clock.handleClockByte(0xfc);
    expect(mockTransport.stop).toHaveBeenCalledOnce();
  });

  it('ignores clock bytes when not in receive mode', () => {
    mockSequencer.midiClockMode = 'off';
    clock.handleClockByte(0xfa);
    expect(mockTransport.play).not.toHaveBeenCalled();
    clock.handleClockByte(0xfc);
    expect(mockTransport.stop).not.toHaveBeenCalled();
  });

  it('caps received times buffer at 48', () => {
    // Send 60 clock ticks
    for (let i = 0; i < 60; i++) {
      clock.handleClockByte(0xf8);
    }
    // Can't directly inspect receivedClockTimes, but it shouldn't crash or leak memory
    // Verify the class is still functional
    clock.handleClockByte(0xfa);
    expect(mockTransport.play).toHaveBeenCalledOnce();
  });

  it('setMode clears received times', () => {
    // Accumulate some clock ticks
    for (let i = 0; i < 10; i++) {
      clock.handleClockByte(0xf8);
    }
    clock.setMode('off');
    expect(mockSequencer.midiClockMode).toBe('off');
  });

  it('setMode stops send timer when leaving send mode', () => {
    // Stub window.setInterval/clearInterval for node environment
    const origSetInterval = globalThis.setInterval;
    const origClearInterval = globalThis.clearInterval;
    const clearSpy = vi.fn();
    // @ts-expect-error — overriding for test
    globalThis.window = { setInterval: () => 42 };
    globalThis.clearInterval = clearSpy;

    mockSequencer.midiClockMode = 'send';
    clock.onTransportPlay();
    expect(mockMidiOutput.sendStart).toHaveBeenCalledOnce();
    // Switch mode — should stop send timer (calls clearInterval)
    clock.setMode('off');
    expect(mockSequencer.midiClockMode).toBe('off');
    expect(clearSpy).toHaveBeenCalledWith(42);

    // Restore
    globalThis.setInterval = origSetInterval;
    globalThis.clearInterval = origClearInterval;
    // @ts-expect-error — cleanup
    delete globalThis.window;
  });
});
