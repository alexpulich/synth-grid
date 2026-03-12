import { NUM_ROWS, VELOCITY_OFF, VELOCITY_LOUD, MELODIC_ROWS, TRIG_CONDITIONS, GATE_LEVELS } from '../types';
import type { VelocityLevel } from '../types';
import type { Sequencer } from '../sequencer/sequencer';
import { SCALES, scaleDegreesToSemitones, semitonesToScaleDegree } from '../utils/scales';
import type { CellContextMenu } from './cell-context-menu';
import type { SoundShaper } from './sound-shaper';
import type { TouchToolbar } from './touch-toolbar';
import { elementAtTouch } from '../utils/touch';

export class GridEventManager {
  // Drag paint state
  private isDragging = false;
  private dragMode: 'paint' | 'erase' = 'paint';
  private draggedCells = new Set<string>();

  // Touch long-press state
  private longPressTimer: number | null = null;
  private touchStartPos = { x: 0, y: 0 };

  // Keyboard grid navigation state
  private focusedRow = -1;
  private focusedStep = -1;
  private gridFocused = false;

  constructor(
    private container: HTMLElement,
    private cells: HTMLElement[][],
    private sequencer: Sequencer,
    private cellContextMenu: CellContextMenu,
    private soundShaper: SoundShaper,
    private touchToolbar: TouchToolbar,
  ) {
    this.bind();
  }

  private bind(): void {
    // Double-click on label: open sound shaper
    this.container.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('grid-row-label')) {
        const row = Number(target.dataset.row);
        this.soundShaper.open(row, target);
      }
    });

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

      // Alt+Click: toggle slide (melodic rows only, active cells only)
      if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const grid = this.sequencer.getCurrentGrid();
        if (MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number]) && grid[row][step] > 0) {
          const current = this.sequencer.getSlide(row, step);
          this.sequencer.setSlide(row, step, !current);
        }
        return;
      }

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

    // Right-click: open context menu (plain), modifier+right-click: quick shortcuts
    this.container.addEventListener('contextmenu', (e) => {
      const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;
      e.preventDefault();
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      if (e.altKey) {
        const grid = this.sequencer.getCurrentGrid();
        if (grid[row][step] > 0) {
          const current = this.sequencer.getGate(row, step);
          this.sequencer.setGate(row, step, (current + 1) % GATE_LEVELS.length);
        }
      } else if (e.ctrlKey || e.metaKey) {
        const current = this.sequencer.getCondition(row, step);
        this.sequencer.setCondition(row, step, (current + 1) % TRIG_CONDITIONS.length);
      } else if (e.shiftKey) {
        this.sequencer.clearFilterLock(row, step);
      } else {
        const grid = this.sequencer.getCurrentGrid();
        if (grid[row][step] > 0) {
          const rect = cell.getBoundingClientRect();
          this.cellContextMenu.show(row, step, rect);
        }
      }
    });

    // Ctrl+scroll on active cells: set ratchet count
    this.container.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      const grid = this.sequencer.getCurrentGrid();
      if (grid[row][step] === VELOCITY_OFF) return;
      e.preventDefault();
      const current = this.sequencer.getRatchet(row, step);
      const delta = e.deltaY < 0 ? 1 : -1;
      let next = current + delta;
      if (next > 4) next = 1;
      if (next < 1) next = 4;
      this.sequencer.setRatchet(row, step, next);
    });

    // Shift+scroll on active cells: set filter lock
    this.container.addEventListener('wheel', (e) => {
      if (!e.shiftKey || e.altKey) return;
      const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      const grid = this.sequencer.getCurrentGrid();
      if (grid[row][step] === VELOCITY_OFF) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const current = this.sequencer.getFilterLock(row, step);
      const base = isNaN(current) ? 1.0 : current;
      this.sequencer.setFilterLock(row, step, base + delta);
    });

    // Alt+scroll on active melodic cells: change per-step note (scale-aware)
    this.container.addEventListener('wheel', (e) => {
      if (!e.altKey) return;
      const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      if (!MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number])) return;
      const grid = this.sequencer.getCurrentGrid();
      if (grid[row][step] === VELOCITY_OFF) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      const current = this.sequencer.getNoteOffset(row, step);
      const scale = SCALES[this.sequencer.selectedScale];
      if (scale.intervals.length === 12) {
        this.sequencer.setNoteOffset(row, step, current + delta);
      } else {
        const degree = semitonesToScaleDegree(scale, current);
        const newSemitones = scaleDegreesToSemitones(scale, degree + delta);
        this.sequencer.setNoteOffset(row, step, newSemitones);
      }
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

    // === Touch support ===

    // Touch paint: touchstart on cells
    this.container.addEventListener('touchstart', (e) => {
      const target = e.target as HTMLElement;

      if (target.classList.contains('grid-row-label')) return;

      const cell = target.closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;

      e.preventDefault();
      const touch = e.touches[0];
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);

      // Start long-press detection
      this.touchStartPos = { x: touch.clientX, y: touch.clientY };
      if (this.longPressTimer !== null) clearTimeout(this.longPressTimer);
      this.longPressTimer = window.setTimeout(() => {
        this.longPressTimer = null;
        const grid = this.sequencer.getCurrentGrid();
        if (grid[row][step] > 0) {
          this.isDragging = false;
          navigator.vibrate?.(50);
          const rect = cell.getBoundingClientRect();
          this.cellContextMenu.show(row, step, rect);
        }
      }, 500);

      // Touch toolbar edit mode
      if (this.touchToolbar.editMode) {
        const grid = this.sequencer.getCurrentGrid();
        if (grid[row][step] > 0) {
          if (this.longPressTimer !== null) clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
          const rect = cell.getBoundingClientRect();
          this.touchToolbar.show(row, step, rect);
          return;
        }
      }

      // Start drag paint
      const grid = this.sequencer.getCurrentGrid();
      this.isDragging = true;
      this.dragMode = grid[row][step] > 0 ? 'erase' : 'paint';
      this.draggedCells.clear();
      this.sequencer.pushHistorySnapshot();
      this.applyDrag(row, step);
    }, { passive: false });

    // Touch paint: touchmove for drag paint
    this.container.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];

      // Cancel long-press if finger moved > 10px
      if (this.longPressTimer !== null) {
        const dx = touch.clientX - this.touchStartPos.x;
        const dy = touch.clientY - this.touchStartPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      }

      if (!this.isDragging) return;
      e.preventDefault();

      const cell = elementAtTouch(touch, '.grid-cell');
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      this.applyDrag(row, step);
    }, { passive: false });

    // Touch paint: touchend
    document.addEventListener('touchend', () => {
      if (this.longPressTimer !== null) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      this.isDragging = false;
      this.draggedCells.clear();
    });

    // Keyboard grid navigation
    this.container.addEventListener('focus', () => {
      if (this.focusedRow < 0) {
        this.focusedRow = 0;
        this.focusedStep = 0;
      }
      this.gridFocused = true;
      this.updateFocusVisual();
    });

    this.container.addEventListener('blur', () => {
      this.gridFocused = false;
      this.clearFocusVisual();
    });

    this.container.addEventListener('keydown', (e) => this.handleGridKeydown(e));
  }

  private applyDrag(row: number, step: number): void {
    if (step >= this.sequencer.getRowLength(row)) return;
    const key = `${row},${step}`;
    if (this.draggedCells.has(key)) return;
    this.draggedCells.add(key);

    const vel: VelocityLevel = this.dragMode === 'paint' ? VELOCITY_LOUD : VELOCITY_OFF;
    this.sequencer.setCell(row, step, vel);
  }

  private handleGridKeydown(e: KeyboardEvent): void {
    if (!this.gridFocused || this.focusedRow < 0) return;
    const r = this.focusedRow;
    const s = this.focusedStep;

    // Shift+Arrow: cycle velocity on focused cell
    if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      e.stopPropagation();
      this.sequencer.cycleVelocity(r, s);
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        e.stopPropagation();
        this.moveFocus(r, Math.min(s + 1, this.sequencer.getRowLength(r) - 1));
        break;
      case 'ArrowLeft':
        e.preventDefault();
        e.stopPropagation();
        this.moveFocus(r, Math.max(s - 1, 0));
        break;
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        this.moveFocus(Math.min(r + 1, NUM_ROWS - 1), s);
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        this.moveFocus(Math.max(r - 1, 0), s);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        e.stopPropagation();
        this.sequencer.toggleCell(r, s);
        break;
      case 'Escape':
        e.preventDefault();
        this.container.blur();
        break;
      default:
        return;
    }
  }

  private moveFocus(row: number, step: number): void {
    this.clearFocusVisual();
    this.focusedRow = row;
    this.focusedStep = step;
    this.updateFocusVisual();
  }

  private updateFocusVisual(): void {
    if (this.focusedRow < 0 || !this.gridFocused) return;
    const cell = this.cells[this.focusedRow]?.[this.focusedStep];
    if (cell) {
      cell.classList.add('grid-cell--focused');
    }
  }

  private clearFocusVisual(): void {
    if (this.focusedRow >= 0 && this.focusedStep >= 0) {
      const cell = this.cells[this.focusedRow]?.[this.focusedStep];
      cell?.classList.remove('grid-cell--focused');
    }
  }
}
