import type { Sequencer } from '../sequencer/sequencer';
import type { Transport } from '../sequencer/transport';
import type { AudioEngine } from '../audio/audio-engine';
import type { MidiOutput } from '../midi/midi-output';
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
import { MidiPanel } from './midi-panel';
import { MidiManager } from '../midi/midi-manager';
import { MidiInput } from '../midi/midi-input';
import { MidiLearn } from '../midi/midi-learn';
import { MidiClock } from '../midi/midi-clock';
import { ParticleSystem } from '../visuals/particle-system';
import { WaveformVisualizer } from '../visuals/waveform-visualizer';
import { ReactiveBackground } from '../visuals/reactive-background';
import { INSTRUMENTS } from '../audio/instruments';
import { eventBus } from '../utils/event-bus';
import { NUM_ROWS } from '../types';
import { AutoSave } from '../state/local-storage';
import { SampleStorage } from '../state/sample-storage';
import { restoreAppState, restoreSampleBuffers } from '../state/state-restorer';
import { ScaleSelector } from './scale-selector';
import { createMidiCCRouter } from '../midi/midi-cc-router';
import { captureSnapshot, loadSnapshot } from '../state/pattern-snapshot';
import { wireAudioSync } from '../audio/audio-sync';
import { wireSampleManager } from '../audio/sample-manager';
import { showToast, ensureContainer as ensureToastContainer } from './toast';
import { CellTooltip } from './cell-tooltip';
import { ShortcutHints } from './shortcut-hints';
import { OnboardingTour } from './onboarding-tour';
import { MetronomeUI } from './metronome-ui';
import { MuteScenes } from '../sequencer/mute-scenes';
import { MuteScenesUI } from './mute-scenes-ui';
import { PatternLibraryStorage } from '../state/pattern-library-storage';
import { PatternLibrary } from './pattern-library';
import { FACTORY_PRESETS } from '../data/factory-presets';

export class AppUI {
  private gridUI: GridUI;
  private particles: ParticleSystem;
  private visualizer: WaveformVisualizer;

  constructor(
    root: HTMLElement,
    sequencer: Sequencer,
    transport: Transport,
    audioEngine: AudioEngine,
    midiOutput?: MidiOutput,
  ) {
    // Ensure toast a11y container exists before any toast fires
    ensureToastContainer();

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
    new ExportButton(controlsRow, sequencer, audioEngine);
    new ScaleSelector(controlsRow, sequencer);
    const themeSwitcher = new ThemeSwitcher(controlsRow);
    root.appendChild(controlsRow);

    // Pattern Chain (Song Mode)
    new PatternChainUI(root, sequencer);

    // Grid container (for particle overlay)
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid-container';

    this.gridUI = new GridUI(gridContainer, sequencer, audioEngine);
    this.particles = new ParticleSystem(gridContainer);
    const cellTooltip = new CellTooltip(gridContainer, sequencer);
    new ShortcutHints(gridContainer, cellTooltip);

    root.appendChild(gridContainer);

    // Mute Scenes
    const muteScenes = new MuteScenes();
    const muteScenesUI = new MuteScenesUI(root, muteScenes, sequencer.muteState);

    // Effects panel
    const effectsPanel = new EffectsPanel(root, audioEngine, sequencer);

    // Performance FX UI
    new PerformanceFXUI(root, performanceFX);

    // Waveform visualizer
    this.visualizer = new WaveformVisualizer(root, audioEngine.analyser);

    // Onboarding tour
    const onboardingTour = new OnboardingTour();

    // Help overlay
    const helpOverlay = new HelpOverlay(root, () => {
      helpOverlay.hide();
      onboardingTour.start();
    });
    helpBtn.addEventListener('click', () => helpOverlay.toggle());

    // Metronome UI (appended to controls row, after TAP)
    const metronomeUI = new MetronomeUI(controlsRow, audioEngine.metronome);

    // Pattern Library
    const patternLibraryStorage = new PatternLibraryStorage();
    const patternLibrary = new PatternLibrary(
      root, patternLibraryStorage,
      () => captureSnapshot(sequencer, audioEngine, () => effectsPanel.getDelayDivisionIndex()),
      (data) => { loadSnapshot(data, sequencer, audioEngine, effectsPanel); },
    );

    // Keyboard shortcuts
    const midiLearn = new MidiLearn();
    new KeyboardShortcuts(transport, sequencer, () => {
      PatternBankUI.doRandomize(sequencer);
    }, themeSwitcher, performanceFX, helpOverlay, midiLearn,
       metronomeUI, patternLibrary, muteScenes, muteScenesUI,
       () => this.gridUI.toggleAutomationLanes());

    // MIDI setup
    const midiManager = new MidiManager();
    const midiInput = new MidiInput(audioEngine);
    const midiClock = midiOutput ? new MidiClock(midiOutput, sequencer) : undefined;
    if (midiClock) midiClock.setTransport(transport);
    if (midiOutput) transport.setMidiOutput(midiOutput);
    if (midiClock) transport.setMidiClock(midiClock);
    new MidiPanel(controlsRow, midiManager, midiLearn, midiOutput, midiClock, sequencer);

    midiManager.onNote((note, velocity, channel) => {
      midiInput.handleNote(note, velocity, channel);
    });
    midiManager.onCC((cc, value, channel) => {
      midiLearn.handleCC(cc, value, channel);
    });
    if (midiClock) {
      midiManager.onClock((status) => {
        midiClock.handleClockByte(status);
      });
    }

    // MIDI CC target application
    midiLearn.onApply(createMidiCCRouter(audioEngine, sequencer));

    // Initialize MIDI (async, non-blocking)
    midiManager.init().then(() => {
      if (midiOutput && midiManager.midiAccess) {
        midiOutput.init(midiManager.midiAccess);
      }
    });

    // Wire mixer/sound params/bank sync to audio engine
    wireAudioSync(sequencer, audioEngine);

    // Wire particle bursts to cell triggers (per-row step for polyrhythm)
    eventBus.on('step:advance', (step) => {
      const grid = sequencer.getCurrentGrid();
      const rowLengths = sequencer.getCurrentRowLengths();
      for (let row = 0; row < NUM_ROWS; row++) {
        const rowLen = rowLengths[row] ?? 16;
        const rowStep = step % rowLen;
        if (grid[row][rowStep] > 0 && sequencer.muteState.isRowAudible(row)) {
          const rect = this.gridUI.getCellRect(row, rowStep);
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

    // Toast notifications for bank queue, copy/paste, and MIDI
    const bankNames = ['A', 'B', 'C', 'D'];
    eventBus.on('bank:queued', (bank) => {
      if (bank !== null) showToast(`Bank ${bankNames[bank]} queued`);
    });
    eventBus.on('bank:copied', (bank) => showToast(`Pattern ${bankNames[bank]} copied`, 'success'));
    eventBus.on('bank:pasted', (bank) => showToast(`Pattern pasted to ${bankNames[bank]}`, 'success'));
    eventBus.on('grid:cleared', () => showToast('Bank cleared'));

    eventBus.on('midi:devices-changed', (devices) => {
      if (devices.length > 0) {
        showToast(`MIDI: ${devices.map((d) => d.name).join(', ')}`);
      }
    });

    // Sample storage (IndexedDB) + sample event wiring
    const sampleStorage = new SampleStorage();
    sampleStorage.init();
    wireSampleManager(sampleStorage, audioEngine);

    // Auto-save (listens for changes)
    new AutoSave(sequencer, audioEngine, midiLearn, muteScenes);

    // Restore state: URL hash takes priority over localStorage
    const { hadUrlHash } = restoreAppState({
      sequencer, audioEngine, midiLearn, muteScenes, midiClock,
      effectsPanel: effectsPanel as { setDelayDivisionIndex(i: number): void },
      metronomeUI,
    });

    // Auto-start tour for first-time users (no saved state, no URL hash)
    if (!hadUrlHash && !OnboardingTour.isCompleted()) {
      // Delay slightly so the UI is fully rendered
      setTimeout(() => onboardingTour.start(), 500);
    }

    // Pattern Library storage init + factory presets seeding
    patternLibraryStorage.init().then(async () => {
      const count = await patternLibraryStorage.getCount();
      if (count === 0) {
        for (const preset of FACTORY_PRESETS) {
          await patternLibraryStorage.savePattern({
            id: preset.id,
            name: preset.name,
            createdAt: 0,
            isFactory: true,
            data: preset.data(),
          });
        }
      }
    });

    // Restore sample audio buffers from IndexedDB (async, non-blocking)
    restoreSampleBuffers(sampleStorage, audioEngine);
  }

  onStepAdvance(step: number): void {
    this.gridUI.highlightStep(step);
    eventBus.emit('step:advance', step);
  }
}
