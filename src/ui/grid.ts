import { NUM_ROWS, NUM_STEPS } from '../types';
import { INSTRUMENTS } from '../audio/instruments';
import type { Sequencer } from '../sequencer/sequencer';
import { eventBus } from '../utils/event-bus';

export class GridUI {
  private container: HTMLElement;
  private cells: HTMLElement[][] = [];

  constructor(parent: HTMLElement, private sequencer: Sequencer) {
    this.container = document.createElement('div');
    this.container.className = 'grid';
    parent.appendChild(this.container);

    this.buildGrid();
    this.bindEvents();
  }

  private buildGrid(): void {
    for (let row = 0; row < NUM_ROWS; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'grid-row';
      rowEl.dataset.instrument = String(row);
      this.cells[row] = [];

      const label = document.createElement('span');
      label.className = 'grid-row-label';
      label.textContent = INSTRUMENTS[row].name;
      label.style.color = INSTRUMENTS[row].color;
      rowEl.appendChild(label);

      for (let step = 0; step < NUM_STEPS; step++) {
        const cell = document.createElement('button');
        cell.className = 'grid-cell';
        cell.dataset.row = String(row);
        cell.dataset.step = String(step);
        if (step % 4 === 0 && step > 0) cell.classList.add('grid-cell--beat-start');
        rowEl.appendChild(cell);
        this.cells[row][step] = cell;
      }

      this.container.appendChild(rowEl);
    }
  }

  private bindEvents(): void {
    this.container.addEventListener('mousedown', (e) => {
      const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      this.sequencer.toggleCell(row, step);
    });

    eventBus.on('cell:toggled', (payload) => {
      const { row, step, active } = payload as { row: number; step: number; active: boolean };
      this.cells[row][step].classList.toggle('grid-cell--active', active);
    });

    eventBus.on('bank:changed', () => this.refreshAll());
    eventBus.on('grid:cleared', () => this.refreshAll());
  }

  highlightStep(step: number): void {
    const prev = (step - 1 + NUM_STEPS) % NUM_STEPS;
    for (let row = 0; row < NUM_ROWS; row++) {
      this.cells[row][prev].classList.remove('grid-cell--playing');
      this.cells[row][step].classList.add('grid-cell--playing');

      if (this.cells[row][step].classList.contains('grid-cell--active')) {
        this.cells[row][step].classList.add('grid-cell--triggered');
        const cellRef = this.cells[row][step];
        setTimeout(() => cellRef.classList.remove('grid-cell--triggered'), 200);
      }
    }
  }

  clearPlayhead(): void {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        this.cells[row][step].classList.remove('grid-cell--playing');
      }
    }
  }

  getCellRect(row: number, step: number): DOMRect {
    return this.cells[row][step].getBoundingClientRect();
  }

  private refreshAll(): void {
    const grid = this.sequencer.getCurrentGrid();
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        this.cells[row][step].classList.toggle('grid-cell--active', grid[row][step]);
      }
    }
  }
}
