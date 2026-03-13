import type { Sequencer } from '../sequencer/sequencer';
import type { AudioEngine } from '../audio/audio-engine';
import type { MidiLearn } from '../midi/midi-learn';
import type { MidiClock } from '../midi/midi-clock';
import type { MuteScenes } from '../sequencer/mute-scenes';
import type { SampleStorage } from './sample-storage';
import { NUM_ROWS } from '../types';
import { decodeState } from './url-state';
import { AutoSave } from './local-storage';
import { DELAY_DIVISIONS } from '../audio/effects/delay';
import { eventBus } from '../utils/event-bus';

export interface StateRestorerDeps {
  sequencer: Sequencer;
  audioEngine: AudioEngine;
  midiLearn: MidiLearn;
  muteScenes: MuteScenes;
  midiClock?: MidiClock;
  effectsPanel?: { setDelayDivisionIndex(i: number): void };
  metronomeUI?: { setEnabled(e: boolean): void };
}

export interface RestoreResult {
  hadUrlHash: boolean;
}

export function restoreAppState(deps: StateRestorerDeps): RestoreResult {
  const hash = window.location.hash.slice(1);
  if (hash) {
    restoreFromUrl(hash, deps.sequencer, deps.audioEngine);
    return { hadUrlHash: true };
  }

  restoreFromLocalStorage(deps);
  return { hadUrlHash: false };
}

function restoreFromUrl(hash: string, sequencer: Sequencer, audioEngine: AudioEngine): void {
  const state = decodeState(hash);
  if (!state) return;

  sequencer.loadFullState(
    state.grids, state.tempo, state.swing, state.activeBank,
    state.probabilities, state.pitchOffsets, state.noteGrids,
    state.rowVolumes, state.rowPans, undefined, // filterLocks not in URL
    state.ratchets, state.conditions,
    state.rowSwings, state.gates, state.slides,
    state.reverbSends, state.delaySends,
  );

  if (state.scale !== undefined) {
    sequencer.setScale(state.scale, state.rootNote ?? 0);
  }
  if (state.sidechainEnabled !== undefined) {
    sequencer.setSidechain(state.sidechainEnabled, state.sidechainDepth ?? 0.7, state.sidechainRelease ?? 0.15);
  }
  if (state.soundParams) {
    sequencer.loadSoundParams(state.soundParams);
    for (let row = 0; row < NUM_ROWS; row++) {
      audioEngine.soundParams[row] = { ...sequencer.getSoundParams(row) };
    }
  }
  if (state.humanize !== undefined) {
    sequencer.humanize = state.humanize;
  }
}

function restoreFromLocalStorage(deps: StateRestorerDeps): void {
  const { sequencer, audioEngine, midiLearn, muteScenes, midiClock } = deps;
  const saved = AutoSave.load();
  if (!saved) return;

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
    saved.rowLengths,
  );

  // Backward compat: distribute global swing to all rows if no per-row swings saved
  if (!saved.rowSwings && saved.swing > 0) {
    for (let row = 0; row < NUM_ROWS; row++) {
      sequencer.setRowSwing(row, saved.swing);
    }
  }

  if (saved.selectedScale !== undefined) {
    sequencer.setScale(saved.selectedScale, saved.rootNote ?? 0);
  }
  if (saved.sidechainEnabled !== undefined) {
    sequencer.setSidechain(saved.sidechainEnabled, saved.sidechainDepth ?? 0.7, saved.sidechainRelease ?? 0.15);
  }
  if (saved.soundParams) {
    sequencer.loadSoundParams(saved.soundParams);
    for (let row = 0; row < NUM_ROWS; row++) {
      audioEngine.soundParams[row] = { ...sequencer.getSoundParams(row) };
    }
  }

  // Restore saturation
  if (saved.saturationDrive !== undefined) {
    audioEngine.saturation.setDrive(saved.saturationDrive);
  }
  if (saved.saturationTone !== undefined) {
    audioEngine.saturation.setTone(saved.saturationTone);
  }

  // Restore delay division
  if (saved.delayDivision !== undefined && saved.delayDivision < DELAY_DIVISIONS.length) {
    audioEngine.delay.setTimeFromDivision(saved.tempo, DELAY_DIVISIONS[saved.delayDivision].mult);
    deps.effectsPanel?.setDelayDivisionIndex(saved.delayDivision);
  }

  // Restore humanize
  if (saved.humanize !== undefined) {
    sequencer.humanize = saved.humanize;
  }

  // Restore EQ
  if (saved.eqLow !== undefined) audioEngine.eq.setLow(saved.eqLow);
  if (saved.eqMid !== undefined) audioEngine.eq.setMid(saved.eqMid);
  if (saved.eqHigh !== undefined) audioEngine.eq.setHigh(saved.eqHigh);

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
    deps.metronomeUI?.setEnabled(true);
  }

  // Restore mute scenes
  if (saved.muteScenes) {
    muteScenes.loadScenes(saved.muteScenes);
  }

  // Restore MIDI output config
  if (saved.midiOutputConfigs) {
    sequencer.loadMidiOutputConfigs(saved.midiOutputConfigs);
  }
  if (saved.midiOutputGlobalEnabled !== undefined) {
    sequencer.midiOutputGlobalEnabled = saved.midiOutputGlobalEnabled;
  }
  if (saved.midiClockMode && midiClock) {
    midiClock.setMode(saved.midiClockMode);
  }
}

export async function restoreSampleBuffers(storage: SampleStorage, audioEngine: AudioEngine): Promise<void> {
  const records = await storage.loadAll();
  for (const record of records) {
    try {
      await audioEngine.sampleEngine.loadSample(audioEngine.ctx, record.row, record.arrayBuffer, record.filename);
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
}
