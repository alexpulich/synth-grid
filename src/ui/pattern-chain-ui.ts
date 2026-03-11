import type { Sequencer } from '../sequencer/sequencer';
import { NUM_BANKS } from '../types';
import { eventBus } from '../utils/event-bus';

const BANK_LABELS = ['A', 'B', 'C', 'D'];

export class PatternChainUI {
  private chainContainer: HTMLElement;
  private chainItems: HTMLElement[] = [];
  private modeBtn: HTMLButtonElement;
  private draggedIndex: number | null = null;

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
      this.modeBtn.textContent = songMode ? 'Song' : 'Loop';
      this.modeBtn.classList.toggle('chain-mode-btn--song', songMode);
      wrapper.classList.toggle('pattern-chain--song-mode', songMode);
    });

    eventBus.on('chain:updated', () => this.renderChain());
    eventBus.on('chain:position-changed', (pos) => this.highlightPosition(pos));
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
      item.draggable = true;

      // Click to remove
      item.addEventListener('click', () => {
        // Don't remove if we just finished a drag
        if (this.draggedIndex !== null) return;
        this.sequencer.patternChain.removeFromChain(position);
      });

      // Drag to reorder
      item.addEventListener('dragstart', (e) => {
        this.draggedIndex = position;
        item.classList.add('chain-item--dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(position));
        }
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        if (this.draggedIndex !== null && this.draggedIndex !== position) {
          item.classList.add('chain-item--drag-over');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('chain-item--drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('chain-item--drag-over');
        if (this.draggedIndex !== null && this.draggedIndex !== position) {
          this.sequencer.patternChain.moveItem(this.draggedIndex, position);
        }
        this.draggedIndex = null;
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('chain-item--dragging');
        // Clear drag-over from all items
        this.chainItems.forEach((el) => el.classList.remove('chain-item--drag-over'));
        // Use setTimeout so the click handler can check draggedIndex
        setTimeout(() => { this.draggedIndex = null; }, 0);
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
