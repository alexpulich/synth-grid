import { VELOCITY_OFF, VELOCITY_LOUD, MELODIC_ROWS } from '../types';
import type { VelocityLevel } from '../types';
import { INSTRUMENTS } from '../audio/instruments';
import type { Sequencer } from '../sequencer/sequencer';
import type { AudioEngine } from '../audio/audio-engine';
import { eventBus } from '../utils/event-bus';
import { SCALES, scaleDegreesToSemitones, semitoneToNoteName } from '../utils/scales';
import { elementAtTouch } from '../utils/touch';

const INSTRUMENT_CLASS: Record<number, string> = {
  4: 'bass',
  5: 'lead',
  6: 'pad',
};

export class PianoRoll {
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private titleEl: HTMLElement;
  private scaleInfoEl: HTMLElement;
  private labelsEl: HTMLElement;
  private gridEl: HTMLElement;
  private gridWrap: HTMLElement;

  private currentRow = 4;
  private visible = false;
  private pitchRows: number[] = [];
  private cellMap = new Map<string, HTMLElement>();
  private stepHeaders: HTMLElement[] = [];
  private currentPlayStep = -1;

  // Drag state
  private isDragging = false;
  private dragMode: 'paint' | 'erase' = 'paint';
  private draggedCells = new Set<string>();

  // Preview throttle
  private lastPreviewTime = 0;

  constructor(
    private sequencer: Sequencer,
    private audioEngine: AudioEngine,
  ) {
    // Build overlay + panel DOM (appended to body on first open)
    this.overlay = document.createElement('div');
    this.overlay.className = 'piano-roll-overlay';

    this.panel = document.createElement('div');
    this.panel.className = 'piano-roll';

    // Header
    const header = document.createElement('div');
    header.className = 'piano-roll__header';

    this.titleEl = document.createElement('span');
    this.titleEl.className = 'piano-roll__title';

    this.scaleInfoEl = document.createElement('span');
    this.scaleInfoEl.className = 'piano-roll__scale-info';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'piano-roll__close';
    closeBtn.textContent = '\u00d7'; // ×
    closeBtn.title = 'Close (Esc)';
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(this.titleEl);
    header.appendChild(this.scaleInfoEl);
    header.appendChild(closeBtn);
    this.panel.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'piano-roll__body';

    this.labelsEl = document.createElement('div');
    this.labelsEl.className = 'piano-roll__labels';

    this.gridWrap = document.createElement('div');
    this.gridWrap.className = 'piano-roll__grid-wrap';

    this.gridEl = document.createElement('div');
    this.gridEl.className = 'piano-roll__grid';

    this.gridWrap.appendChild(this.gridEl);
    body.appendChild(this.labelsEl);
    body.appendChild(this.gridWrap);
    this.panel.appendChild(body);
    this.overlay.appendChild(this.panel);

    // Close on backdrop click/touch
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) this.close();
    });
    this.overlay.addEventListener('touchstart', (e) => {
      if (e.target === this.overlay) this.close();
    }, { passive: true });

    // Close on Escape
    this.onKeyDown = this.onKeyDown.bind(this);

    // Drag end
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);

    // Touch paint on grid
    this.gridEl.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const cell = elementAtTouch(touch, '.piano-roll__cell') as HTMLElement | null;
      if (!cell) return;
      e.preventDefault();
      const step = Number(cell.dataset.step);
      const pitch = Number(cell.dataset.pitch);
      this.sequencer.pushHistorySnapshot();
      const result = this.handleCellToggle(step, pitch);
      this.isDragging = true;
      this.dragMode = result;
      this.draggedCells.clear();
      this.draggedCells.add(`${step},${pitch}`);
    }, { passive: false });

    this.gridEl.addEventListener('touchmove', (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      const cell = elementAtTouch(touch, '.piano-roll__cell') as HTMLElement | null;
      if (!cell) return;
      const step = Number(cell.dataset.step);
      const pitch = Number(cell.dataset.pitch);
      const key = `${step},${pitch}`;
      if (this.draggedCells.has(key)) return;
      this.draggedCells.add(key);
      this.handleDragCell(step, pitch);
    }, { passive: false });
    // Wire event bus
    eventBus.on('step:advance', (step) => {
      if (!this.visible) return;
      const rowLen = this.sequencer.getRowLength(this.currentRow);
      this.updatePlayhead(step % rowLen);
    });

    eventBus.on('transport:stop', () => {
      if (!this.visible) return;
      this.clearPlayhead();
    });

    eventBus.on('bank:changed', () => {
      if (!this.visible) return;
      this.refreshGrid();
    });

    eventBus.on('grid:cleared', () => {
      if (!this.visible) return;
      this.refreshGrid();
    });

    eventBus.on('scale:changed', () => {
      if (!this.visible) return;
      this.rebuildGrid();
      this.refreshGrid();
    });

    eventBus.on('cell:toggled', ({ row, step }) => {
      if (!this.visible || row !== this.currentRow) return;
      this.refreshStep(step);
    });

    eventBus.on('note:changed', ({ row, step }) => {
      if (!this.visible || row !== this.currentRow) return;
      this.refreshStep(step);
    });
  }

  open(row: number): void {
    if (!MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number])) return;
    this.currentRow = row;

    // Update header
    const inst = INSTRUMENTS[row];
    const varName = `--color-${inst.name.toLowerCase()}`;
    this.titleEl.textContent = `${inst.name} Piano Roll`;
    this.titleEl.style.color = `var(${varName})`;

    // Set instrument class on panel for cell coloring
    this.panel.className = `piano-roll piano-roll--${INSTRUMENT_CLASS[row]}`;

    this.updateScaleInfo();
    this.rebuildGrid();
    this.refreshGrid();

    if (!this.overlay.parentElement) {
      document.body.appendChild(this.overlay);
    }

    // Show with slight delay for transition
    requestAnimationFrame(() => {
      this.overlay.classList.add('piano-roll-overlay--visible');
    });

    this.visible = true;
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('touchend', this.onTouchEnd);
    document.addEventListener('touchcancel', this.onTouchEnd);
  }

  close(): void {
    this.overlay.classList.remove('piano-roll-overlay--visible');
    this.visible = false;
    this.isDragging = false;
    this.clearPlayhead();
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('touchend', this.onTouchEnd);
    document.removeEventListener('touchcancel', this.onTouchEnd);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  }

  private onMouseUp(): void {
    this.isDragging = false;
    this.draggedCells.clear();
  }

  private onTouchEnd(): void {
    this.isDragging = false;
    this.draggedCells.clear();
  }

  private updateScaleInfo(): void {
    const scale = SCALES[this.sequencer.selectedScale];
    const rootName = semitoneToNoteName(0, this.sequencer.rootNote);
    this.scaleInfoEl.textContent = `${rootName} ${scale.name}`;
  }

  /** Compute which semitone offsets are available based on the current scale */
  private computePitchRows(): number[] {
    const scale = SCALES[this.sequencer.selectedScale];

    if (scale.intervals.length === 12) {
      // Chromatic: all 25 semitones
      const pitches: number[] = [];
      for (let s = 12; s >= -12; s--) {
        pitches.push(s);
      }
      return pitches;
    }

    // Non-chromatic: enumerate scale degrees that produce semitones in [-12, +12]
    const seen = new Set<number>();
    const pitches: number[] = [];
    const len = scale.intervals.length;
    const maxDegrees = Math.ceil(24 / 12 * len) + len;

    for (let degree = -maxDegrees; degree <= maxDegrees; degree++) {
      const semitones = scaleDegreesToSemitones(scale, degree);
      if (semitones >= -12 && semitones <= 12 && !seen.has(semitones)) {
        seen.add(semitones);
        pitches.push(semitones);
      }
    }

    // Sort descending (highest pitch at top)
    pitches.sort((a, b) => b - a);
    return pitches;
  }

  /** Rebuild the entire grid DOM (called on open and scale change) */
  private rebuildGrid(): void {
    this.pitchRows = this.computePitchRows();
    this.cellMap.clear();
    this.stepHeaders = [];

    const rowLen = this.sequencer.getRowLength(this.currentRow);

    // Clear existing children safely
    this.labelsEl.replaceChildren();
    this.gridEl.replaceChildren();

    // Dynamic grid columns based on row length
    this.gridEl.style.gridTemplateColumns = `repeat(${rowLen}, 1fr)`;

    // Step header numbers
    for (let step = 0; step < rowLen; step++) {
      const header = document.createElement('div');
      header.className = 'piano-roll__step-num';
      header.textContent = String(step + 1);
      this.stepHeaders[step] = header;
      this.gridEl.appendChild(header);
    }

    // Pitch labels + cells
    for (const pitch of this.pitchRows) {
      // Label
      const label = document.createElement('div');
      const noteName = semitoneToNoteName(this.sequencer.rootNote, pitch);
      label.className = 'piano-roll__label';
      if (pitch === 0) label.classList.add('piano-roll__label--root');
      if (pitch !== 0 && pitch % 12 === 0) label.classList.add('piano-roll__label--octave');
      label.textContent = `${noteName}${pitch > 0 ? '+' + pitch : pitch < 0 ? String(pitch) : ''}`;
      this.labelsEl.appendChild(label);

      // Cells for each step (only up to row length)
      for (let step = 0; step < rowLen; step++) {
        const cell = document.createElement('button');
        cell.className = 'piano-roll__cell';
        if (step % 4 === 0 && step > 0) cell.classList.add('piano-roll__cell--beat-start');
        if (pitch === 0) cell.classList.add('piano-roll__cell--root-row');
        cell.dataset.step = String(step);
        cell.dataset.pitch = String(pitch);

        cell.addEventListener('mousedown', (e) => {
          e.preventDefault();
          this.sequencer.pushHistorySnapshot();
          const result = this.handleCellToggle(step, pitch);
          this.isDragging = true;
          this.dragMode = result;
          this.draggedCells.clear();
          this.draggedCells.add(`${step},${pitch}`);
        });

        cell.addEventListener('mouseenter', () => {
          if (!this.isDragging) return;
          const key = `${step},${pitch}`;
          if (this.draggedCells.has(key)) return;
          this.draggedCells.add(key);
          this.handleDragCell(step, pitch);
        });

        this.cellMap.set(`${step},${pitch}`, cell);
        this.gridEl.appendChild(cell);
      }
    }
  }

  /** Read sequencer state and update all cell visuals */
  private refreshGrid(): void {
    const grid = this.sequencer.getCurrentGrid();
    const noteGrid = this.sequencer.getCurrentNoteGrid();
    const row = this.currentRow;
    const rowLen = this.sequencer.getRowLength(row);

    // Clear all active states
    for (const cell of this.cellMap.values()) {
      cell.classList.remove('piano-roll__cell--active');
      delete cell.dataset.velocity;
    }

    // Mark active cells (only within row length)
    for (let step = 0; step < rowLen; step++) {
      const velocity = grid[row][step];
      if (velocity === VELOCITY_OFF) continue;

      const note = noteGrid[row][step];
      const cell = this.cellMap.get(`${step},${note}`);
      if (cell) {
        cell.classList.add('piano-roll__cell--active');
        cell.dataset.velocity = String(velocity);
      }
    }
  }

  /** Refresh a single step column */
  private refreshStep(step: number): void {
    const grid = this.sequencer.getCurrentGrid();
    const noteGrid = this.sequencer.getCurrentNoteGrid();
    const row = this.currentRow;

    // Clear all cells in this step column
    for (const pitch of this.pitchRows) {
      const cell = this.cellMap.get(`${step},${pitch}`);
      if (cell) {
        cell.classList.remove('piano-roll__cell--active');
        delete cell.dataset.velocity;
      }
    }

    // Mark the active one (if any)
    const velocity = grid[row][step];
    if (velocity !== VELOCITY_OFF) {
      const note = noteGrid[row][step];
      const cell = this.cellMap.get(`${step},${note}`);
      if (cell) {
        cell.classList.add('piano-roll__cell--active');
        cell.dataset.velocity = String(velocity);
      }
    }
  }

  /**
   * Handle clicking a cell. Returns 'paint' or 'erase' to set drag mode.
   */
  private handleCellToggle(step: number, pitch: number): 'paint' | 'erase' {
    const grid = this.sequencer.getCurrentGrid();
    const noteGrid = this.sequencer.getCurrentNoteGrid();
    const row = this.currentRow;
    const currentVel = grid[row][step];
    const currentNote = noteGrid[row][step];

    if (currentVel === VELOCITY_OFF) {
      // Empty step: activate with this pitch
      this.sequencer.setCell(row, step, VELOCITY_LOUD as VelocityLevel);
      this.sequencer.setNoteOffsetSilent(row, step, pitch);
      this.previewNote(pitch);
      return 'paint';
    } else if (currentNote === pitch) {
      // Same pitch: erase
      this.sequencer.setCell(row, step, VELOCITY_OFF as VelocityLevel);
      this.sequencer.setNoteOffsetSilent(row, step, 0);
      return 'erase';
    } else {
      // Different pitch: move note
      this.sequencer.setNoteOffsetSilent(row, step, pitch);
      this.previewNote(pitch);
      return 'paint';
    }
  }

  /** Handle drag painting/erasing */
  private handleDragCell(step: number, pitch: number): void {
    const grid = this.sequencer.getCurrentGrid();
    const noteGrid = this.sequencer.getCurrentNoteGrid();
    const row = this.currentRow;
    const currentVel = grid[row][step];
    const currentNote = noteGrid[row][step];

    if (this.dragMode === 'paint') {
      if (currentVel === VELOCITY_OFF) {
        // Activate step with this pitch
        this.sequencer.setCell(row, step, VELOCITY_LOUD as VelocityLevel);
        this.sequencer.setNoteOffsetSilent(row, step, pitch);
        this.previewNote(pitch);
      } else if (currentNote !== pitch) {
        // Move existing note to this pitch
        this.sequencer.setNoteOffsetSilent(row, step, pitch);
        this.previewNote(pitch);
      }
    } else {
      // Erase mode
      if (currentVel !== VELOCITY_OFF && currentNote === pitch) {
        this.sequencer.setCell(row, step, VELOCITY_OFF as VelocityLevel);
        this.sequencer.setNoteOffsetSilent(row, step, 0);
      }
    }
  }

  /** Play a short preview of the note */
  private previewNote(semitoneOffset: number): void {
    const now = Date.now();
    if (now - this.lastPreviewTime < 50) return;
    this.lastPreviewTime = now;

    const totalPitch = this.sequencer.getPitchOffset(this.currentRow) + semitoneOffset;
    void this.audioEngine.resume();
    this.audioEngine.trigger(this.currentRow, this.audioEngine.ctx.currentTime, 0.5, totalPitch, 0.15);
  }

  /** Highlight the current playback step */
  private updatePlayhead(step: number): void {
    // Clear previous
    if (this.currentPlayStep >= 0) {
      this.clearStepHighlight(this.currentPlayStep);
    }

    this.currentPlayStep = step;

    // Highlight step header
    if (this.stepHeaders[step]) {
      this.stepHeaders[step].classList.add('piano-roll__step-num--playing');
    }

    // Highlight cells in this column
    for (const pitch of this.pitchRows) {
      const cell = this.cellMap.get(`${step},${pitch}`);
      if (cell) cell.classList.add('piano-roll__cell--playing');
    }
  }

  private clearStepHighlight(step: number): void {
    if (this.stepHeaders[step]) {
      this.stepHeaders[step].classList.remove('piano-roll__step-num--playing');
    }
    for (const pitch of this.pitchRows) {
      const cell = this.cellMap.get(`${step},${pitch}`);
      if (cell) cell.classList.remove('piano-roll__cell--playing');
    }
  }

  private clearPlayhead(): void {
    if (this.currentPlayStep >= 0) {
      this.clearStepHighlight(this.currentPlayStep);
      this.currentPlayStep = -1;
    }
  }
}
