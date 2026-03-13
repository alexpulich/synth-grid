import { NUM_ROWS } from '../types';
import type { AudioEngine } from '../audio/audio-engine';
import type { Sequencer } from '../sequencer/sequencer';

export function createMidiCCRouter(
  audioEngine: AudioEngine,
  sequencer: Sequencer,
): (target: string, value: number) => void {
  return (target: string, value: number) => {
    const parts = target.split(':');
    switch (parts[0]) {
      case 'tempo':
        sequencer.tempo = 30 + value * 270;
        break;
      case 'master-volume':
        audioEngine.masterGain.gain.setValueAtTime(value, audioEngine.ctx.currentTime);
        break;
      case 'reverb-mix':
        audioEngine.reverb.setMix(value);
        break;
      case 'delay-feedback':
        audioEngine.delay.setFeedback(value * 0.9);
        break;
      case 'delay-mix':
        audioEngine.delay.setMix(value);
        break;
      case 'filter-cutoff':
        audioEngine.filter.setFrequency(value);
        break;
      case 'filter-resonance':
        audioEngine.filter.setResonance(value);
        break;
      case 'saturation-drive':
        audioEngine.saturation.setDrive(value);
        break;
      case 'eq-low':
        audioEngine.eq.setLow(value);
        break;
      case 'eq-mid':
        audioEngine.eq.setMid(value);
        break;
      case 'eq-high':
        audioEngine.eq.setHigh(value);
        break;
      case 'humanize':
        sequencer.humanize = value;
        break;
      case 'volume': {
        const row = parseInt(parts[1]);
        if (row >= 0 && row < NUM_ROWS) {
          sequencer.setRowVolume(row, value);
          audioEngine.setRowVolume(row, value);
        }
        break;
      }
      case 'pan': {
        const row = parseInt(parts[1]);
        if (row >= 0 && row < NUM_ROWS) {
          const pan = value * 2 - 1; // Map 0-1 to -1..1
          sequencer.setRowPan(row, pan);
          audioEngine.setRowPan(row, pan);
        }
        break;
      }
      case 'reverb-send': {
        const row = parseInt(parts[1]);
        if (row >= 0 && row < NUM_ROWS) {
          sequencer.setReverbSend(row, value);
          audioEngine.setRowReverbSend(row, value);
        }
        break;
      }
      case 'delay-send': {
        const row = parseInt(parts[1]);
        if (row >= 0 && row < NUM_ROWS) {
          sequencer.setDelaySend(row, value);
          audioEngine.setRowDelaySend(row, value);
        }
        break;
      }
    }
  };
}
