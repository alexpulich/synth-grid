import { NUM_STEPS, AUTOMATION_LABELS, AUTOMATION_COLORS } from '../types';
import type { Sequencer } from '../sequencer/sequencer';
import { eventBus } from '../utils/event-bus';
import { elementAtTouch } from '../utils/touch';

/**
 * Per-row automation lane: collapsible strip showing per-step parameter values.
 *
 * Param indices in the UI:
 *   0 = Volume   (automationData param 0)
 *   1 = Pan      (automationData param 1)
 *   2 = Filter   (reads/writes filterLocks, NOT automationData)
 *   3 = Reverb   (automationData param 2)
 *   4 = Delay    (automationData param 3)
 */

// Map UI param index → automation data param index (-1 = filter locks)
const UI_TO_AUTO_PARAM = [0, 1, -1, 2, 3] as const;

export class AutomationLane {
  readonly container: HTMLElement;
  private bars: HTMLElement[] = []; // length 16
  private steps: HTMLElement[] = [];
  private paramBtns: HTMLElement[] = [];
  private selectedUIParam = 0; // UI param index (0-4)
  private visible = false;
  private isDragging = false;
  private playingStep = -1;

  constructor(
    private row: number,
    private sequencer: Sequencer,
  ) {
    this.container = this.build();
    this.bindEvents();
  }

  private build(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'auto-lane';
    el.dataset.row = String(this.row);

    // Header: spacers to align, then param buttons
    const header = document.createElement('div');
    header.className = 'auto-lane__header';

    // Match the grid row column spacers
    for (const cls of ['label', 'pitch', 'mixer', 'euc', 'piano']) {
      const spacer = document.createElement('span');
      spacer.className = `auto-lane__spacer--${cls}`;
      header.appendChild(spacer);
    }

    // Param selector buttons
    for (let i = 0; i < AUTOMATION_LABELS.length; i++) {
      const btn = document.createElement('button');
      btn.className = 'auto-lane__param-btn';
      btn.textContent = AUTOMATION_LABELS[i];
      btn.dataset.param = String(i);
      btn.style.setProperty('--auto-color', AUTOMATION_COLORS[i]);
      if (i === this.selectedUIParam) {
        btn.classList.add('auto-lane__param-btn--active');
      }
      btn.addEventListener('click', () => this.selectParam(i));
      header.appendChild(btn);
      this.paramBtns[i] = btn;
    }

    el.appendChild(header);

    // Step bars grid
    const grid = document.createElement('div');
    grid.className = 'auto-lane__grid';

    for (let step = 0; step < NUM_STEPS; step++) {
      const stepEl = document.createElement('div');
      stepEl.className = 'auto-lane__step';
      stepEl.dataset.step = String(step);
      if (step % 4 === 0 && step > 0) stepEl.classList.add('auto-lane__step--beat-start');

      const bar = document.createElement('div');
      bar.className = 'auto-lane__bar';
      bar.style.height = '0';
      stepEl.appendChild(bar);

      grid.appendChild(stepEl);
      this.steps[step] = stepEl;
      this.bars[step] = bar;
    }

    el.appendChild(grid);

    return el;
  }

  private bindEvents(): void {
    // Mouse drawing on step bars
    this.container.addEventListener('mousedown', (e) => {
      const stepEl = (e.target as HTMLElement).closest('.auto-lane__step') as HTMLElement | null;
      if (!stepEl || e.button !== 0) return;

      if (e.button === 0 && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        this.isDragging = true;
        this.sequencer.pushHistorySnapshot();
        const step = Number(stepEl.dataset.step);
        const value = this.yToValue(e, stepEl);
        this.applyValue(step, value);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const stepEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.auto-lane__step') as HTMLElement | null;
      if (!stepEl || stepEl.closest('.auto-lane') !== this.container) return;
      const step = Number(stepEl.dataset.step);
      const value = this.yToValue(e, stepEl);
      this.applyValue(step, value);
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch drawing on step bars
    this.container.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const stepEl = elementAtTouch(touch, '.auto-lane__step') as HTMLElement | null;
      if (!stepEl || stepEl.closest('.auto-lane') !== this.container) return;
      e.preventDefault();
      this.isDragging = true;
      this.sequencer.pushHistorySnapshot();
      const step = Number(stepEl.dataset.step);
      const value = this.touchToValue(touch, stepEl);
      this.applyValue(step, value);
    }, { passive: false });

    this.container.addEventListener('touchmove', (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      const stepEl = elementAtTouch(touch, '.auto-lane__step') as HTMLElement | null;
      if (!stepEl || stepEl.closest('.auto-lane') !== this.container) return;
      const step = Number(stepEl.dataset.step);
      const value = this.touchToValue(touch, stepEl);
      this.applyValue(step, value);
    }, { passive: false });

    this.container.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    // Right-click to clear
    this.container.addEventListener('contextmenu', (e) => {
      const stepEl = (e.target as HTMLElement).closest('.auto-lane__step') as HTMLElement | null;
      if (!stepEl) return;
      e.preventDefault();
      const step = Number(stepEl.dataset.step);
      this.clearValue(step);
    });

    // Listen for data changes
    eventBus.on('automation:changed', ({ param, row, step }) => {
      if (row !== this.row) return;
      // Map automationData param to UI param
      const uiParam = this.autoParamToUI(param);
      if (uiParam === this.selectedUIParam) {
        this.refreshBar(step);
      }
    });

    eventBus.on('filterlock:changed', ({ row, step }) => {
      if (row !== this.row || this.selectedUIParam !== 2) return;
      this.refreshBar(step);
    });

    // Refresh on bank change or grid clear
    eventBus.on('bank:changed', () => this.refreshAll());
    eventBus.on('grid:cleared', () => this.refreshAll());

    // Playhead tracking
    eventBus.on('step:advance', (step) => {
      if (this.playingStep >= 0 && this.playingStep < NUM_STEPS) {
        this.steps[this.playingStep].classList.remove('auto-lane__step--playing');
      }
      this.playingStep = step;
      if (step >= 0 && step < NUM_STEPS) {
        this.steps[step].classList.add('auto-lane__step--playing');
      }
    });

    eventBus.on('transport:stop', () => {
      if (this.playingStep >= 0 && this.playingStep < NUM_STEPS) {
        this.steps[this.playingStep].classList.remove('auto-lane__step--playing');
      }
      this.playingStep = -1;
    });
  }

  private selectParam(uiParam: number): void {
    this.selectedUIParam = uiParam;
    for (let i = 0; i < this.paramBtns.length; i++) {
      this.paramBtns[i].classList.toggle('auto-lane__param-btn--active', i === uiParam);
    }
    // Update color on bars
    const color = AUTOMATION_COLORS[uiParam];
    this.container.style.setProperty('--auto-color', color);

    // Update pan display mode
    for (let step = 0; step < NUM_STEPS; step++) {
      this.steps[step].classList.toggle('auto-lane__step--pan', uiParam === 1);
    }

    this.refreshAll();
  }

  private getValue(step: number): number {
    if (this.selectedUIParam === 2) {
      // Filter — reads from filterLocks
      return this.sequencer.getFilterLock(this.row, step);
    }
    const autoParam = UI_TO_AUTO_PARAM[this.selectedUIParam];
    return this.sequencer.getAutomation(autoParam, this.row, step);
  }

  private applyValue(step: number, value: number): void {
    if (this.selectedUIParam === 2) {
      // Filter — writes to filterLocks (setFilterLock pushes history, but we already did pushHistorySnapshot)
      // Use the raw internal access pattern to avoid double-push
      this.sequencer.setFilterLock(this.row, step, value);
    } else {
      const autoParam = UI_TO_AUTO_PARAM[this.selectedUIParam];
      this.sequencer.setAutomationSilent(autoParam, this.row, step, value);
    }
  }

  private clearValue(step: number): void {
    if (this.selectedUIParam === 2) {
      this.sequencer.clearFilterLock(this.row, step);
    } else {
      const autoParam = UI_TO_AUTO_PARAM[this.selectedUIParam];
      this.sequencer.clearAutomation(autoParam, this.row, step);
    }
  }

  private yToValue(e: MouseEvent, stepEl: HTMLElement): number {
    const rect = stepEl.getBoundingClientRect();
    // Bottom = 0, top = 1
    const y = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return Math.round(y * 100) / 100; // 2 decimal precision
  }

  private touchToValue(touch: Touch, stepEl: HTMLElement): number {
    const rect = stepEl.getBoundingClientRect();
    const y = 1 - Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
    return Math.round(y * 100) / 100;
  }

  private refreshBar(step: number): void {
    const value = this.getValue(step);
    const bar = this.bars[step];
    if (isNaN(value)) {
      bar.style.height = '0';
      return;
    }

    if (this.selectedUIParam === 1) {
      // Pan: center-origin display
      // value 0-1 maps to -1..1 pan. 0.5 = center
      const offset = value - 0.5; // -0.5 to 0.5
      const barHeight = Math.abs(offset) * 100; // 0-50%
      bar.style.height = `${barHeight}%`;
      if (offset >= 0) {
        bar.style.top = '';
        bar.style.bottom = '50%';
      } else {
        bar.style.top = '50%';
        bar.style.bottom = '';
      }
    } else {
      bar.style.height = `${value * 100}%`;
      bar.style.top = '';
      bar.style.bottom = '';
    }
  }

  refreshAll(): void {
    for (let step = 0; step < NUM_STEPS; step++) {
      this.refreshBar(step);
    }
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.classList.toggle('auto-lane--visible', this.visible);
    if (this.visible) {
      this.refreshAll();
    }
  }

  setVisible(vis: boolean): void {
    this.visible = vis;
    this.container.classList.toggle('auto-lane--visible', vis);
    if (vis) {
      this.refreshAll();
    }
  }

  private autoParamToUI(autoParam: number): number {
    // autoParam 0=vol, 1=pan, 2=revSend, 3=delSend
    // UI        0=vol, 1=pan, 2=filter, 3=rev, 4=del
    if (autoParam <= 1) return autoParam;
    return autoParam + 1; // 2→3, 3→4
  }
}
