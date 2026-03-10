import type { AudioEngine } from '../audio/audio-engine';
import { NUM_ROWS } from '../types';

// Default MIDI note → instrument row mapping
// Supports General MIDI drum notes (36-47) and direct mapping (48-55)
const DEFAULT_NOTE_MAP: Map<number, number> = new Map([
  // GM Drum mapping
  [36, 0], // C2  → Kick
  [37, 0], // C#2 → Kick (side stick alt)
  [38, 1], // D2  → Snare
  [40, 1], // E2  → Snare (electric alt)
  [42, 2], // F#2 → HiHat (closed)
  [44, 2], // G#2 → HiHat (pedal)
  [46, 2], // A#2 → HiHat (open)
  [39, 3], // D#2 → Clap
  [41, 4], // F2  → Bass
  [43, 5], // G2  → Lead
  [45, 6], // A2  → Pad
  [47, 7], // B2  → Perc
  // Direct octave mapping: C3-G3 → rows 0-7
  [48, 0], [49, 1], [50, 2], [51, 3],
  [52, 4], [53, 5], [54, 6], [55, 7],
  // Drum pad alt: C1-G1 → rows 0-7
  [24, 0], [25, 1], [26, 2], [27, 3],
  [28, 4], [29, 5], [30, 6], [31, 7],
]);

export class MidiInput {
  constructor(private audioEngine: AudioEngine) {}

  handleNote(note: number, velocity: number, _channel: number): void {
    const row = DEFAULT_NOTE_MAP.get(note);
    if (row == null || row >= NUM_ROWS) return;

    // Map MIDI velocity (1-127) to our velocity range (0-1)
    const normalizedVelocity = velocity / 127;

    // Trigger immediately for lowest latency
    this.audioEngine.trigger(
      row,
      this.audioEngine.ctx.currentTime,
      normalizedVelocity,
    );
  }
}
