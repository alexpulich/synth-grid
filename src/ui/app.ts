import type { Sequencer } from '../sequencer/sequencer';
import type { Transport } from '../sequencer/transport';
import type { AudioEngine } from '../audio/audio-engine';
import { GridUI } from './grid';
import { TransportControls } from './transport-controls';
import { PatternBankUI } from './pattern-bank';
import { EffectsPanel } from './effects-panel';
import { PresetSelector } from './preset-selector';
import { ShareButton } from './share-button';
import { ExportButton } from './export-button';
import { KeyboardShortcuts } from './keyboard-shortcuts';
import { ParticleSystem } from '../visuals/particle-system';
import { WaveformVisualizer } from '../visuals/waveform-visualizer';
import { INSTRUMENTS } from '../audio/instruments';
import { eventBus } from '../utils/event-bus';
import { NUM_ROWS } from '../types';
import { decodeState } from '../state/url-state';

export class AppUI {
  private gridUI: GridUI;
  private particles: ParticleSystem;
  private visualizer: WaveformVisualizer;

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

    // Transport + Pattern bank + extras row
    const controlsRow = document.createElement('div');
    controlsRow.className = 'controls-row';
    new TransportControls(controlsRow, sequencer, transport);
    new PatternBankUI(controlsRow, sequencer);
    new PresetSelector(controlsRow, sequencer);
    new ShareButton(controlsRow, sequencer);
    new ExportButton(controlsRow, sequencer);
    root.appendChild(controlsRow);

    // Grid container (for particle overlay)
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid-container';

    this.gridUI = new GridUI(gridContainer, sequencer);
    this.particles = new ParticleSystem(gridContainer);

    root.appendChild(gridContainer);

    // Effects panel
    new EffectsPanel(root, audioEngine);

    // Waveform visualizer
    this.visualizer = new WaveformVisualizer(root, audioEngine.analyser);

    // Keyboard shortcuts
    new KeyboardShortcuts(transport, sequencer, () => {
      PatternBankUI.doRandomize(sequencer);
    });

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

    // Wake visualizer on play
    eventBus.on('transport:play', () => {
      this.visualizer.wake();
    });

    // Wire transport stop to clear playhead
    eventBus.on('transport:stop', () => {
      this.gridUI.clearPlayhead();
    });

    // Restore state from URL hash (after all UI is constructed)
    const hash = window.location.hash.slice(1);
    if (hash) {
      const state = decodeState(hash);
      if (state) {
        sequencer.loadFullState(state.grids, state.tempo, state.swing, state.activeBank);
      }
    }
  }

  onStepAdvance(step: number): void {
    this.gridUI.highlightStep(step);
    eventBus.emit('step:advance', step);
  }
}
