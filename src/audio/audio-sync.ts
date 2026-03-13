import type { Sequencer } from '../sequencer/sequencer';
import type { AudioEngine } from './audio-engine';
import { eventBus } from '../utils/event-bus';
import { NUM_ROWS } from '../types';

function resyncAllRows(sequencer: Sequencer, audioEngine: AudioEngine): void {
  const volumes = sequencer.getCurrentRowVolumes();
  const pans = sequencer.getCurrentRowPans();
  const reverbSends = sequencer.getCurrentReverbSends();
  const delaySends = sequencer.getCurrentDelaySends();
  for (let row = 0; row < NUM_ROWS; row++) {
    audioEngine.setRowVolume(row, volumes[row]);
    audioEngine.setRowPan(row, pans[row]);
    audioEngine.setRowReverbSend(row, reverbSends[row]);
    audioEngine.setRowDelaySend(row, delaySends[row]);
  }
}

export function wireAudioSync(sequencer: Sequencer, audioEngine: AudioEngine): void {
  eventBus.on('volume:changed', ({ row, volume }) => {
    audioEngine.setRowVolume(row, volume);
  });
  eventBus.on('pan:changed', ({ row, pan }) => {
    audioEngine.setRowPan(row, pan);
  });
  eventBus.on('send:reverb-changed', ({ row, value }) => {
    audioEngine.setRowReverbSend(row, value);
  });
  eventBus.on('send:delay-changed', ({ row, value }) => {
    audioEngine.setRowDelaySend(row, value);
  });

  eventBus.on('soundparam:changed', ({ row, params }) => {
    audioEngine.soundParams[row] = { ...params };
  });

  eventBus.on('bank:changed', () => {
    resyncAllRows(sequencer, audioEngine);
  });

  eventBus.on('grid:cleared', () => {
    resyncAllRows(sequencer, audioEngine);
  });
}
