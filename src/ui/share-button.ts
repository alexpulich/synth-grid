import type { Sequencer } from '../sequencer/sequencer';
import { encodeState } from '../state/url-state';

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
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Share'; }, 2000);
      }).catch(() => {
        btn.textContent = 'Share';
      });
    });

    parent.appendChild(btn);
  }
}
