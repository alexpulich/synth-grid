import type { Sequencer } from '../sequencer/sequencer';
import { NUM_BANKS } from '../types';
import { eventBus } from '../utils/event-bus';

const BANK_LABELS = ['A', 'B', 'C', 'D'];

export class PatternChainUI {
  private chainContainer: HTMLElement;
  private chainItems: HTMLElement[] = [];
  private modeBtn: HTMLButtonElement;

  constructor(parent: HTMLElement, private sequencer: Sequencer) {
    const wrapper = document.createElement('div');
    wrapper.className = 'pattern-chain';

    // Top row: mode button + bank add buttons + clear
    const topRow = document.createElement('div');
    topRow.className = 'chain-top-row';

    this.modeBtn = document.createElement('button');
    this.modeBtn.className = 'chain-mode-btn';
    this.modeBtn.textContent = 'Loop';
    this.modeBtn.addEventListener('click', () => {
      this.sequencer.patternChain.toggleSongMode();
    });
    topRow.appendChild(this.modeBtn);

    const inputRow = document.createElement('div');
    inputRow.className = 'chain-input';
    for (let i = 0; i < NUM_BANKS; i++) {
      const btn = document.createElement('button');
      btn.className = 'chain-add-btn';
      btn.textContent = BANK_LABELS[i];
      btn.addEventListener('click', () => this.sequencer.patternChain.addToChain(i));
      inputRow.appendChild(btn);
    }
    const clearBtn = document.createElement('button');
    clearBtn.className = 'chain-clear-btn';
    clearBtn.textContent = 'X';
    clearBtn.addEventListener('click', () => this.sequencer.patternChain.clearChain());
    inputRow.appendChild(clearBtn);
    topRow.appendChild(inputRow);

    wrapper.appendChild(topRow);

    // Chain display
    this.chainContainer = document.createElement('div');
    this.chainContainer.className = 'chain-display';
    wrapper.appendChild(this.chainContainer);

    parent.appendChild(wrapper);

    eventBus.on('chain:mode-changed', (songMode) => {
      this.modeBtn.textContent = (songMode as boolean) ? 'Song' : 'Loop';
      this.modeBtn.classList.toggle('chain-mode-btn--song', songMode as boolean);
      wrapper.classList.toggle('pattern-chain--song-mode', songMode as boolean);
    });

    eventBus.on('chain:updated', () => this.renderChain());
    eventBus.on('chain:position-changed', (pos) => this.highlightPosition(pos as number));
  }

  private renderChain(): void {
    while (this.chainContainer.firstChild) {
      this.chainContainer.removeChild(this.chainContainer.firstChild);
    }
    this.chainItems = [];
    const chain = this.sequencer.patternChain.getChain();

    if (chain.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'chain-empty';
      empty.textContent = 'Add patterns to build a song...';
      this.chainContainer.appendChild(empty);
      return;
    }

    chain.forEach((bankIndex, position) => {
      const item = document.createElement('button');
      item.className = 'chain-item';
      item.textContent = BANK_LABELS[bankIndex];
      item.addEventListener('click', () => {
        this.sequencer.patternChain.removeFromChain(position);
      });
      this.chainContainer.appendChild(item);
      this.chainItems.push(item);
    });
  }

  private highlightPosition(position: number): void {
    this.chainItems.forEach((item, i) => {
      item.classList.toggle('chain-item--active', i === position);
    });
  }
}
