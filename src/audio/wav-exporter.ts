import { INSTRUMENTS } from './instruments';
import type { Sequencer } from '../sequencer/sequencer';
import { NUM_STEPS, VELOCITY_MAP } from '../types';

export async function exportToWav(sequencer: Sequencer): Promise<void> {
  const sampleRate = 44100;
  const tempo = sequencer.tempo;
  const secondsPerStep = 60.0 / tempo / 4;
  const numLoops = 2;
  const totalSteps = NUM_STEPS * numLoops;
  const duration = totalSteps * secondsPerStep + 2; // Extra 2s for decay tails

  const offlineCtx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.8, 0);
  masterGain.connect(offlineCtx.destination);

  const grid = sequencer.getCurrentGrid();

  for (let loop = 0; loop < numLoops; loop++) {
    for (let step = 0; step < NUM_STEPS; step++) {
      const time = (loop * NUM_STEPS + step) * secondsPerStep;
      const swingOffset = step % 2 === 1 ? sequencer.swing * secondsPerStep : 0;
      const triggerTime = time + swingOffset;

      for (let row = 0; row < grid.length; row++) {
        const vel = grid[row][step];
        if (vel > 0 && sequencer.muteState.isRowAudible(row)) {
          const instrument = INSTRUMENTS[row];
          if (instrument) {
            instrument.trigger(offlineCtx, masterGain, triggerTime, VELOCITY_MAP[vel]);
          }
        }
      }
    }
  }

  const buffer = await offlineCtx.startRendering();
  const wav = encodeWav(buffer);
  downloadBlob(wav, 'synth-grid-export.wav');
}

function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const length = buffer.length;

  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = length * numChannels * (bitsPerSample / 8);
  const headerSize = 44;

  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels and convert to 16-bit PCM
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
