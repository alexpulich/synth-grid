import type { Sequencer } from '../sequencer/sequencer';
import { exportToWav } from '../audio/wav-exporter';
import { showToast } from './toast';

export class ExportButton {
  constructor(parent: HTMLElement, private sequencer: Sequencer) {
    const btn = document.createElement('button');
    btn.className = 'export-btn';
    btn.textContent = 'Export WAV';

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Exporting...';
      try {
        await exportToWav(this.sequencer);
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
