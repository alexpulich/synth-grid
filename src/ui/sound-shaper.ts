import type { Sequencer } from '../sequencer/sequencer';
import { INSTRUMENTS } from '../audio/instruments';
import { Knob } from './knob';

const PARAM_KEYS = ['attack', 'decay', 'tone', 'punch'] as const;
const PARAM_LABELS = ['A', 'D', 'T', 'P'];

export class SoundShaper {
  private el: HTMLElement;
  private knobs: Knob[] = [];
  private currentRow = 0;
  private visible = false;

  constructor(private sequencer: Sequencer) {
    this.el = document.createElement('div');
    this.el.className = 'sound-shaper';
    this.build();

    document.addEventListener('mousedown', (e) => {
      if (this.visible && !this.el.contains(e.target as Node)) {
        this.close();
      }
    });
  }

  private build(): void {
    const titleEl = document.createElement('div');
    titleEl.className = 'sound-shaper-title';
    titleEl.textContent = 'Sound';
    this.el.appendChild(titleEl);

    const knobRow = document.createElement('div');
    knobRow.className = 'sound-shaper-knobs';

    for (let i = 0; i < PARAM_KEYS.length; i++) {
      const key = PARAM_KEYS[i];
      const knob = new Knob(knobRow, PARAM_LABELS[i], 0.5, (v) => {
        this.sequencer.setSoundParam(this.currentRow, key, v);
      });
      this.knobs.push(knob);
    }

    this.el.appendChild(knobRow);
  }

  open(row: number, anchor: HTMLElement): void {
    this.currentRow = row;

    // Load current params into knobs
    const params = this.sequencer.getSoundParams(row);
    for (let i = 0; i < PARAM_KEYS.length; i++) {
      this.knobs[i].setValueSilent(params[PARAM_KEYS[i]]);
    }

    // Update title with instrument name
    const titleEl = this.el.querySelector('.sound-shaper-title') as HTMLElement;
    if (titleEl) {
      titleEl.textContent = INSTRUMENTS[row].name;
      const varName = `--color-${INSTRUMENTS[row].name.toLowerCase()}`;
      titleEl.style.color = `var(${varName})`;
    }

    // Position near anchor
    const rect = anchor.getBoundingClientRect();
    this.el.style.top = `${rect.bottom + 4}px`;
    this.el.style.left = `${rect.left}px`;

    if (!this.el.parentElement) {
      document.body.appendChild(this.el);
    }
    this.el.classList.add('sound-shaper--visible');
    this.visible = true;
  }

  close(): void {
    this.el.classList.remove('sound-shaper--visible');
    this.visible = false;
  }
}
