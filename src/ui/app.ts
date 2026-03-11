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
import { decodeState } from '../state/url-state';
import { AutoSave } from '../state/local-storage';
import { SampleStorage } from '../state/sample-storage';
import { ScaleSelector } from './scale-selector';
import { DELAY_DIVISIONS } from '../audio/effects/delay';
import { showToast } from './toast';
import { CellTooltip } from './cell-tooltip';
import { MetronomeUI } from './metronome-ui';
import { MuteScenes } from '../sequencer/mute-scenes';
import { MuteScenesUI } from './mute-scenes-ui';
import { PatternLibraryStorage, type PatternData } from '../state/pattern-library-storage';
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
    new CellTooltip(gridContainer, sequencer);

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

    // Help overlay
    const helpOverlay = new HelpOverlay(root);
    helpBtn.addEventListener('click', () => helpOverlay.toggle());

    // Metronome UI (appended to controls row, after TAP)
    const metronomeUI = new MetronomeUI(controlsRow, audioEngine.metronome);

    // Pattern Library
    const patternLibraryStorage = new PatternLibraryStorage();
    const captureSnapshot = (): PatternData => ({
      grids: sequencer.getAllGrids().map(b => b.map(r => [...r])),
      probabilities: sequencer.getAllProbabilities().map(b => b.map(r => [...r])),
      pitchOffsets: sequencer.getAllPitchOffsets().map(b => [...b]),
      noteGrids: sequencer.getAllNoteGrids().map(b => b.map(r => [...r])),
      rowVolumes: sequencer.getAllRowVolumes().map(b => [...b]),
      rowPans: sequencer.getAllRowPans().map(b => [...b]),
      filterLocks: sequencer.getAllFilterLocks().map(b =>
        b.map(r => r.map(v => isNaN(v) ? null : v)),
      ),
      ratchets: sequencer.getAllRatchets().map(b => b.map(r => [...r])),
      conditions: sequencer.getAllConditions().map(b => b.map(r => [...r])),
      gates: sequencer.getAllGates().map(b => b.map(r => [...r])),
      slides: sequencer.getAllSlides().map(b => b.map(r => [...r])),
      rowSwings: sequencer.getAllRowSwings().map(b => [...b]),
      reverbSends: sequencer.getAllReverbSends().map(b => [...b]),
      delaySends: sequencer.getAllDelaySends().map(b => [...b]),
      automationData: sequencer.getAllAutomation().map(bank =>
        bank.map(param =>
          param.map(row => row.map(v => isNaN(v) ? null : v)),
        ),
      ),
      tempo: sequencer.tempo,
      selectedScale: sequencer.selectedScale,
      rootNote: sequencer.rootNote,
      soundParams: sequencer.getAllSoundParams().map(p => ({ ...p })),
      humanize: sequencer.humanize,
      sidechainEnabled: sequencer.sidechainEnabled,
      sidechainDepth: sequencer.sidechainDepth,
      sidechainRelease: sequencer.sidechainRelease,
      saturationDrive: audioEngine.saturation.drive,
      saturationTone: audioEngine.saturation.tone,
      eqLow: audioEngine.eq.low,
      eqMid: audioEngine.eq.mid,
      eqHigh: audioEngine.eq.high,
      delayDivision: effectsPanel.getDelayDivisionIndex(),
    });

    const loadSnapshot = (data: PatternData): void => {
      // Convert null → NaN for filter locks
      const restoredFilterLocks = data.filterLocks.map(b =>
        b.map(r => r.map(v => v === null ? NaN : v)),
      );
      // Convert null → NaN for automation data
      const restoredAutomation = data.automationData?.map(bank =>
        bank.map(param =>
          param.map(row => row.map(v => v === null ? NaN : v)),
        ),
      );
      sequencer.loadFullState(
        data.grids, data.tempo, 0, 0,
        data.probabilities, data.pitchOffsets, data.noteGrids,
        data.rowVolumes, data.rowPans, restoredFilterLocks,
        data.ratchets, data.conditions,
        data.rowSwings, data.gates, data.slides,
        data.reverbSends, data.delaySends,
        restoredAutomation,
      );
      sequencer.setScale(data.selectedScale, data.rootNote);
      sequencer.setSidechain(data.sidechainEnabled, data.sidechainDepth, data.sidechainRelease);
      sequencer.humanize = data.humanize;
      sequencer.loadSoundParams(data.soundParams);
      for (let row = 0; row < NUM_ROWS; row++) {
        audioEngine.soundParams[row] = { ...sequencer.getSoundParams(row) };
      }
      audioEngine.saturation.setDrive(data.saturationDrive);
      audioEngine.saturation.setTone(data.saturationTone);
      audioEngine.eq.setLow(data.eqLow);
      audioEngine.eq.setMid(data.eqMid);
      audioEngine.eq.setHigh(data.eqHigh);
      if (data.delayDivision != null && data.delayDivision < DELAY_DIVISIONS.length) {
        effectsPanel.setDelayDivisionIndex(data.delayDivision);
        audioEngine.delay.setTimeFromDivision(data.tempo, DELAY_DIVISIONS[data.delayDivision].mult);
      }
      effectsPanel.refresh(audioEngine, sequencer);
    };

    const patternLibrary = new PatternLibrary(root, patternLibraryStorage, captureSnapshot, loadSnapshot);

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
    midiLearn.onApply((target, value) => {
      const parts = target.split(':');
      switch (parts[0]) {
        case 'tempo':
          sequencer.tempo = 30 + value * 270;
          break;
        case 'master-volume':
          audioEngine.masterGain.gain.setValueAtTime(value, audioEngine.ctx.currentTime);
          break;
        case 'reverb-mix':
          audioEngine.reverb.setMix(value);
          break;
        case 'delay-feedback':
          audioEngine.delay.setFeedback(value * 0.9);
          break;
        case 'delay-mix':
          audioEngine.delay.setMix(value);
          break;
        case 'filter-cutoff':
          audioEngine.filter.setFrequency(value);
          break;
        case 'filter-resonance':
          audioEngine.filter.setResonance(value);
          break;
        case 'saturation-drive':
          audioEngine.saturation.setDrive(value);
          break;
        case 'eq-low':
          audioEngine.eq.setLow(value);
          break;
        case 'eq-mid':
          audioEngine.eq.setMid(value);
          break;
        case 'eq-high':
          audioEngine.eq.setHigh(value);
          break;
        case 'humanize':
          sequencer.humanize = value;
          break;
        case 'volume': {
          const row = parseInt(parts[1]);
          if (row >= 0 && row < NUM_ROWS) {
            sequencer.setRowVolume(row, value);
            audioEngine.setRowVolume(row, value);
          }
          break;
        }
        case 'pan': {
          const row = parseInt(parts[1]);
          if (row >= 0 && row < NUM_ROWS) {
            const pan = value * 2 - 1; // Map 0-1 to -1..1
            sequencer.setRowPan(row, pan);
            audioEngine.setRowPan(row, pan);
          }
          break;
        }
        case 'reverb-send': {
          const row = parseInt(parts[1]);
          if (row >= 0 && row < NUM_ROWS) {
            sequencer.setReverbSend(row, value);
            audioEngine.setRowReverbSend(row, value);
          }
          break;
        }
        case 'delay-send': {
          const row = parseInt(parts[1]);
          if (row >= 0 && row < NUM_ROWS) {
            sequencer.setDelaySend(row, value);
            audioEngine.setRowDelaySend(row, value);
          }
          break;
        }
      }
    });

    // Initialize MIDI (async, non-blocking)
    midiManager.init().then(() => {
      if (midiOutput && midiManager.midiAccess) {
        midiOutput.init(midiManager.midiAccess);
      }
    });

    // Wire mixer volume/pan/sends to audio engine
    eventBus.on('volume:changed', ({ row, volume }) => {
      audioEngine.setRowVolume(row, volume);
    });
    eventBus.on('pan:changed', ({ row, pan }) => {
      audioEngine.setRowPan(row, pan);
    });
    eventBus.on('send:reverb-changed', ({ row, value }) => {
      audioEngine.setRowReverbSend(row, value);
    });
    eventBus.on('send:delay-changed', ({ row, value }) => {
      audioEngine.setRowDelaySend(row, value);
    });

    // Wire sound params to audio engine
    eventBus.on('soundparam:changed', ({ row, params }) => {
      audioEngine.soundParams[row] = { ...params };
    });

    // Sync mixer to audio engine on bank change
    eventBus.on('bank:changed', () => {
      const volumes = sequencer.getCurrentRowVolumes();
      const pans = sequencer.getCurrentRowPans();
      const reverbSends = sequencer.getCurrentReverbSends();
      const delaySends = sequencer.getCurrentDelaySends();
      for (let row = 0; row < NUM_ROWS; row++) {
        audioEngine.setRowVolume(row, volumes[row]);
        audioEngine.setRowPan(row, pans[row]);
        audioEngine.setRowReverbSend(row, reverbSends[row]);
        audioEngine.setRowDelaySend(row, delaySends[row]);
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

    // Toast notifications for bank queue, copy/paste, and MIDI
    const bankNames = ['A', 'B', 'C', 'D'];
    eventBus.on('bank:queued', (bank) => {
      if (bank !== null) showToast(`Bank ${bankNames[bank]} queued`);
    });
    eventBus.on('bank:copied', (bank) => showToast(`Pattern ${bankNames[bank]} copied`, 'success'));
    eventBus.on('bank:pasted', (bank) => showToast(`Pattern pasted to ${bankNames[bank]}`, 'success'));
    eventBus.on('grid:cleared', () => showToast('Bank cleared'));

    // Resync audio engine on any grid state change (clear, paste, undo, redo)
    // Needed because clearCurrentBank/pasteBank modify sends in sequencer
    // but only emit grid:cleared, not bank:changed
    eventBus.on('grid:cleared', () => {
      const volumes = sequencer.getCurrentRowVolumes();
      const pans = sequencer.getCurrentRowPans();
      const reverbSends = sequencer.getCurrentReverbSends();
      const delaySends = sequencer.getCurrentDelaySends();
      for (let row = 0; row < NUM_ROWS; row++) {
        audioEngine.setRowVolume(row, volumes[row]);
        audioEngine.setRowPan(row, pans[row]);
        audioEngine.setRowReverbSend(row, reverbSends[row]);
        audioEngine.setRowDelaySend(row, delaySends[row]);
      }
    });

    eventBus.on('midi:devices-changed', (devices) => {
      if (devices.length > 0) {
        showToast(`MIDI: ${devices.map((d) => d.name).join(', ')}`);
      }
    });

    // Sample storage (IndexedDB)
    const sampleStorage = new SampleStorage();
    sampleStorage.init();

    // Sample loading
    eventBus.on('sample:load-request', ({ row, file }) => {
      file.arrayBuffer().then(async (arrayBuffer) => {
        try {
          // Check size limit
          const totalSize = await sampleStorage.getTotalSize();
          if (totalSize + arrayBuffer.byteLength > sampleStorage.maxBytes) {
            showToast('Sample storage full (50MB limit)', 'warning');
            return;
          }
          await audioEngine.sampleEngine.loadSample(audioEngine.ctx, row, arrayBuffer, file.name);
          audioEngine.useSample[row] = true;
          eventBus.emit('sample:loaded', { row, filename: file.name });
          eventBus.emit('sample:mode-toggled', { row, useSample: true });
          // Persist to IndexedDB
          const meta = audioEngine.sampleEngine.getMeta(row);
          sampleStorage.saveSample(row, file.name, arrayBuffer, meta.trimStart, meta.trimEnd, meta.loop);
          showToast(`Sample loaded: ${file.name}`, 'success');
        } catch {
          showToast('Failed to load sample', 'warning');
        }
      });
    });

    eventBus.on('sample:removed', ({ row }) => {
      audioEngine.sampleEngine.removeSample(row);
      audioEngine.useSample[row] = false;
      sampleStorage.removeSample(row);
      showToast('Sample removed');
    });

    eventBus.on('sample:mode-toggled', ({ row, useSample }) => {
      audioEngine.useSample[row] = useSample;
    });

    eventBus.on('sample:meta-changed', ({ row, meta }) => {
      // Update IndexedDB with new trim/loop settings
      const buffer = audioEngine.sampleEngine.getBuffer(row);
      if (buffer) {
        // We need the raw ArrayBuffer — re-save with updated meta
        // getBuffer returns AudioBuffer, but we stored the raw ArrayBuffer in IndexedDB
        // Just update the metadata fields via a load+re-save
        sampleStorage.loadSample(row).then((record) => {
          if (record) {
            sampleStorage.saveSample(row, meta.filename, record.arrayBuffer, meta.trimStart, meta.trimEnd, meta.loop);
          }
        });
      }
    });

    // Auto-save (listens for changes)
    new AutoSave(sequencer, audioEngine, midiLearn, muteScenes);

    // Restore state: URL hash takes priority over localStorage
    const hash = window.location.hash.slice(1);
    if (hash) {
      const state = decodeState(hash);
      if (state) {
        sequencer.loadFullState(
          state.grids, state.tempo, state.swing, state.activeBank,
          state.probabilities, state.pitchOffsets, state.noteGrids,
          state.rowVolumes, state.rowPans, undefined, // filterLocks not in URL
          state.ratchets, state.conditions,
          state.rowSwings, state.gates, state.slides,
          state.reverbSends, state.delaySends,
        );
        // V4 extension: restore global state (scale, sidechain, soundParams, humanize)
        if (state.scale != null) {
          sequencer.setScale(state.scale, state.rootNote ?? 0);
        }
        if (state.sidechainEnabled != null) {
          sequencer.setSidechain(state.sidechainEnabled, state.sidechainDepth ?? 0.7, state.sidechainRelease ?? 0.15);
        }
        if (state.soundParams) {
          sequencer.loadSoundParams(state.soundParams);
          for (let row = 0; row < NUM_ROWS; row++) {
            audioEngine.soundParams[row] = { ...sequencer.getSoundParams(row) };
          }
        }
        if (state.humanize != null) {
          sequencer.humanize = state.humanize;
        }
      }
    } else {
      const saved = AutoSave.load();
      if (saved) {
        // Convert null → NaN for filter locks from JSON
        const restoredFilterLocks = saved.filterLocks?.map((bank) =>
          bank.map((row) => row.map((v) => v === null ? NaN : v)),
        );
        // Convert null → NaN for automation data from JSON
        const restoredAutomation = saved.automationData?.map(bank =>
          bank.map(param =>
            param.map(row => row.map(v => v === null ? NaN : v)),
          ),
        );
        sequencer.loadFullState(
          saved.grids, saved.tempo, saved.swing, saved.activeBank,
          saved.probabilities, saved.pitchOffsets, saved.noteGrids,
          saved.rowVolumes, saved.rowPans, restoredFilterLocks,
          saved.ratchets, saved.conditions,
          saved.rowSwings, saved.gates, saved.slides,
          saved.reverbSends, saved.delaySends,
          restoredAutomation,
        );
        // Backward compat: distribute global swing to all rows if no per-row swings saved
        if (!saved.rowSwings && saved.swing > 0) {
          for (let row = 0; row < NUM_ROWS; row++) {
            sequencer.setRowSwing(row, saved.swing);
          }
        }
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
        // Restore humanize
        if (saved.humanize != null) {
          sequencer.humanize = saved.humanize;
        }
        // Restore EQ
        if (saved.eqLow != null) audioEngine.eq.setLow(saved.eqLow);
        if (saved.eqMid != null) audioEngine.eq.setMid(saved.eqMid);
        if (saved.eqHigh != null) audioEngine.eq.setHigh(saved.eqHigh);
        // Restore MIDI CC mappings
        if (saved.midiMappings) {
          midiLearn.loadMappings(saved.midiMappings);
        }
        // Restore sample metadata and useSample flags
        if (saved.sampleMetas) {
          audioEngine.sampleEngine.loadMetas(saved.sampleMetas);
        }
        if (saved.useSample) {
          for (let i = 0; i < NUM_ROWS; i++) {
            audioEngine.useSample[i] = saved.useSample[i] ?? false;
          }
        }
        // Restore metronome state
        if (saved.metronomeEnabled) {
          metronomeUI.setEnabled(true);
        }
        // Restore mute scenes
        if (saved.muteScenes) {
          muteScenes.loadScenes(saved.muteScenes);
        }
        // Restore MIDI output config
        if (saved.midiOutputConfigs) {
          sequencer.loadMidiOutputConfigs(saved.midiOutputConfigs);
        }
        if (saved.midiOutputGlobalEnabled != null) {
          sequencer.midiOutputGlobalEnabled = saved.midiOutputGlobalEnabled;
        }
        if (saved.midiClockMode && midiClock) {
          midiClock.setMode(saved.midiClockMode);
        }
      }
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
    sampleStorage.loadAll().then(async (records) => {
      for (const record of records) {
        try {
          await audioEngine.sampleEngine.loadSample(audioEngine.ctx, record.row, record.arrayBuffer, record.filename);
          // Restore trim/loop from IndexedDB record (may differ from localStorage if updated)
          audioEngine.sampleEngine.setMeta(record.row, {
            trimStart: record.trimStart,
            trimEnd: record.trimEnd,
            loop: record.loop,
          });
          if (audioEngine.useSample[record.row]) {
            eventBus.emit('sample:loaded', { row: record.row, filename: record.filename });
          }
        } catch {
          // Failed to decode — skip silently
        }
      }
    });
  }

  onStepAdvance(step: number): void {
    this.gridUI.highlightStep(step);
    eventBus.emit('step:advance', step);
  }
}
