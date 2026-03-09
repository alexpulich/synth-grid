import type { Transport } from '../sequencer/transport';
import type { Sequencer } from '../sequencer/sequencer';

export class KeyboardShortcuts {
  constructor(
    private transport: Transport,
    private sequencer: Sequencer,
    private onRandomize?: () => void,
  ) {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.transport.toggle();
        break;
      case 'Digit1': this.sequencer.setBank(0); break;
      case 'Digit2': this.sequencer.setBank(1); break;
      case 'Digit3': this.sequencer.setBank(2); break;
      case 'Digit4': this.sequencer.setBank(3); break;
      case 'KeyC': this.sequencer.clearCurrentBank(); break;
      case 'KeyR':
        if (this.onRandomize) this.onRandomize();
        break;
    }
  };
}
