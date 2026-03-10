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
import { ThemeSwitcher } from './theme-switcher';
import { HelpOverlay } from './help-overlay';
import { PatternChainUI } from './pattern-chain-ui';
import { PerformanceFX } from '../audio/performance-fx';
import { PerformanceFXUI } from './performance-fx-ui';
import { ParticleSystem } from '../visuals/particle-system';
import { WaveformVisualizer } from '../visuals/waveform-visualizer';
import { ReactiveBackground } from '../visuals/reactive-background';
import { INSTRUMENTS } from '../audio/instruments';
import { eventBus } from '../utils/event-bus';
import { NUM_ROWS } from '../types';
import { decodeState } from '../state/url-state';
import { AutoSave } from '../state/local-storage';
import { ScaleSelector } from './scale-selector';
import { DELAY_DIVISIONS } from '../audio/effects/delay';

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
    // Audio reactive background (behind everything)
    new ReactiveBackground(root, audioEngine.analyser);

    // Performance FX (audio routing)
    const performanceFX = new PerformanceFX(audioEngine);
    audioEngine.insertPerformanceFX(performanceFX.insertIn, performanceFX.insertOut);

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

    // Help button (top-right)
    const helpBtn = document.createElement('button');
    helpBtn.className = 'help-btn';
    helpBtn.textContent = '?';
    root.appendChild(helpBtn);

    root.appendChild(header);

    // Transport + Pattern bank + extras row
    const controlsRow = document.createElement('div');
    controlsRow.className = 'controls-row';
    new TransportControls(controlsRow, sequencer, transport);
    new PatternBankUI(controlsRow, sequencer);
    new PresetSelector(controlsRow, sequencer);
    new ShareButton(controlsRow, sequencer);
    new ExportButton(controlsRow, sequencer);
    new ScaleSelector(controlsRow, sequencer);
    const themeSwitcher = new ThemeSwitcher(controlsRow);
    root.appendChild(controlsRow);

    // Pattern Chain (Song Mode)
    new PatternChainUI(root, sequencer);

    // Grid container (for particle overlay)
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid-container';

    this.gridUI = new GridUI(gridContainer, sequencer);
    this.particles = new ParticleSystem(gridContainer);

    root.appendChild(gridContainer);

    // Effects panel
    new EffectsPanel(root, audioEngine, sequencer);

    // Performance FX UI
    new PerformanceFXUI(root, performanceFX);

    // Waveform visualizer
    this.visualizer = new WaveformVisualizer(root, audioEngine.analyser);

    // Help overlay
    const helpOverlay = new HelpOverlay(root);
    helpBtn.addEventListener('click', () => helpOverlay.toggle());

    // Keyboard shortcuts
    new KeyboardShortcuts(transport, sequencer, () => {
      PatternBankUI.doRandomize(sequencer);
    }, themeSwitcher, performanceFX, helpOverlay);

    // Wire mixer volume/pan to audio engine
    eventBus.on('volume:changed', ({ row, volume }) => {
      audioEngine.setRowVolume(row, volume);
    });
    eventBus.on('pan:changed', ({ row, pan }) => {
      audioEngine.setRowPan(row, pan);
    });

    // Wire sound params to audio engine
    eventBus.on('soundparam:changed', ({ row, params }) => {
      audioEngine.soundParams[row] = { ...params };
    });

    // Sync mixer to audio engine on bank change
    eventBus.on('bank:changed', () => {
      const volumes = sequencer.getCurrentRowVolumes();
      const pans = sequencer.getCurrentRowPans();
      for (let row = 0; row < NUM_ROWS; row++) {
        audioEngine.setRowVolume(row, volumes[row]);
        audioEngine.setRowPan(row, pans[row]);
      }
    });

    // Wire particle bursts to cell triggers
    eventBus.on('step:advance', (step) => {
      const grid = sequencer.getCurrentGrid();
      for (let row = 0; row < NUM_ROWS; row++) {
        if (grid[row][step] > 0 && sequencer.muteState.isRowAudible(row)) {
          const rect = this.gridUI.getCellRect(row, step);
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

    // Auto-save (listens for changes)
    new AutoSave(sequencer);

    // Restore state: URL hash takes priority over localStorage
    const hash = window.location.hash.slice(1);
    if (hash) {
      const state = decodeState(hash);
      if (state) {
        sequencer.loadFullState(state.grids, state.tempo, state.swing, state.activeBank, state.probabilities);
      }
    } else {
      const saved = AutoSave.load();
      if (saved) {
        // Convert null → NaN for filter locks from JSON
        const restoredFilterLocks = saved.filterLocks?.map((bank) =>
          bank.map((row) => row.map((v) => v === null ? NaN : v)),
        );
        sequencer.loadFullState(
          saved.grids, saved.tempo, saved.swing, saved.activeBank,
          saved.probabilities, saved.pitchOffsets, saved.noteGrids,
          saved.rowVolumes, saved.rowPans, restoredFilterLocks,
          saved.ratchets, saved.conditions,
        );
        if (saved.selectedScale != null) {
          sequencer.setScale(saved.selectedScale, saved.rootNote ?? 0);
        }
        if (saved.sidechainEnabled != null) {
          sequencer.setSidechain(saved.sidechainEnabled, saved.sidechainDepth ?? 0.7, saved.sidechainRelease ?? 0.15);
        }
        // Restore sound params
        if (saved.soundParams) {
          sequencer.loadSoundParams(saved.soundParams);
          for (let row = 0; row < NUM_ROWS; row++) {
            audioEngine.soundParams[row] = { ...sequencer.getSoundParams(row) };
          }
        }
        // Restore saturation
        if (saved.saturationDrive != null) {
          audioEngine.saturation.setDrive(saved.saturationDrive);
        }
        if (saved.saturationTone != null) {
          audioEngine.saturation.setTone(saved.saturationTone);
        }
        // Restore delay division
        if (saved.delayDivision != null && saved.delayDivision < DELAY_DIVISIONS.length) {
          audioEngine.delay.setTimeFromDivision(saved.tempo, DELAY_DIVISIONS[saved.delayDivision].mult);
        }
      }
    }
  }

  onStepAdvance(step: number): void {
    this.gridUI.highlightStep(step);
    eventBus.emit('step:advance', step);
  }
}
