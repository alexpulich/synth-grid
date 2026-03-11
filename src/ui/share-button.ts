import type { Sequencer } from '../sequencer/sequencer';
import { encodeStateV4 } from '../state/url-state';
import { showToast } from './toast';

export class ShareButton {
  constructor(parent: HTMLElement, private sequencer: Sequencer) {
    const btn = document.createElement('button');
    btn.className = 'share-btn';
    btn.textContent = 'Share';

    btn.addEventListener('click', () => {
      const hash = encodeStateV4({
        grids: this.sequencer.getAllGrids(),
        tempo: this.sequencer.tempo,
        swing: this.sequencer.swing,
        activeBank: this.sequencer.activeBank,
        probabilities: this.sequencer.getAllProbabilities(),
        noteGrids: this.sequencer.getAllNoteGrids(),
        ratchets: this.sequencer.getAllRatchets(),
        conditions: this.sequencer.getAllConditions(),
        gates: this.sequencer.getAllGates(),
        slides: this.sequencer.getAllSlides(),
        rowVolumes: this.sequencer.getAllRowVolumes(),
        rowPans: this.sequencer.getAllRowPans(),
        rowSwings: this.sequencer.getAllRowSwings(),
        reverbSends: this.sequencer.getAllReverbSends(),
        delaySends: this.sequencer.getAllDelaySends(),
        pitchOffsets: this.sequencer.getAllPitchOffsets(),
        scale: this.sequencer.selectedScale,
        rootNote: this.sequencer.rootNote,
        humanize: this.sequencer.humanize,
        sidechainEnabled: this.sequencer.sidechainEnabled,
        sidechainDepth: this.sequencer.sidechainDepth,
        sidechainRelease: this.sequencer.sidechainRelease,
        soundParams: this.sequencer.getAllSoundParams(),
      });

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
