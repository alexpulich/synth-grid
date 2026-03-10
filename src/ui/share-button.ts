import type { Sequencer } from '../sequencer/sequencer';
import { encodeState } from '../state/url-state';
import { showToast } from './toast';

export class ShareButton {
  constructor(parent: HTMLElement, private sequencer: Sequencer) {
    const btn = document.createElement('button');
    btn.className = 'share-btn';
    btn.textContent = 'Share';

    btn.addEventListener('click', () => {
      const hash = encodeState(
        this.sequencer.getAllGrids(),
        this.sequencer.tempo,
        this.sequencer.swing,
        this.sequencer.activeBank,
        this.sequencer.getAllProbabilities(),
      );

      const url = `${window.location.origin}${window.location.pathname}#${hash}`;
      window.location.hash = hash;

      navigator.clipboard.writeText(url).then(() => {
        showToast('URL copied to clipboard', 'success');
      }).catch(() => {
        showToast('Failed to copy URL', 'warning');
      });
    });

    parent.appendChild(btn);
  }
}
