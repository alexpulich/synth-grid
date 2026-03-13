export type ParsedMidiMessage =
  | { type: 'note-on'; channel: number; note: number; velocity: number }
  | { type: 'note-off'; channel: number; note: number }
  | { type: 'cc'; channel: number; cc: number; value: number }
  | { type: 'system'; status: number };

export function parseMidiMessage(data: Uint8Array | number[]): ParsedMidiMessage | null {
  if (!data || data.length < 1) return null;

  // System real-time messages (single byte, no channel)
  if (data[0] >= 0xf0) {
    return { type: 'system', status: data[0] };
  }

  if (data.length < 2) return null;

  const status = data[0] & 0xf0;
  const channel = data[0] & 0x0f;

  if (status === 0x90 && data.length >= 3) {
    // Note On (velocity 0 = note off per MIDI spec)
    if (data[2] > 0) {
      return { type: 'note-on', channel, note: data[1], velocity: data[2] };
    }
    return { type: 'note-off', channel, note: data[1] };
  }

  if (status === 0x80 && data.length >= 3) {
    return { type: 'note-off', channel, note: data[1] };
  }

  if (status === 0xb0 && data.length >= 3) {
    return { type: 'cc', channel, cc: data[1], value: data[2] };
  }

  return null;
}

export function buildNoteOn(channel: number, note: number, velocity: number): number[] {
  return [0x90 | (channel & 0x0f), note & 0x7f, Math.round(velocity * 127) & 0x7f];
}

export function buildNoteOff(channel: number, note: number): number[] {
  return [0x80 | (channel & 0x0f), note & 0x7f, 0];
}

export function buildCC(channel: number, cc: number, value: number): number[] {
  return [0xb0 | (channel & 0x0f), cc & 0x7f, value & 0x7f];
}

export function buildAllNotesOff(channel: number): number[] {
  return buildCC(channel, 123, 0);
}

export const MIDI_CLOCK = [0xf8];
export const MIDI_START = [0xfa];
export const MIDI_STOP = [0xfc];
