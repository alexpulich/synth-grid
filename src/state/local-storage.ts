import type { Sequencer } from '../sequencer/sequencer';
import type { Grid, ProbabilityGrid, NoteGrid } from '../types';
import { eventBus } from '../utils/event-bus';

const STORAGE_KEY = 'synth-grid-state';
const DEBOUNCE_MS = 500;

interface SavedState {
  grids: Grid[];
  probabilities: ProbabilityGrid[];
  pitchOffsets: number[][];
  noteGrids?: NoteGrid[];
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
