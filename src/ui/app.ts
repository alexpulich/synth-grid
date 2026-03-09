import type { Sequencer } from '../sequencer/sequencer';
import type { Transport } from '../sequencer/transport';
import type { AudioEngine } from '../audio/audio-engine';
import { GridUI } from './grid';
import { TransportControls } from './transport-controls';
import { PatternBankUI } from './pattern-bank';
import { EffectsPanel } from './effects-panel';
import { ParticleSystem } from '../visuals/particle-system';
import { INSTRUMENTS } from '../audio/instruments';
import { eventBus } from '../utils/event-bus';
import { NUM_ROWS } from '../types';

export class AppUI {
  private gridUI: GridUI;
  private particles: ParticleSystem;

  constructor(
    root: HTMLElement,
    sequencer: Sequencer,
    transport: Transport,
    audioEngine: AudioEngine,
  ) {
    // Header
    const header = document.createElement('div');
    header.className = 'app-header';
    const title = document.createElement('h1');
    title.className = 'app-title';
    title.textContent = 'Synth Grid';
    header.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.className = 'app-subtitle';
    subtitle.textContent = 'Paint beats. Make music.';
    header.appendChild(subtitle);
    root.appendChild(header);

    // Transport + Pattern bank row
    const controlsRow = document.createElement('div');
    controlsRow.className = 'controls-row';
    new TransportControls(controlsRow, sequencer, transport);
    new PatternBankUI(controlsRow, sequencer);
    root.appendChild(controlsRow);

    // Grid container (for particle overlay)
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid-container';

    this.gridUI = new GridUI(gridContainer, sequencer);
    this.particles = new ParticleSystem(gridContainer);

    root.appendChild(gridContainer);

    // Effects panel
    new EffectsPanel(root, audioEngine);

    // Wire particle bursts to cell triggers
    eventBus.on('step:advance', (step) => {
      const s = step as number;
      const grid = sequencer.getCurrentGrid();
      for (let row = 0; row < NUM_ROWS; row++) {
        if (grid[row][s]) {
          const rect = this.gridUI.getCellRect(row, s);
          this.particles.burst(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            INSTRUMENTS[row].color,
          );
        }
      }
    });

    // Wire transport stop to clear playhead
    eventBus.on('transport:stop', () => {
      this.gridUI.clearPlayhead();
    });
  }

  onStepAdvance(step: number): void {
    this.gridUI.highlightStep(step);
    eventBus.emit('step:advance', step);
  }
}
