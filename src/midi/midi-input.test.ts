import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_NOTE_MAP, MidiInput } from './midi-input';

describe('DEFAULT_NOTE_MAP', () => {
  it('maps GM drum notes correctly', () => {
    expect(DEFAULT_NOTE_MAP.get(36)).toBe(0); // Kick
    expect(DEFAULT_NOTE_MAP.get(38)).toBe(1); // Snare
    expect(DEFAULT_NOTE_MAP.get(42)).toBe(2); // HiHat
    expect(DEFAULT_NOTE_MAP.get(39)).toBe(3); // Clap
  });

  it('maps direct octave (48-55) to rows 0-7', () => {
    for (let i = 0; i < 8; i++) {
      expect(DEFAULT_NOTE_MAP.get(48 + i)).toBe(i);
    }
  });

  it('maps drum pad alt (24-31) to rows 0-7', () => {
    for (let i = 0; i < 8; i++) {
      expect(DEFAULT_NOTE_MAP.get(24 + i)).toBe(i);
    }
  });

  it('returns undefined for unmapped notes', () => {
    expect(DEFAULT_NOTE_MAP.get(0)).toBeUndefined();
    expect(DEFAULT_NOTE_MAP.get(100)).toBeUndefined();
    expect(DEFAULT_NOTE_MAP.get(127)).toBeUndefined();
  });
});

describe('MidiInput.handleNote', () => {
  let mockAudioEngine: { ctx: { currentTime: number }; trigger: ReturnType<typeof vi.fn> };
  let midiInput: MidiInput;

  beforeEach(() => {
    mockAudioEngine = { ctx: { currentTime: 0 }, trigger: vi.fn() };
    midiInput = new MidiInput(mockAudioEngine as never);
  });

  it('triggers at correct row for mapped note', () => {
    midiInput.handleNote(36, 100, 0); // Kick → row 0
    expect(mockAudioEngine.trigger).toHaveBeenCalledWith(0, 0, expect.closeTo(0.787, 2));
  });

  it('normalizes velocity correctly', () => {
    midiInput.handleNote(38, 127, 0); // max velocity
    expect(mockAudioEngine.trigger).toHaveBeenCalledWith(1, 0, expect.closeTo(1.0, 2));

    mockAudioEngine.trigger.mockClear();
    midiInput.handleNote(38, 64, 0);
    expect(mockAudioEngine.trigger).toHaveBeenCalledWith(1, 0, expect.closeTo(0.504, 2));
  });

  it('ignores unmapped notes', () => {
    midiInput.handleNote(100, 127, 0);
    expect(mockAudioEngine.trigger).not.toHaveBeenCalled();
  });
});
