import type { Sequencer } from '../sequencer/sequencer';
import type { Grid, ProbabilityGrid, NoteGrid, SoundParams } from '../types';
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
  tempo: number;
  swing: number;
  activeBank: number;
}

export class AutoSave {
  private timer: number | null = null;

  constructor(private sequencer: Sequencer) {
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
