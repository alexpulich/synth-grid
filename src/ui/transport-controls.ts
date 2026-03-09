import type { Sequencer } from '../sequencer/sequencer';
import type { Transport } from '../sequencer/transport';
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
    });
    container.appendChild(tempoSection);

    // Swing knob
    new Knob(container, 'Swing', this.sequencer.swing / 0.5, (v) => {
      this.sequencer.swing = v * 0.5;
    });

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
      this.playBtn.replaceChildren(this.createStopIcon());
    });

    eventBus.on('transport:stop', () => {
      this.playBtn.classList.remove('transport-play-btn--playing');
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
