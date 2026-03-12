import { VELOCITY_OFF, VELOCITY_SOFT, VELOCITY_LOUD, MELODIC_ROWS, TRIG_CONDITIONS, GATE_LEVELS } from '../types';
import type { VelocityLevel } from '../types';
import type { Sequencer } from '../sequencer/sequencer';
import { eventBus } from '../utils/event-bus';

/**
 * Floating toolbar for touch devices — gives access to cell properties
 * normally reached via modifier+scroll or modifier+right-click.
 *
 * Triggered by tapping an active cell when edit mode is on (FAB toggle).
 */
export class TouchToolbar {
  private el: HTMLElement;
  private visible = false;
  private _editMode = false;
  private currentRow = -1;
  private currentStep = -1;

  constructor(private sequencer: Sequencer) {
    this.el = document.createElement('div');
    this.el.className = 'touch-toolbar';
    this.build();

    // Dismiss on outside touch/click
    document.addEventListener('mousedown', (e) => {
      if (this.visible && !this.el.contains(e.target as Node)) this.hide();
    });
    document.addEventListener('touchstart', (e) => {
      if (this.visible && !this.el.contains(e.target as Node)) this.hide();
    }, { passive: true });

    // Hide when cell gets erased
    eventBus.on('cell:toggled', ({ row, step, velocity }) => {
      if (this.visible && row === this.currentRow && step === this.currentStep && velocity === 0) {
        this.hide();
      }
    });
  }

  get editMode(): boolean { return this._editMode; }

  toggleEditMode(): void {
    this._editMode = !this._editMode;
    if (!this._editMode) this.hide();
  }

  private btnEls: HTMLButtonElement[] = [];

  private build(): void {
    const btns: { label: string; action: () => void }[] = [
      { label: 'Vel', action: () => { this.cycleVelocity(); this.updateLabels(); } },
      { label: 'Prob', action: () => { this.cycleProbability(); this.updateLabels(); } },
      { label: 'Ratch', action: () => { this.cycleRatchet(); this.updateLabels(); } },
      { label: 'Gate', action: () => { this.cycleGate(); this.updateLabels(); } },
      { label: 'Cond', action: () => { this.cycleCondition(); this.updateLabels(); } },
      { label: '\u2013', action: () => { this.adjustNote(-1); this.updateLabels(); } }, // –
      { label: '+', action: () => { this.adjustNote(1); this.updateLabels(); } },
      { label: 'Slide', action: () => { this.toggleSlide(); this.updateLabels(); } },
      { label: '\u2716', action: () => this.deleteCell() }, // ✖
    ];

    for (const { label, action } of btns) {
      const btn = document.createElement('button');
      btn.className = 'touch-toolbar__btn';
      btn.textContent = label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        action();
      });
      this.el.appendChild(btn);
      this.btnEls.push(btn);
    }
  }

  show(row: number, step: number, anchorRect: DOMRect): void {
    this.currentRow = row;
    this.currentStep = step;

    // Show/hide melodic-only buttons (note ±, slide)
    const isMelodic = MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number]);
    const btns = this.el.children;
    // Indices: 5=note-, 6=note+, 7=slide
    for (const idx of [5, 6, 7]) {
      (btns[idx] as HTMLElement).style.display = isMelodic ? '' : 'none';
    }

    if (!this.el.parentElement) {
      document.body.appendChild(this.el);
    }

    this.el.classList.add('touch-toolbar--visible');
    this.visible = true;
    this.updateLabels();

    requestAnimationFrame(() => this.position(anchorRect));
  }

  hide(): void {
    this.el.classList.remove('touch-toolbar--visible');
    this.visible = false;
  }

  private position(anchor: DOMRect): void {
    const rect = this.el.getBoundingClientRect();
    let left = anchor.left + anchor.width / 2 - rect.width / 2;
    let top = anchor.bottom + 6;

    if (top + rect.height > window.innerHeight) {
      top = anchor.top - rect.height - 6;
    }
    if (left + rect.width > window.innerWidth - 8) {
      left = window.innerWidth - rect.width - 8;
    }
    left = Math.max(8, left);
    top = Math.max(8, top);

    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  private updateLabels(): void {
    const r = this.currentRow;
    const s = this.currentStep;

    // Velocity (index 0)
    const vel = this.sequencer.getCurrentGrid()[r][s];
    const velLabels = ['', 'V:Soft', 'V:Med', 'V:Loud'];
    this.btnEls[0].textContent = vel > 0 ? velLabels[vel] : 'Vel';

    // Probability (index 1)
    const prob = this.sequencer.getCurrentProbabilities()[r][s];
    this.btnEls[1].textContent = prob < 1 ? `P:${Math.round(prob * 100)}%` : 'Prob';

    // Ratchet (index 2)
    const ratch = this.sequencer.getRatchet(r, s);
    this.btnEls[2].textContent = ratch > 1 ? `R:\u00d7${ratch}` : 'Ratch';

    // Gate (index 3)
    const gate = this.sequencer.getGate(r, s);
    const gateLabels = ['G:S', 'G:N', 'G:L', 'G:H'];
    this.btnEls[3].textContent = gate !== 1 ? gateLabels[gate] : 'Gate';

    // Condition (index 4)
    const cond = this.sequencer.getCondition(r, s);
    this.btnEls[4].textContent = cond > 0 ? `C:${TRIG_CONDITIONS[cond]}` : 'Cond';

    // Slide (index 7)
    const slide = this.sequencer.getSlide(r, s);
    this.btnEls[7].classList.toggle('touch-toolbar__btn--active', slide);
  }

  private cycleVelocity(): void {
    const grid = this.sequencer.getCurrentGrid();
    const vel = grid[this.currentRow][this.currentStep];
    if (vel === 0) return;
    const next = vel >= VELOCITY_LOUD ? VELOCITY_SOFT : (vel + 1) as VelocityLevel;
    this.sequencer.setCell(this.currentRow, this.currentStep, next);
  }

  private cycleProbability(): void {
    const probs = this.sequencer.getCurrentProbabilities();
    const prob = probs[this.currentRow][this.currentStep];
    const levels = [1.0, 0.75, 0.5, 0.25];
    const idx = levels.indexOf(prob);
    const next = levels[(idx + 1) % levels.length];
    this.sequencer.setProbability(this.currentRow, this.currentStep, next);
  }

  private cycleRatchet(): void {
    const current = this.sequencer.getRatchet(this.currentRow, this.currentStep);
    const next = current >= 4 ? 1 : current + 1;
    this.sequencer.setRatchet(this.currentRow, this.currentStep, next);
  }

  private cycleGate(): void {
    const current = this.sequencer.getGate(this.currentRow, this.currentStep);
    const next = (current + 1) % GATE_LEVELS.length;
    this.sequencer.setGate(this.currentRow, this.currentStep, next);
  }

  private cycleCondition(): void {
    const current = this.sequencer.getCondition(this.currentRow, this.currentStep);
    const next = (current + 1) % TRIG_CONDITIONS.length;
    this.sequencer.setCondition(this.currentRow, this.currentStep, next);
  }

  private adjustNote(delta: number): void {
    if (!MELODIC_ROWS.includes(this.currentRow as typeof MELODIC_ROWS[number])) return;
    const current = this.sequencer.getNoteOffset(this.currentRow, this.currentStep);
    this.sequencer.setNoteOffset(this.currentRow, this.currentStep, current + delta);
  }

  private toggleSlide(): void {
    if (!MELODIC_ROWS.includes(this.currentRow as typeof MELODIC_ROWS[number])) return;
    const current = this.sequencer.getSlide(this.currentRow, this.currentStep);
    this.sequencer.setSlide(this.currentRow, this.currentStep, !current);
  }

  private deleteCell(): void {
    this.sequencer.setCell(this.currentRow, this.currentStep, VELOCITY_OFF as VelocityLevel);
    this.hide();
  }
}
