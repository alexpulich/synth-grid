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

    const modKey = e.metaKey || e.ctrlKey;

    // Undo: Ctrl/Cmd+Z
    if (modKey && !e.shiftKey && e.code === 'KeyZ') {
      e.preventDefault();
      this.sequencer.undo();
      return;
    }

    // Redo: Ctrl/Cmd+Shift+Z
    if (modKey && e.shiftKey && e.code === 'KeyZ') {
      e.preventDefault();
      this.sequencer.redo();
      return;
    }

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
      case 'KeyS':
        this.sequencer.patternChain.toggleSongMode();
        break;
    }
  };
}
