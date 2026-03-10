import type { AudioEngine } from '../audio/audio-engine';
import type { Sequencer } from '../sequencer/sequencer';
import { Knob } from './knob';
import { DELAY_DIVISIONS } from '../audio/effects/delay';
import { eventBus } from '../utils/event-bus';

export class EffectsPanel {
  private delayDivisionSelect: HTMLSelectElement;
  private reverbMixKnob!: Knob;
  private delayFeedbackKnob!: Knob;
  private delayMixKnob!: Knob;
  private filterFreqKnob!: Knob;
  private filterResKnob!: Knob;
  private satDriveKnob!: Knob;
  private satToneKnob!: Knob;
  private eqLowKnob!: Knob;
  private eqMidKnob!: Knob;
  private eqHighKnob!: Knob;
  private scDepthKnob: Knob | null = null;
  private scRelKnob: Knob | null = null;
  private scToggleBtn: HTMLButtonElement | null = null;

  constructor(parent: HTMLElement, audioEngine: AudioEngine, sequencer?: Sequencer) {
    const container = document.createElement('div');
    container.className = 'effects-panel';

    // Reverb
    const reverbGroup = this.createGroup('Reverb');
    this.reverbMixKnob = new Knob(reverbGroup.knobs, 'Mix', 0.3, (v) => audioEngine.reverb.setMix(v), {
      formatValue: (v) => `${Math.round(v * 100)}%`,
    });
    container.appendChild(reverbGroup.el);

    // Delay (with tempo-synced division selector)
    const delayGroup = this.createGroup('Delay');

    const divSelect = document.createElement('select');
    divSelect.className = 'delay-division-select';
    for (let i = 0; i < DELAY_DIVISIONS.length; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = DELAY_DIVISIONS[i].label;
      divSelect.appendChild(opt);
    }
    divSelect.value = '3'; // default to 1/8
    delayGroup.knobs.appendChild(divSelect);
    this.delayDivisionSelect = divSelect;

    // Set initial tempo-synced delay
    if (sequencer) {
      audioEngine.delay.setTimeFromDivision(sequencer.tempo, DELAY_DIVISIONS[3].mult);
      divSelect.addEventListener('change', () => {
        const idx = Number(divSelect.value);
        audioEngine.delay.setTimeFromDivision(sequencer.tempo, DELAY_DIVISIONS[idx].mult);
      });
      // Sync delay when tempo changes
      eventBus.on('tempo:changed', (bpm) => {
        audioEngine.delay.syncToBpm(bpm);
      });
    }

    this.delayFeedbackKnob = new Knob(delayGroup.knobs, 'Fdbk', 0.35, (v) => audioEngine.delay.setFeedback(v * 0.9), {
      formatValue: (v) => `${Math.round(v * 90)}%`,
    });
    this.delayMixKnob = new Knob(delayGroup.knobs, 'Mix', 0.25, (v) => audioEngine.delay.setMix(v), {
      formatValue: (v) => `${Math.round(v * 100)}%`,
    });
    container.appendChild(delayGroup.el);

    // Filter
    const filterGroup = this.createGroup('Filter');
    this.filterFreqKnob = new Knob(filterGroup.knobs, 'Freq', 1.0, (v) => audioEngine.filter.setFrequency(v), {
      formatValue: (v) => {
        const hz = 20 * Math.pow(1000, v);
        return hz >= 1000 ? `${(hz / 1000).toFixed(1)}kHz` : `${Math.round(hz)}Hz`;
      },
    });
    this.filterResKnob = new Knob(filterGroup.knobs, 'Res', 0, (v) => audioEngine.filter.setResonance(v), {
      formatValue: (v) => `${Math.round(v * 100)}%`,
    });

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

    // Saturation
    const satGroup = this.createGroup('Saturation');
    this.satDriveKnob = new Knob(satGroup.knobs, 'Drive', 0, (v) => audioEngine.saturation.setDrive(v), {
      formatValue: (v) => `${Math.round(v * 100)}%`,
    });
    this.satToneKnob = new Knob(satGroup.knobs, 'Tone', 0.7, (v) => audioEngine.saturation.setTone(v), {
      formatValue: (v) => `${Math.round(v * 100)}%`,
    });
    container.appendChild(satGroup.el);

    // EQ
    const eqGroup = this.createGroup('EQ');
    const eqFormat = { formatValue: (v: number) => {
      const db = Math.round((v - 0.5) * 24);
      return `${db > 0 ? '+' : ''}${db}dB`;
    }};
    this.eqLowKnob = new Knob(eqGroup.knobs, 'Low', 0.5, (v) => audioEngine.eq.setLow(v), eqFormat);
    this.eqMidKnob = new Knob(eqGroup.knobs, 'Mid', 0.5, (v) => audioEngine.eq.setMid(v), eqFormat);
    this.eqHighKnob = new Knob(eqGroup.knobs, 'High', 0.5, (v) => audioEngine.eq.setHigh(v), eqFormat);
    container.appendChild(eqGroup.el);

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

      this.scToggleBtn = toggleBtn;

      this.scDepthKnob = new Knob(scGroup.knobs, 'Depth', 0.7, (v) => {
        sequencer.setSidechain(sequencer.sidechainEnabled, v, sequencer.sidechainRelease);
      }, { formatValue: (v) => `${Math.round(v * 100)}%` });

      this.scRelKnob = new Knob(scGroup.knobs, 'Rel', 0.3, (v) => {
        sequencer.setSidechain(sequencer.sidechainEnabled, sequencer.sidechainDepth, v * 0.5);
      }, { formatValue: (v) => `${Math.round(v * 500)}ms` });

      container.appendChild(scGroup.el);
    }

    parent.appendChild(container);
  }

  getDelayDivisionIndex(): number {
    return Number(this.delayDivisionSelect.value);
  }

  setDelayDivisionIndex(idx: number): void {
    this.delayDivisionSelect.value = String(idx);
  }

  refresh(audioEngine: AudioEngine, sequencer: Sequencer): void {
    this.reverbMixKnob.setValueSilent(audioEngine.reverb.mix);
    this.delayFeedbackKnob.setValueSilent(audioEngine.delay.feedback / 0.9);
    this.delayMixKnob.setValueSilent(audioEngine.delay.mix);
    this.filterFreqKnob.setValueSilent(audioEngine.filter.frequency);
    this.filterResKnob.setValueSilent(audioEngine.filter.resonance);
    this.satDriveKnob.setValueSilent(audioEngine.saturation.drive);
    this.satToneKnob.setValueSilent(audioEngine.saturation.tone);
    this.eqLowKnob.setValueSilent(audioEngine.eq.low);
    this.eqMidKnob.setValueSilent(audioEngine.eq.mid);
    this.eqHighKnob.setValueSilent(audioEngine.eq.high);
    if (this.scDepthKnob) this.scDepthKnob.setValueSilent(sequencer.sidechainDepth);
    if (this.scRelKnob) this.scRelKnob.setValueSilent(sequencer.sidechainRelease / 0.5);
    if (this.scToggleBtn) {
      this.scToggleBtn.textContent = sequencer.sidechainEnabled ? 'ON' : 'OFF';
      this.scToggleBtn.classList.toggle('sidechain-toggle--active', sequencer.sidechainEnabled);
    }
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
