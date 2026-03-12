import type { Sequencer } from '../sequencer/sequencer';
import type { Transport } from '../sequencer/transport';
import { NUM_ROWS } from '../types';
import { Knob } from './knob';
import { eventBus } from '../utils/event-bus';

export class TransportControls {
  private playBtn: HTMLButtonElement;
  private tempoDisplay: HTMLElement;

  constructor(parent: HTMLElement, private sequencer: Sequencer, private transport: Transport) {
    const container = document.createElement('div');
    container.className = 'transport';

    // Play/stop button
    this.playBtn = document.createElement('button');
    this.playBtn.className = 'transport-play-btn';
    this.playBtn.setAttribute('aria-label', 'Play');
    this.playBtn.appendChild(this.createPlayIcon());
    this.playBtn.addEventListener('click', () => this.transport.toggle());
    container.appendChild(this.playBtn);

    // Tempo section
    const tempoSection = document.createElement('div');
    tempoSection.className = 'transport-tempo';

    this.tempoDisplay = document.createElement('div');
    this.tempoDisplay.className = 'transport-tempo-display';
    this.tempoDisplay.textContent = String(this.sequencer.tempo);
    tempoSection.appendChild(this.tempoDisplay);

    new Knob(tempoSection, 'Tempo', (this.sequencer.tempo - 30) / 270, (v) => {
      this.sequencer.tempo = Math.round(30 + v * 270);
      this.tempoDisplay.textContent = String(this.sequencer.tempo);
    }, { formatValue: (v) => `${Math.round(30 + v * 270)} BPM` });
    container.appendChild(tempoSection);

    // Swing knob (sets all per-row swings)
    new Knob(container, 'Swing', 0, (v) => {
      const swing = v * 0.75;
      for (let r = 0; r < NUM_ROWS; r++) {
        this.sequencer.setRowSwing(r, swing);
      }
    }, { formatValue: (v) => `${Math.round(v * 75)}%` });

    // Humanize knob
    new Knob(container, 'Human', this.sequencer.humanize, (v) => {
      this.sequencer.humanize = v;
    }, { formatValue: (v) => `${Math.round(v * 100)}%` });

    // Tap tempo button
    const tapBtn = document.createElement('button');
    tapBtn.className = 'tap-btn';
    tapBtn.textContent = 'TAP';
    tapBtn.addEventListener('click', () => this.transport.tapTempo());
    container.appendChild(tapBtn);

    parent.appendChild(container);

    // Events
    eventBus.on('transport:play', () => {
      this.playBtn.classList.add('transport-play-btn--playing');
      this.playBtn.setAttribute('aria-label', 'Stop');
      this.playBtn.replaceChildren(this.createStopIcon());
    });

    eventBus.on('transport:stop', () => {
      this.playBtn.classList.remove('transport-play-btn--playing');
      this.playBtn.setAttribute('aria-label', 'Play');
      this.playBtn.replaceChildren(this.createPlayIcon());
    });

    eventBus.on('tempo:changed', (tempo) => {
      this.tempoDisplay.textContent = String(tempo);
    });
  }

  private createPlayIcon(): HTMLElement {
    const icon = document.createElement('div');
    icon.className = 'play-icon';
    return icon;
  }

  private createStopIcon(): HTMLElement {
    const icon = document.createElement('div');
    icon.className = 'stop-icon';
    return icon;
  }
}
