import type { Sequencer } from '../sequencer/sequencer';
import type { AudioEngine } from '../audio/audio-engine';
import { exportToWav } from '../audio/wav-exporter';
import { showToast } from './toast';

export class ExportButton {
  constructor(parent: HTMLElement, private sequencer: Sequencer, private audioEngine?: AudioEngine) {
    const btn = document.createElement('button');
    btn.className = 'export-btn';
    btn.textContent = 'Export WAV';

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Exporting...';
      try {
        await exportToWav(this.sequencer, this.audioEngine);
        showToast('WAV export complete', 'success');
      } catch {
        showToast('WAV export failed', 'warning');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Export WAV';
      }
    });

    parent.appendChild(btn);
  }
}
