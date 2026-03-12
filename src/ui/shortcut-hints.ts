import { eventBus } from '../utils/event-bus';
import type { CellTooltip } from './cell-tooltip';

const HINT_DELAY = 800;
const LEARN_THRESHOLD = 3;
const STORAGE_KEY = 'synth-grid-hint-counts';

interface HintDef {
  hints: string;
  trackKeys: string[]; // event-based learning keys
}

const CELL_HINT: HintDef = {
  hints: 'Shift+Click: Velocity \u00b7 Ctrl+Scroll: Ratchet \u00b7 Alt+Scroll: Note \u00b7 Right-click: All options',
  trackKeys: ['velocity-shortcut', 'ratchet-shortcut', 'note-shortcut', 'context-menu'],
};

const LABEL_HINT: HintDef = {
  hints: 'Click: Mute \u00b7 Shift+Click: Solo \u00b7 Dbl-click: Sound Shaper \u00b7 Ctrl+Scroll: Step Length',
  trackKeys: ['mute-shortcut', 'solo-shortcut', 'sound-shaper', 'row-length-shortcut'],
};

export class ShortcutHints {
  private el: HTMLElement;
  private timer: number | null = null;
  private counts: Record<string, number>;
  private playing = false;

  constructor(
    private gridContainer: HTMLElement,
    private cellTooltip: CellTooltip,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'shortcut-hint';
    document.body.appendChild(this.el);

    // Load usage counts
    this.counts = this.loadCounts();

    // Track playback state — hide hints during playback
    eventBus.on('transport:play', () => { this.playing = true; this.hide(); });
    eventBus.on('transport:stop', () => { this.playing = false; });

    // Track feature usage to graduate hints
    eventBus.on('ratchet:changed', () => this.increment('ratchet-shortcut'));
    eventBus.on('note:changed', () => this.increment('note-shortcut'));
    eventBus.on('mute:changed', () => this.increment('mute-shortcut'));
    eventBus.on('rowlength:changed', () => this.increment('row-length-shortcut'));
    eventBus.on('soundparam:changed', () => this.increment('sound-shaper'));

    // Mouse events on grid container
    this.gridContainer.addEventListener('mouseover', this.onMouseOver);
    this.gridContainer.addEventListener('mouseout', this.onMouseOut);
  }

  private onMouseOver = (e: MouseEvent): void => {
    if (this.playing) return;

    const target = e.target as HTMLElement;
    const cell = target.closest('.grid-cell') as HTMLElement | null;
    const label = target.closest('.grid-row-label') as HTMLElement | null;

    if (cell) {
      // Only show for active cells
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      if (row >= 0 && step >= 0) {
        this.scheduleHint(cell, CELL_HINT);
      }
    } else if (label) {
      this.scheduleHint(label, LABEL_HINT);
    }
  };

  private onMouseOut = (e: MouseEvent): void => {
    const related = e.relatedTarget as HTMLElement | null;
    if (related?.closest('.grid-cell') || related?.closest('.grid-row-label')) return;
    this.cancelTimer();
    this.hide();
  };

  private scheduleHint(target: HTMLElement, def: HintDef): void {
    this.cancelTimer();

    // Don't show if all tracked shortcuts have been learned
    const allLearned = def.trackKeys.every(k => (this.counts[k] ?? 0) >= LEARN_THRESHOLD);
    if (allLearned) return;

    this.timer = window.setTimeout(() => {
      // Don't show if cell tooltip is already visible
      if (this.cellTooltip.isVisible()) return;
      if (this.playing) return;

      this.show(target, def.hints);
    }, HINT_DELAY);
  }

  private show(target: HTMLElement, text: string): void {
    // Build content without innerHTML
    while (this.el.firstChild) this.el.removeChild(this.el.firstChild);
    const span = document.createElement('span');
    span.textContent = text;
    this.el.appendChild(span);

    const rect = target.getBoundingClientRect();
    this.el.style.left = `${rect.left + rect.width / 2}px`;
    this.el.style.top = `${rect.bottom + 6}px`;
    this.el.classList.add('shortcut-hint--visible');
  }

  private hide(): void {
    this.el.classList.remove('shortcut-hint--visible');
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private increment(key: string): void {
    this.counts[key] = (this.counts[key] ?? 0) + 1;
    this.saveCounts();
  }

  private loadCounts(): Record<string, number> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveCounts(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.counts));
    } catch { /* quota exceeded — ignore */ }
  }
}
