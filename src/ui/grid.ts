import { NUM_ROWS, NUM_STEPS, VELOCITY_OFF, VELOCITY_LOUD } from '../types';
import type { VelocityLevel } from '../types';
import { INSTRUMENTS } from '../audio/instruments';
import type { Sequencer } from '../sequencer/sequencer';
import { eventBus } from '../utils/event-bus';

export class GridUI {
  private container: HTMLElement;
  private cells: HTMLElement[][] = [];
  private rowElements: HTMLElement[] = [];
  private labelElements: HTMLElement[] = [];

  // Drag paint state
  private isDragging = false;
  private dragMode: 'paint' | 'erase' = 'paint';
  private draggedCells = new Set<string>();

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
      this.rowElements[row] = rowEl;

      const label = document.createElement('span');
      label.className = 'grid-row-label';
      label.textContent = INSTRUMENTS[row].name;
      label.style.color = INSTRUMENTS[row].color;
      label.dataset.row = String(row);
      this.labelElements[row] = label;
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
    // Drag paint: mousedown on cells
    this.container.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;

      // Label click: mute/solo
      if (target.classList.contains('grid-row-label')) {
        const row = Number(target.dataset.row);
        if (e.shiftKey) {
          this.sequencer.muteState.toggleSolo(row);
        } else {
          this.sequencer.muteState.toggleMute(row);
        }
        return;
      }

      const cell = target.closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;

      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);

      // Shift+click: cycle velocity
      if (e.shiftKey) {
        this.sequencer.cycleVelocity(row, step);
        return;
      }

      // Start drag
      e.preventDefault();
      const grid = this.sequencer.getCurrentGrid();
      this.isDragging = true;
      this.dragMode = grid[row][step] > 0 ? 'erase' : 'paint';
      this.draggedCells.clear();
      this.sequencer.pushHistorySnapshot();

      this.applyDrag(row, step);
    });

    // Drag paint: mouseover during drag
    this.container.addEventListener('mouseover', (e) => {
      if (!this.isDragging) return;
      const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      this.applyDrag(row, step);
    });

    // Drag paint: end drag
    document.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.draggedCells.clear();
    });

    // Cell toggled event
    eventBus.on('cell:toggled', (payload) => {
      const { row, step, velocity } = payload as { row: number; step: number; velocity: number };
      const cell = this.cells[row][step];
      cell.classList.toggle('grid-cell--active', velocity > 0);
      cell.dataset.velocity = String(velocity);
    });

    // Full grid refresh events
    eventBus.on('bank:changed', () => this.refreshAll());
    eventBus.on('grid:cleared', () => this.refreshAll());

    // Mute/solo state change
    eventBus.on('mute:changed', (state) => {
      const { muted, soloRow } = state as { muted: boolean[]; soloRow: number | null };
      for (let row = 0; row < NUM_ROWS; row++) {
        this.rowElements[row].classList.toggle('grid-row--muted', muted[row]);
        this.rowElements[row].classList.toggle('grid-row--solo', soloRow === row);

        // Update label text with mute/solo indicator
        let name = INSTRUMENTS[row].name;
        if (soloRow === row) name += ' [S]';
        else if (muted[row]) name += ' [M]';
        this.labelElements[row].textContent = name;
      }
    });
  }

  private applyDrag(row: number, step: number): void {
    const key = `${row},${step}`;
    if (this.draggedCells.has(key)) return;
    this.draggedCells.add(key);

    const vel: VelocityLevel = this.dragMode === 'paint' ? VELOCITY_LOUD : VELOCITY_OFF;
    this.sequencer.setCell(row, step, vel);
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
        const vel = grid[row][step];
        this.cells[row][step].classList.toggle('grid-cell--active', vel > 0);
        this.cells[row][step].dataset.velocity = String(vel);
      }
    }
  }
}
