import type { Sequencer } from '../sequencer/sequencer';
import { NUM_BANKS } from '../types';
import { eventBus } from '../utils/event-bus';
import { randomizeGrid } from '../data/randomizer';

export class PatternBankUI {
  private buttons: HTMLButtonElement[] = [];

  constructor(parent: HTMLElement, private sequencer: Sequencer) {
    const container = document.createElement('div');
    container.className = 'pattern-bank';

    const label = document.createElement('span');
    label.className = 'pattern-bank-label';
    label.textContent = 'Bank';
    container.appendChild(label);

    const bankLabels = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < NUM_BANKS; i++) {
      const btn = document.createElement('button');
      btn.className = 'bank-btn';
      if (i === this.sequencer.activeBank) btn.classList.add('bank-btn--active');
      btn.textContent = bankLabels[i];
      btn.addEventListener('click', () => this.sequencer.setBank(i));
      container.appendChild(btn);
      this.buttons.push(btn);
    }

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'clear-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => this.sequencer.clearCurrentBank());
    container.appendChild(clearBtn);

    // Randomize button
    const randBtn = document.createElement('button');
    randBtn.className = 'rand-btn';
    randBtn.textContent = 'Rand';
    randBtn.addEventListener('click', () => PatternBankUI.doRandomize(this.sequencer));
    container.appendChild(randBtn);

    parent.appendChild(container);

    eventBus.on('bank:changed', (bankIndex) => {
      this.buttons.forEach((btn, i) => {
        btn.classList.toggle('bank-btn--active', i === (bankIndex as number));
      });
    });
  }

  static doRandomize(sequencer: Sequencer): void {
    const grid = randomizeGrid();
    sequencer.loadGrid(grid);
  }
}
