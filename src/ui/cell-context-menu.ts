import { MELODIC_ROWS } from '../types';
import type { VelocityLevel } from '../types';
import type { Sequencer } from '../sequencer/sequencer';

const VELOCITY_OPTIONS = [
  { value: 1 as VelocityLevel, label: 'Soft' },
  { value: 2 as VelocityLevel, label: 'Med' },
  { value: 3 as VelocityLevel, label: 'Loud' },
];

const PROBABILITY_OPTIONS = [
  { value: 1.0, label: '100%' },
  { value: 0.75, label: '75%' },
  { value: 0.5, label: '50%' },
  { value: 0.25, label: '25%' },
];

const RATCHET_OPTIONS = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 4, label: '4x' },
];

const CONDITION_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Always' },
  { value: 1, label: '1:2' },
  { value: 2, label: '2:2' },
  { value: 3, label: '1:4' },
  { value: 4, label: '3:4' },
  { value: 5, label: '!1' },
];

const GATE_OPTIONS = [
  { value: 0, label: 'Short' },
  { value: 1, label: 'Normal' },
  { value: 2, label: 'Long' },
  { value: 3, label: 'Held' },
];

export class CellContextMenu {
  private el: HTMLElement;
  private visible = false;
  private currentRow = 0;
  private currentStep = 0;

  // Button groups for highlight tracking
  private velocityBtns: HTMLElement[] = [];
  private probBtns: HTMLElement[] = [];
  private ratchetBtns: HTMLElement[] = [];
  private conditionBtns: HTMLElement[] = [];
  private gateBtns: HTMLElement[] = [];

  // Melodic-only sections
  private slideSection: HTMLElement;
  private slideToggle: HTMLElement;
  private noteSection: HTMLElement;
  private noteSlider: HTMLInputElement;
  private noteLabel: HTMLElement;

  // Filter section
  private filterSlider: HTMLInputElement;
  private filterLabel: HTMLElement;
  private filterClearBtn: HTMLElement;

  constructor(private sequencer: Sequencer) {
    this.el = document.createElement('div');
    this.el.className = 'cell-ctx';

    // Build sections
    this.velocityBtns = this.addButtonGroup('Velocity', VELOCITY_OPTIONS, (v) => {
      this.sequencer.setCell(this.currentRow, this.currentStep, v as VelocityLevel);
      this.refreshButtons();
    });

    this.probBtns = this.addButtonGroup('Probability', PROBABILITY_OPTIONS, (v) => {
      this.sequencer.setProbability(this.currentRow, this.currentStep, v);
      this.refreshButtons();
    });

    this.ratchetBtns = this.addButtonGroup('Ratchet', RATCHET_OPTIONS, (v) => {
      this.sequencer.setRatchet(this.currentRow, this.currentStep, v);
      this.refreshButtons();
    });

    this.conditionBtns = this.addButtonGroup('Condition', CONDITION_OPTIONS, (v) => {
      this.sequencer.setCondition(this.currentRow, this.currentStep, v);
      this.refreshButtons();
    });

    this.gateBtns = this.addButtonGroup('Gate', GATE_OPTIONS, (v) => {
      this.sequencer.setGate(this.currentRow, this.currentStep, v);
      this.refreshButtons();
    });

    // Slide toggle (melodic only)
    this.slideSection = this.createSection('Slide');
    this.slideToggle = document.createElement('button');
    this.slideToggle.className = 'cell-ctx__toggle';
    this.slideToggle.textContent = 'Off';
    this.slideToggle.addEventListener('click', () => {
      const current = this.sequencer.getSlide(this.currentRow, this.currentStep);
      this.sequencer.setSlide(this.currentRow, this.currentStep, !current);
      this.refreshButtons();
    });
    this.slideSection.appendChild(this.slideToggle);
    this.el.appendChild(this.slideSection);

    // Note pitch slider (melodic only)
    this.noteSection = this.createSection('Note Pitch');
    const noteRow = document.createElement('div');
    noteRow.className = 'cell-ctx__slider-row';
    this.noteSlider = document.createElement('input');
    this.noteSlider.type = 'range';
    this.noteSlider.className = 'cell-ctx__slider';
    this.noteSlider.min = '-12';
    this.noteSlider.max = '12';
    this.noteSlider.value = '0';
    this.noteSlider.addEventListener('input', () => {
      const val = Number(this.noteSlider.value);
      this.noteLabel.textContent = val > 0 ? `+${val}` : String(val);
      this.sequencer.setNoteOffset(this.currentRow, this.currentStep, val);
    });
    this.noteLabel = document.createElement('span');
    this.noteLabel.className = 'cell-ctx__slider-value';
    this.noteLabel.textContent = '0';
    noteRow.appendChild(this.noteSlider);
    noteRow.appendChild(this.noteLabel);
    this.noteSection.appendChild(noteRow);
    this.el.appendChild(this.noteSection);

    // Filter lock slider
    const filterSection = this.createSection('Filter Lock');
    const filterRow = document.createElement('div');
    filterRow.className = 'cell-ctx__slider-row';
    this.filterSlider = document.createElement('input');
    this.filterSlider.type = 'range';
    this.filterSlider.className = 'cell-ctx__slider';
    this.filterSlider.min = '0';
    this.filterSlider.max = '100';
    this.filterSlider.value = '100';
    this.filterSlider.addEventListener('input', () => {
      const val = Number(this.filterSlider.value) / 100;
      this.filterLabel.textContent = `${Math.round(val * 100)}%`;
      this.sequencer.setFilterLock(this.currentRow, this.currentStep, val);
      this.filterClearBtn.classList.remove('cell-ctx__btn--active');
    });
    this.filterLabel = document.createElement('span');
    this.filterLabel.className = 'cell-ctx__slider-value';
    this.filterLabel.textContent = 'None';
    filterRow.appendChild(this.filterSlider);
    filterRow.appendChild(this.filterLabel);
    filterSection.appendChild(filterRow);

    this.filterClearBtn = document.createElement('button');
    this.filterClearBtn.className = 'cell-ctx__btn cell-ctx__btn--active';
    this.filterClearBtn.textContent = 'Clear';
    this.filterClearBtn.addEventListener('click', () => {
      this.sequencer.clearFilterLock(this.currentRow, this.currentStep);
      this.filterLabel.textContent = 'None';
      this.filterSlider.value = '100';
      this.filterClearBtn.classList.add('cell-ctx__btn--active');
    });
    filterSection.appendChild(this.filterClearBtn);
    this.el.appendChild(filterSection);

    // Close on outside click
    document.addEventListener('mousedown', (e) => {
      if (this.visible && !this.el.contains(e.target as Node)) {
        this.hide();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.visible) {
        this.hide();
      }
    });
  }

  private createSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'cell-ctx__section';
    const label = document.createElement('div');
    label.className = 'cell-ctx__label';
    label.textContent = title;
    section.appendChild(label);
    return section;
  }

  private addButtonGroup(
    title: string,
    options: { value: number; label: string }[],
    onSelect: (value: number) => void,
  ): HTMLElement[] {
    const section = this.createSection(title);
    const group = document.createElement('div');
    group.className = 'cell-ctx__btn-group';
    const btns: HTMLElement[] = [];

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'cell-ctx__btn';
      btn.textContent = opt.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(opt.value);
      });
      group.appendChild(btn);
      btns.push(btn);
    }

    section.appendChild(group);
    this.el.appendChild(section);
    return btns;
  }

  show(row: number, step: number, anchorRect: DOMRect): void {
    this.currentRow = row;
    this.currentStep = step;

    // Show/hide melodic-only sections
    const isMelodic = MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number]);
    this.slideSection.style.display = isMelodic ? '' : 'none';
    this.noteSection.style.display = isMelodic ? '' : 'none';

    this.refreshButtons();

    // Position
    if (!this.el.parentElement) {
      document.body.appendChild(this.el);
    }

    this.el.classList.add('cell-ctx--visible');
    this.visible = true;

    // Position after making visible so we can measure
    requestAnimationFrame(() => this.positionMenu(anchorRect));
  }

  hide(): void {
    this.el.classList.remove('cell-ctx--visible');
    this.visible = false;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private positionMenu(anchorRect: DOMRect): void {
    const menuRect = this.el.getBoundingClientRect();
    let left = anchorRect.right + 4;
    let top = anchorRect.top;

    if (left + menuRect.width > window.innerWidth) {
      left = anchorRect.left - menuRect.width - 4;
    }
    if (left < 8) left = 8;
    if (top + menuRect.height > window.innerHeight) {
      top = window.innerHeight - menuRect.height - 8;
    }
    top = Math.max(8, top);

    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  private refreshButtons(): void {
    const row = this.currentRow;
    const step = this.currentStep;
    const grid = this.sequencer.getCurrentGrid();
    const vel = grid[row][step];
    const prob = this.sequencer.getCurrentProbabilities()[row][step];
    const ratchet = this.sequencer.getRatchet(row, step);
    const cond = this.sequencer.getCondition(row, step);
    const gate = this.sequencer.getGate(row, step);

    // Velocity
    this.velocityBtns.forEach((btn, i) => {
      btn.classList.toggle('cell-ctx__btn--active', VELOCITY_OPTIONS[i].value === vel);
    });

    // Probability
    this.probBtns.forEach((btn, i) => {
      btn.classList.toggle('cell-ctx__btn--active', PROBABILITY_OPTIONS[i].value === prob);
    });

    // Ratchet
    this.ratchetBtns.forEach((btn, i) => {
      btn.classList.toggle('cell-ctx__btn--active', RATCHET_OPTIONS[i].value === ratchet);
    });

    // Condition
    this.conditionBtns.forEach((btn, i) => {
      btn.classList.toggle('cell-ctx__btn--active', CONDITION_OPTIONS[i].value === cond);
    });

    // Gate
    this.gateBtns.forEach((btn, i) => {
      btn.classList.toggle('cell-ctx__btn--active', GATE_OPTIONS[i].value === gate);
    });

    // Slide (melodic only)
    if (MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number])) {
      const slide = this.sequencer.getSlide(row, step);
      this.slideToggle.classList.toggle('cell-ctx__toggle--active', slide);
      this.slideToggle.textContent = slide ? 'On' : 'Off';

      // Note
      const note = this.sequencer.getNoteOffset(row, step);
      this.noteSlider.value = String(note);
      this.noteLabel.textContent = note > 0 ? `+${note}` : String(note);
    }

    // Filter lock
    const filterLock = this.sequencer.getFilterLock(row, step);
    if (isNaN(filterLock)) {
      this.filterSlider.value = '100';
      this.filterLabel.textContent = 'None';
      this.filterClearBtn.classList.add('cell-ctx__btn--active');
    } else {
      this.filterSlider.value = String(Math.round(filterLock * 100));
      this.filterLabel.textContent = `${Math.round(filterLock * 100)}%`;
      this.filterClearBtn.classList.remove('cell-ctx__btn--active');
    }
  }
}
