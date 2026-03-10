import type { AudioEngine } from '../audio/audio-engine';
import type { Sequencer } from '../sequencer/sequencer';
import { Knob } from './knob';

export class EffectsPanel {
  constructor(parent: HTMLElement, audioEngine: AudioEngine, sequencer?: Sequencer) {
    const container = document.createElement('div');
    container.className = 'effects-panel';

    // Reverb
    const reverbGroup = this.createGroup('Reverb');
    new Knob(reverbGroup.knobs, 'Mix', 0.3, (v) => audioEngine.reverb.setMix(v));
    container.appendChild(reverbGroup.el);

    // Delay
    const delayGroup = this.createGroup('Delay');
    new Knob(delayGroup.knobs, 'Time', 0.375 / 2, (v) => audioEngine.delay.setTime(v * 2));
    new Knob(delayGroup.knobs, 'Fdbk', 0.35, (v) => audioEngine.delay.setFeedback(v * 0.9));
    new Knob(delayGroup.knobs, 'Mix', 0.25, (v) => audioEngine.delay.setMix(v));
    container.appendChild(delayGroup.el);

    // Filter
    const filterGroup = this.createGroup('Filter');
    new Knob(filterGroup.knobs, 'Freq', 1.0, (v) => audioEngine.filter.setFrequency(v));
    new Knob(filterGroup.knobs, 'Res', 0, (v) => audioEngine.filter.setResonance(v));

    // Filter type buttons
    const typeRow = document.createElement('div');
    typeRow.style.display = 'flex';
    typeRow.style.gap = '4px';

    const types: BiquadFilterType[] = ['lowpass', 'highpass', 'bandpass'];
    const typeLabels = ['LP', 'HP', 'BP'];
    const typeBtns: HTMLButtonElement[] = [];

    types.forEach((type, i) => {
      const btn = document.createElement('button');
      btn.className = 'filter-type-btn';
      if (i === 0) btn.classList.add('filter-type-btn--active');
      btn.textContent = typeLabels[i];
      btn.addEventListener('click', () => {
        audioEngine.filter.setType(type);
        typeBtns.forEach((b, j) => b.classList.toggle('filter-type-btn--active', j === i));
      });
      typeRow.appendChild(btn);
      typeBtns.push(btn);
    });

    filterGroup.el.appendChild(typeRow);
    container.appendChild(filterGroup.el);

    // Sidechain (requires sequencer)
    if (sequencer) {
      const scGroup = this.createGroup('Sidechain');

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'sidechain-toggle';
      toggleBtn.textContent = 'OFF';
      toggleBtn.addEventListener('click', () => {
        const newEnabled = !sequencer.sidechainEnabled;
        sequencer.setSidechain(newEnabled, sequencer.sidechainDepth, sequencer.sidechainRelease);
        toggleBtn.textContent = newEnabled ? 'ON' : 'OFF';
        toggleBtn.classList.toggle('sidechain-toggle--active', newEnabled);
      });
      scGroup.knobs.appendChild(toggleBtn);

      new Knob(scGroup.knobs, 'Depth', 0.7, (v) => {
        sequencer.setSidechain(sequencer.sidechainEnabled, v, sequencer.sidechainRelease);
      });

      new Knob(scGroup.knobs, 'Rel', 0.3, (v) => {
        sequencer.setSidechain(sequencer.sidechainEnabled, sequencer.sidechainDepth, v * 0.5);
      });

      container.appendChild(scGroup.el);
    }

    parent.appendChild(container);
  }

  private createGroup(title: string): { el: HTMLElement; knobs: HTMLElement } {
    const el = document.createElement('div');
    el.className = 'effect-group';

    const titleEl = document.createElement('div');
    titleEl.className = 'effect-group-title';
    titleEl.textContent = title;
    el.appendChild(titleEl);

    const knobs = document.createElement('div');
    knobs.className = 'effect-knobs';
    el.appendChild(knobs);

    return { el, knobs };
  }
}
