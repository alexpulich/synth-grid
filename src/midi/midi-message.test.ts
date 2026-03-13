import { describe, it, expect } from 'vitest';
import {
  parseMidiMessage,
  buildNoteOn,
  buildNoteOff,
  buildCC,
  buildAllNotesOff,
  MIDI_CLOCK,
  MIDI_START,
  MIDI_STOP,
} from './midi-message';

describe('parseMidiMessage', () => {
  it('parses note-on (0x90, velocity > 0)', () => {
    const msg = parseMidiMessage([0x90, 60, 100]);
    expect(msg).toEqual({ type: 'note-on', channel: 0, note: 60, velocity: 100 });
  });

  it('treats velocity-0 note-on as note-off', () => {
    const msg = parseMidiMessage([0x90, 60, 0]);
    expect(msg).toEqual({ type: 'note-off', channel: 0, note: 60 });
  });

  it('parses explicit note-off (0x80)', () => {
    const msg = parseMidiMessage([0x80, 60, 64]);
    expect(msg).toEqual({ type: 'note-off', channel: 0, note: 60 });
  });

  it('parses CC (0xB0)', () => {
    const msg = parseMidiMessage([0xb0, 7, 100]);
    expect(msg).toEqual({ type: 'cc', channel: 0, cc: 7, value: 100 });
  });

  it('parses system real-time messages', () => {
    expect(parseMidiMessage([0xf8])).toEqual({ type: 'system', status: 0xf8 });
    expect(parseMidiMessage([0xfa])).toEqual({ type: 'system', status: 0xfa });
    expect(parseMidiMessage([0xfc])).toEqual({ type: 'system', status: 0xfc });
  });

  it('extracts channel from lower nibble', () => {
    const msg = parseMidiMessage([0x95, 60, 100]); // channel 5
    expect(msg).toEqual({ type: 'note-on', channel: 5, note: 60, velocity: 100 });

    const cc = parseMidiMessage([0xbf, 1, 64]); // channel 15
    expect(cc).toEqual({ type: 'cc', channel: 15, cc: 1, value: 64 });
  });

  it('returns null for empty data', () => {
    expect(parseMidiMessage([])).toBeNull();
  });

  it('returns null for short non-system message', () => {
    expect(parseMidiMessage([0x90])).toBeNull();
    expect(parseMidiMessage([0x90, 60])).toBeNull();
  });
});

describe('buildNoteOn', () => {
  it('produces correct bytes', () => {
    expect(buildNoteOn(0, 60, 1.0)).toEqual([0x90, 60, 127]);
  });

  it('clamps channel to 0-15', () => {
    const bytes = buildNoteOn(17, 60, 1.0);
    expect(bytes[0]).toBe(0x91); // 17 & 0x0f = 1
  });

  it('clamps note to 0-127', () => {
    const bytes = buildNoteOn(0, 200, 1.0);
    expect(bytes[1]).toBe(200 & 0x7f);
  });

  it('maps velocity float to 0-127', () => {
    expect(buildNoteOn(0, 60, 0.5)[2]).toBe(64);
    expect(buildNoteOn(0, 60, 0.0)[2]).toBe(0);
    expect(buildNoteOn(0, 60, 1.0)[2]).toBe(127);
  });
});

describe('buildNoteOff', () => {
  it('produces correct bytes', () => {
    expect(buildNoteOff(0, 60)).toEqual([0x80, 60, 0]);
  });
});

describe('buildCC / buildAllNotesOff', () => {
  it('buildCC produces correct bytes', () => {
    expect(buildCC(0, 7, 100)).toEqual([0xb0, 7, 100]);
  });

  it('buildAllNotesOff sends CC 123 value 0', () => {
    expect(buildAllNotesOff(0)).toEqual([0xb0, 123, 0]);
    expect(buildAllNotesOff(5)).toEqual([0xb5, 123, 0]);
  });
});

describe('MIDI constants', () => {
  it('clock/start/stop have correct status bytes', () => {
    expect(MIDI_CLOCK).toEqual([0xf8]);
    expect(MIDI_START).toEqual([0xfa]);
    expect(MIDI_STOP).toEqual([0xfc]);
  });
});
