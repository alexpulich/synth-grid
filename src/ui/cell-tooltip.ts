import type { Sequencer } from '../sequencer/sequencer';
import { MELODIC_ROWS, TRIG_CONDITIONS, GATE_LABELS } from '../types';

const HOVER_DELAY = 400;
const VELOCITY_NAMES = ['', 'Soft', 'Med', 'Loud'] as const;

interface BadgeDef {
  label: string;
  getValue: (seq: Sequencer, row: number, step: number) => string;
  isDefault: (seq: Sequencer, row: number, step: number) => boolean;
  melodicOnly?: boolean;
}

const BADGES: BadgeDef[] = [
  {
    label: 'V',
    getValue: (seq, row, step) => VELOCITY_NAMES[seq.getCurrentGrid()[row][step]] as string,
    isDefault: (seq, row, step) => seq.getCurrentGrid()[row][step] === 3,
  },
  {
    label: 'P',
    getValue: (seq, row, step) => `${Math.round(seq.getCurrentProbabilities()[row][step] * 100)}%`,
    isDefault: (seq, row, step) => seq.getCurrentProbabilities()[row][step] >= 1.0,
  },
  {
    label: 'R',
    getValue: (seq, row, step) => `\u00d7${seq.getRatchet(row, step)}`,
    isDefault: (seq, row, step) => seq.getRatchet(row, step) === 1,
  },
  {
    label: 'G',
    getValue: (seq, row, step) => GATE_LABELS[seq.getGate(row, step)],
    isDefault: (seq, row, step) => seq.getGate(row, step) === 1,
  },
  {
    label: 'C',
    getValue: (seq, row, step) => {
      const c = seq.getCondition(row, step);
      return c > 0 ? TRIG_CONDITIONS[c] : '\u2014';
    },
    isDefault: (seq, row, step) => seq.getCondition(row, step) === 0,
  },
  {
    label: 'N',
    getValue: (seq, row, step) => {
      const n = seq.getNoteOffset(row, step);
      return n === 0 ? '0' : (n > 0 ? `+${n}` : `${n}`);
    },
    isDefault: (seq, row, step) => seq.getNoteOffset(row, step) === 0,
    melodicOnly: true,
  },
  {
    label: 'S',
    getValue: (seq, row, step) => seq.getSlide(row, step) ? 'On' : '\u2014',
    isDefault: (seq, row, step) => !seq.getSlide(row, step),
    melodicOnly: true,
  },
  {
    label: 'F',
    getValue: (seq, row, step) => {
      const f = seq.getFilterLock(row, step);
      return isNaN(f) ? '\u2014' : `${Math.round(f * 100)}%`;
    },
    isDefault: (seq, row, step) => isNaN(seq.getFilterLock(row, step)),
  },
];

export class CellTooltip {
  private el: HTMLElement;
  private timer: number | null = null;
  private currentCell: HTMLElement | null = null;
  private hidden = false;
  private badgeEls: { wrap: HTMLElement; valueEl: HTMLElement }[] = [];

  constructor(private gridContainer: HTMLElement, private sequencer: Sequencer) {
    this.el = document.createElement('div');
    this.el.className = 'cell-tooltip';

    // Build badge elements once, reuse on each show
    const badgeRow = document.createElement('div');
    badgeRow.className = 'cell-tooltip__badges';

    for (const badge of BADGES) {
      const wrap = document.createElement('span');
      wrap.className = 'cell-tooltip__badge';

      const labelEl = document.createElement('span');
      labelEl.className = 'cell-tooltip__badge-label';
      labelEl.textContent = badge.label;
      wrap.appendChild(labelEl);

      const valueEl = document.createElement('span');
      valueEl.className = 'cell-tooltip__badge-value';
      wrap.appendChild(valueEl);

      badgeRow.appendChild(wrap);
      this.badgeEls.push({ wrap, valueEl });
    }

    this.el.appendChild(badgeRow);
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

  isVisible(): boolean {
    return this.el.classList.contains('cell-tooltip--visible');
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

    const isMelodic = MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number]);

    // Update badge contents and styling
    for (let i = 0; i < BADGES.length; i++) {
      const badge = BADGES[i];
      const { wrap, valueEl } = this.badgeEls[i];

      // Hide melodic-only badges for non-melodic rows
      if (badge.melodicOnly && !isMelodic) {
        wrap.style.display = 'none';
        continue;
      }
      wrap.style.display = '';

      const value = badge.getValue(this.sequencer, row, step);
      const isDefault = badge.isDefault(this.sequencer, row, step);

      valueEl.textContent = value;
      wrap.classList.toggle('cell-tooltip__badge--custom', !isDefault);
    }

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
