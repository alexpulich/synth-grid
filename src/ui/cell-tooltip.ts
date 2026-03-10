import type { Sequencer } from '../sequencer/sequencer';
import { MELODIC_ROWS, TRIG_CONDITIONS, GATE_LABELS } from '../types';

const HOVER_DELAY = 400;
const VELOCITY_NAMES = ['', 'Soft', 'Med', 'Loud'] as const;

export class CellTooltip {
  private el: HTMLElement;
  private timer: number | null = null;
  private currentCell: HTMLElement | null = null;
  private hidden = false;

  constructor(private gridContainer: HTMLElement, private sequencer: Sequencer) {
    this.el = document.createElement('div');
    this.el.className = 'cell-tooltip';
    document.body.appendChild(this.el);

    this.gridContainer.addEventListener('mouseover', this.onMouseOver);
    this.gridContainer.addEventListener('mouseout', this.onMouseOut);

    // Hide tooltip when context menu opens
    this.gridContainer.addEventListener('contextmenu', () => {
      this.cancelTimer();
      this.hide();
      this.hidden = true;
    });

    // Re-enable after a short delay
    document.addEventListener('mousedown', () => {
      this.hidden = false;
    });
  }

  private onMouseOver = (e: MouseEvent): void => {
    if (this.hidden) return;
    const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
    if (!cell) return;
    if (cell === this.currentCell) return;

    this.cancelTimer();
    this.hide();
    this.currentCell = cell;

    this.timer = window.setTimeout(() => {
      this.show(cell);
    }, HOVER_DELAY);
  };

  private onMouseOut = (e: MouseEvent): void => {
    const related = (e.relatedTarget as HTMLElement | null)?.closest?.('.grid-cell') as HTMLElement | null;
    if (related === this.currentCell) return;

    this.cancelTimer();
    this.hide();
    this.currentCell = null;
  };

  private show(cell: HTMLElement): void {
    const row = Number(cell.dataset.row);
    const step = Number(cell.dataset.step);
    const grid = this.sequencer.getCurrentGrid();
    const vel = grid[row][step];

    if (vel === 0) {
      this.hide();
      return;
    }

    const parts: string[] = [];

    // Velocity (default is 3/Loud — show if different)
    if (vel !== 3) parts.push(`Vel: ${VELOCITY_NAMES[vel]}`);

    // Probability (default is 1.0)
    const prob = this.sequencer.getCurrentProbabilities()[row][step];
    if (prob < 1.0) parts.push(`Prob: ${Math.round(prob * 100)}%`);

    // Ratchet (default is 1)
    const ratchet = this.sequencer.getRatchet(row, step);
    if (ratchet > 1) parts.push(`${ratchet}x`);

    // Gate (default is 1/Normal)
    const gate = this.sequencer.getGate(row, step);
    if (gate !== 1) parts.push(`Gate: ${GATE_LABELS[gate]}`);

    // Condition (default is 0/Always)
    const cond = this.sequencer.getCondition(row, step);
    if (cond > 0) parts.push(`Cond: ${TRIG_CONDITIONS[cond]}`);

    // Melodic row extras
    if (MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number])) {
      const note = this.sequencer.getNoteOffset(row, step);
      if (note !== 0) parts.push(`Note: ${note > 0 ? '+' : ''}${note}`);

      const slide = this.sequencer.getSlide(row, step);
      if (slide) parts.push('Slide');
    }

    // Filter lock (default is NaN)
    const filterLock = this.sequencer.getFilterLock(row, step);
    if (!isNaN(filterLock)) parts.push(`Filt: ${Math.round(filterLock * 100)}%`);

    if (parts.length === 0) {
      this.hide();
      return;
    }

    // Build content (no innerHTML)
    while (this.el.firstChild) this.el.removeChild(this.el.firstChild);
    const text = document.createElement('span');
    text.textContent = parts.join(' \u00b7 ');
    this.el.appendChild(text);

    // Position above cell
    const rect = cell.getBoundingClientRect();
    this.el.style.left = `${rect.left + rect.width / 2}px`;
    this.el.style.top = `${rect.top - 4}px`;
    this.el.classList.add('cell-tooltip--visible');
  }

  private hide(): void {
    this.el.classList.remove('cell-tooltip--visible');
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
