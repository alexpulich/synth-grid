import type { Sequencer } from '../sequencer/sequencer';
import type { AudioEngine } from '../audio/audio-engine';
import { INSTRUMENTS } from '../audio/instruments';
import { Knob } from './knob';
import { WaveformPreview } from './waveform-preview';
import { eventBus } from '../utils/event-bus';

const PARAM_KEYS = ['attack', 'decay', 'tone', 'punch'] as const;
const PARAM_LABELS = ['A', 'D', 'T', 'P'];

export class SoundShaper {
  private el: HTMLElement;
  private knobs: Knob[] = [];
  private currentRow = 0;
  private visible = false;

  // Dual mode elements
  private titleEl!: HTMLElement;
  private modeBtn!: HTMLButtonElement;
  private synthSection!: HTMLElement;
  private sampleSection!: HTMLElement;
  private waveformPreview!: WaveformPreview;
  private filenameEl!: HTMLElement;
  private loopBtn!: HTMLButtonElement;
  private fileInput!: HTMLInputElement;

  constructor(private sequencer: Sequencer, readonly audioEngine: AudioEngine) {
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
    // Title row with mode toggle
    const titleRow = document.createElement('div');
    titleRow.className = 'sound-shaper-title-row';

    this.titleEl = document.createElement('div');
    this.titleEl.className = 'sound-shaper-title';
    this.titleEl.textContent = 'Sound';
    titleRow.appendChild(this.titleEl);

    this.modeBtn = document.createElement('button');
    this.modeBtn.className = 'sound-shaper-mode-btn';
    this.modeBtn.textContent = 'SYNTH';
    this.modeBtn.addEventListener('click', () => this.toggleMode());
    titleRow.appendChild(this.modeBtn);

    this.el.appendChild(titleRow);

    // Synth section (knobs)
    this.synthSection = document.createElement('div');
    this.synthSection.className = 'sound-shaper-knobs';

    for (let i = 0; i < PARAM_KEYS.length; i++) {
      const key = PARAM_KEYS[i];
      const knob = new Knob(this.synthSection, PARAM_LABELS[i], 0.5, (v) => {
        this.sequencer.setSoundParam(this.currentRow, key, v);
      }, { formatValue: (v) => `${Math.round(v * 100)}%` });
      this.knobs.push(knob);
    }

    this.el.appendChild(this.synthSection);

    // Sample section (waveform + controls)
    this.sampleSection = document.createElement('div');
    this.sampleSection.className = 'sound-shaper-sample-section';
    this.sampleSection.style.display = 'none';

    this.waveformPreview = new WaveformPreview(this.sampleSection, (trimStart, trimEnd) => {
      const meta = this.audioEngine.sampleEngine.getMeta(this.currentRow);
      const updated = { ...meta, trimStart, trimEnd };
      this.audioEngine.sampleEngine.setMeta(this.currentRow, { trimStart, trimEnd });
      eventBus.emit('sample:meta-changed', { row: this.currentRow, meta: updated });
    });

    this.filenameEl = document.createElement('div');
    this.filenameEl.className = 'sound-shaper-filename';
    this.sampleSection.appendChild(this.filenameEl);

    // Controls row: Load, Remove, Loop
    const controlsRow = document.createElement('div');
    controlsRow.className = 'sound-shaper-sample-controls';

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.wav,.mp3,.ogg,.m4a';
    this.fileInput.style.display = 'none';
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      if (file) {
        eventBus.emit('sample:load-request', { row: this.currentRow, file });
        // Refresh after a short delay for decode
        setTimeout(() => this.refreshSampleView(), 300);
      }
      this.fileInput.value = '';
    });
    this.sampleSection.appendChild(this.fileInput);

    const loadBtn = document.createElement('button');
    loadBtn.className = 'sample-load-btn';
    loadBtn.textContent = 'LOAD';
    loadBtn.addEventListener('click', () => this.fileInput.click());
    controlsRow.appendChild(loadBtn);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'sample-remove-btn';
    removeBtn.textContent = 'REMOVE';
    removeBtn.addEventListener('click', () => {
      eventBus.emit('sample:removed', { row: this.currentRow });
      this.refreshSampleView();
    });
    controlsRow.appendChild(removeBtn);

    this.loopBtn = document.createElement('button');
    this.loopBtn.className = 'sample-loop-toggle';
    this.loopBtn.textContent = 'LOOP';
    this.loopBtn.addEventListener('click', () => {
      const meta = this.audioEngine.sampleEngine.getMeta(this.currentRow);
      const newLoop = !meta.loop;
      this.audioEngine.sampleEngine.setMeta(this.currentRow, { loop: newLoop });
      const updated = this.audioEngine.sampleEngine.getMeta(this.currentRow);
      eventBus.emit('sample:meta-changed', { row: this.currentRow, meta: updated });
      this.loopBtn.classList.toggle('sample-loop-toggle--active', newLoop);
    });
    controlsRow.appendChild(this.loopBtn);

    this.sampleSection.appendChild(controlsRow);
    this.el.appendChild(this.sampleSection);
  }

  private toggleMode(): void {
    const isSample = this.audioEngine.useSample[this.currentRow];
    const newMode = !isSample;
    eventBus.emit('sample:mode-toggled', { row: this.currentRow, useSample: newMode });
    this.updateModeView(newMode);
  }

  private updateModeView(isSample: boolean): void {
    if (isSample) {
      this.modeBtn.textContent = 'SAMPLE';
      this.modeBtn.classList.add('sound-shaper-mode-btn--sample');
      this.synthSection.style.display = 'none';
      this.sampleSection.style.display = 'flex';
      this.refreshSampleView();
    } else {
      this.modeBtn.textContent = 'SYNTH';
      this.modeBtn.classList.remove('sound-shaper-mode-btn--sample');
      this.synthSection.style.display = 'flex';
      this.sampleSection.style.display = 'none';
    }
  }

  private refreshSampleView(): void {
    const buffer = this.audioEngine.sampleEngine.getBuffer(this.currentRow);
    const meta = this.audioEngine.sampleEngine.getMeta(this.currentRow);
    this.waveformPreview.setBuffer(buffer, meta);
    this.filenameEl.textContent = meta.filename || 'No sample loaded';
    this.loopBtn.classList.toggle('sample-loop-toggle--active', meta.loop);
  }

  open(row: number, anchor: HTMLElement): void {
    this.currentRow = row;

    // Load current params into knobs
    const params = this.sequencer.getSoundParams(row);
    for (let i = 0; i < PARAM_KEYS.length; i++) {
      this.knobs[i].setValueSilent(params[PARAM_KEYS[i]]);
    }

    // Update title with instrument name
    this.titleEl.textContent = INSTRUMENTS[row].name;
    const varName = `--color-${INSTRUMENTS[row].name.toLowerCase()}`;
    this.titleEl.style.color = `var(${varName})`;

    // Update mode view
    const isSample = this.audioEngine.useSample[row];
    this.updateModeView(isSample);

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
