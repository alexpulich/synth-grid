import type { Sequencer } from '../sequencer/sequencer';
import type { AudioEngine } from '../audio/audio-engine';
import type { MidiLearn } from '../midi/midi-learn';
import type { MuteScenes } from '../sequencer/mute-scenes';
import type { MuteSceneData } from '../sequencer/mute-scenes';
import type { Grid, ProbabilityGrid, NoteGrid, SoundParams, MidiCCMapping, SampleMeta } from '../types';
import { eventBus } from '../utils/event-bus';

const STORAGE_KEY = 'synth-grid-state';
const DEBOUNCE_MS = 500;

interface SavedState {
  grids: Grid[];
  probabilities: ProbabilityGrid[];
  pitchOffsets: number[][];
  noteGrids?: NoteGrid[];
  rowVolumes?: number[][];
  rowPans?: number[][];
  selectedScale?: number;
  rootNote?: number;
  sidechainEnabled?: boolean;
  sidechainDepth?: number;
  sidechainRelease?: number;
  filterLocks?: (number | null)[][][]; // NaN → null for JSON
  ratchets?: number[][][];
  conditions?: number[][][];
  soundParams?: SoundParams[];
  saturationDrive?: number;
  saturationTone?: number;
  delayDivision?: number;
  humanize?: number;
  rowSwings?: number[][];
  gates?: number[][][];
  slides?: boolean[][][];
  eqLow?: number;
  eqMid?: number;
  eqHigh?: number;
  midiMappings?: MidiCCMapping[];
  reverbSends?: number[][];
  delaySends?: number[][];
  useSample?: boolean[];
  sampleMetas?: SampleMeta[];
  metronomeEnabled?: boolean;
  muteScenes?: (MuteSceneData | null)[];
  tempo: number;
  swing: number;
  activeBank: number;
}

export class AutoSave {
  private timer: number | null = null;

  constructor(private sequencer: Sequencer, private audioEngine?: AudioEngine, private midiLearn?: MidiLearn, private muteScenes?: MuteScenes) {
    const scheduleSave = () => this.debouncedSave();

    eventBus.on('cell:toggled', scheduleSave);
    eventBus.on('cell:probability-changed', scheduleSave);
    eventBus.on('grid:cleared', scheduleSave);
    eventBus.on('bank:changed', scheduleSave);
    eventBus.on('tempo:changed', scheduleSave);
    eventBus.on('pitch:changed', scheduleSave);
    eventBus.on('note:changed', scheduleSave);
    eventBus.on('volume:changed', scheduleSave);
    eventBus.on('pan:changed', scheduleSave);
    eventBus.on('scale:changed', scheduleSave);
    eventBus.on('sidechain:changed', scheduleSave);
    eventBus.on('filterlock:changed', scheduleSave);
    eventBus.on('ratchet:changed', scheduleSave);
    eventBus.on('condition:changed', scheduleSave);
    eventBus.on('soundparam:changed', scheduleSave);
    eventBus.on('humanize:changed', scheduleSave);
    eventBus.on('swing:changed', scheduleSave);
    eventBus.on('gate:changed', scheduleSave);
    eventBus.on('slide:changed', scheduleSave);
    eventBus.on('midi:mapping-changed', scheduleSave);
    eventBus.on('send:reverb-changed', scheduleSave);
    eventBus.on('send:delay-changed', scheduleSave);
    eventBus.on('sample:loaded', scheduleSave);
    eventBus.on('sample:removed', scheduleSave);
    eventBus.on('sample:meta-changed', scheduleSave);
    eventBus.on('sample:mode-toggled', scheduleSave);
    eventBus.on('metronome:toggled', scheduleSave);
    eventBus.on('mutescene:saved', scheduleSave);
    eventBus.on('step:pasted', scheduleSave);
    eventBus.on('pattern:loaded', scheduleSave);
  }

  private debouncedSave(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = window.setTimeout(() => {
      this.save();
      this.timer = null;
    }, DEBOUNCE_MS);
  }

  private save(): void {
    const state: SavedState = {
      grids: this.sequencer.getAllGrids().map((bank) => bank.map((row) => [...row])),
      probabilities: this.sequencer.getAllProbabilities().map((bank) => bank.map((row) => [...row])),
      pitchOffsets: this.sequencer.getAllPitchOffsets().map((bank) => [...bank]),
      noteGrids: this.sequencer.getAllNoteGrids().map((bank) => bank.map((row) => [...row])),
      rowVolumes: this.sequencer.getAllRowVolumes().map((bank) => [...bank]),
      rowPans: this.sequencer.getAllRowPans().map((bank) => [...bank]),
      selectedScale: this.sequencer.selectedScale,
      rootNote: this.sequencer.rootNote,
      sidechainEnabled: this.sequencer.sidechainEnabled,
      sidechainDepth: this.sequencer.sidechainDepth,
      sidechainRelease: this.sequencer.sidechainRelease,
      filterLocks: this.sequencer.getAllFilterLocks().map((bank) =>
        bank.map((row) => row.map((v) => isNaN(v) ? null : v)),
      ),
      ratchets: this.sequencer.getAllRatchets().map((bank) => bank.map((row) => [...row])),
      conditions: this.sequencer.getAllConditions().map((bank) => bank.map((row) => [...row])),
      soundParams: this.sequencer.getAllSoundParams().map((p) => ({ ...p })),
      humanize: this.sequencer.humanize,
      rowSwings: this.sequencer.getAllRowSwings().map((bank) => [...bank]),
      gates: this.sequencer.getAllGates().map((bank) => bank.map((row) => [...row])),
      slides: this.sequencer.getAllSlides().map((bank) => bank.map((row) => [...row])),
      reverbSends: this.sequencer.getAllReverbSends().map((bank) => [...bank]),
      delaySends: this.sequencer.getAllDelaySends().map((bank) => [...bank]),
      useSample: this.audioEngine ? [...this.audioEngine.useSample] : undefined,
      sampleMetas: this.audioEngine?.sampleEngine.getAllMetas().map((m) => ({ ...m })),
      eqLow: this.audioEngine?.eq.low,
      eqMid: this.audioEngine?.eq.mid,
      eqHigh: this.audioEngine?.eq.high,
      midiMappings: this.midiLearn?.currentMappings,
      metronomeEnabled: this.audioEngine?.metronome.enabled,
      muteScenes: this.muteScenes?.getAllScenes(),
      tempo: this.sequencer.tempo,
      swing: this.sequencer.swing,
      activeBank: this.sequencer.activeBank,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  }

  static load(): SavedState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw) as SavedState;
      if (!state.grids || !Array.isArray(state.grids)) return null;
      return state;
    } catch {
      return null;
    }
  }
}
