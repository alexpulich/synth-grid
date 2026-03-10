import type { Metronome } from '../audio/metronome';
import { Knob } from './knob';
import { eventBus } from '../utils/event-bus';

export class MetronomeUI {
  private toggleBtn: HTMLButtonElement;
  private dots: HTMLElement[] = [];

  constructor(parent: HTMLElement, private readonly metronome: Metronome) {
    const container = document.createElement('div');
    container.className = 'metronome';

    // Toggle button
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.className = 'metronome-toggle';
    this.toggleBtn.textContent = 'Click';
    this.toggleBtn.addEventListener('click', () => this.toggle());
    container.appendChild(this.toggleBtn);

    // Beat indicator dots
    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'metronome-dots';
    for (let i = 0; i < 4; i++) {
      const dot = document.createElement('div');
      dot.className = 'metronome-dot';
      dotsContainer.appendChild(dot);
      this.dots.push(dot);
    }
    container.appendChild(dotsContainer);

    // Volume knob
    new Knob(container, 'Vol', metronome.volume, (v) => {
      metronome.setVolume(v);
    }, { formatValue: (v) => `${Math.round(v * 100)}%` });

    parent.appendChild(container);

    // Events
    eventBus.on('metronome:beat', (beat) => {
      this.dots.forEach((dot, i) => {
        dot.classList.toggle('metronome-dot--active', i === beat);
      });
    });

    eventBus.on('transport:stop', () => {
      this.dots.forEach((dot) => dot.classList.remove('metronome-dot--active'));
    });
  }

  toggle(): void {
    const enabled = !this.metronome.enabled;
    this.metronome.setEnabled(enabled);
    this.toggleBtn.classList.toggle('metronome-toggle--active', enabled);
    eventBus.emit('metronome:toggled', enabled);
  }

  setEnabled(enabled: boolean): void {
    this.metronome.setEnabled(enabled);
    this.toggleBtn.classList.toggle('metronome-toggle--active', enabled);
  }
}
