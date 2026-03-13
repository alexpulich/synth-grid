import type { MidiManager } from './midi-manager';
import type { MidiInput } from './midi-input';
import type { MidiLearn } from './midi-learn';
import type { MidiClock } from './midi-clock';
import type { AudioEngine } from '../audio/audio-engine';
import type { Sequencer } from '../sequencer/sequencer';
import { createMidiCCRouter } from './midi-cc-router';

export function wireMidi(
  midiManager: MidiManager,
  midiInput: MidiInput,
  midiLearn: MidiLearn,
  midiClock: MidiClock | undefined,
  audioEngine: AudioEngine,
  sequencer: Sequencer,
): void {
  midiManager.onNote((note, velocity, channel) => {
    midiInput.handleNote(note, velocity, channel);
  });
  midiManager.onCC((cc, value, channel) => {
    midiLearn.handleCC(cc, value, channel);
  });
  if (midiClock) {
    midiManager.onClock((status) => {
      midiClock.handleClockByte(status);
    });
  }
  midiLearn.onApply(createMidiCCRouter(audioEngine, sequencer));
}
