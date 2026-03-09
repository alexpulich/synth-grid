import { NUM_ROWS, NUM_STEPS, NUM_BANKS, VELOCITY_OFF, VELOCITY_LOUD, PROBABILITY_LEVELS } from '../types';
import type { Grid, VelocityLevel, ProbabilityGrid } from '../types';
import { clamp } from '../utils/math';
import { eventBus } from '../utils/event-bus';
import { History } from '../state/history';
import { MuteState } from './mute-state';
import { PatternChain } from './pattern-chain';

function createEmptyProbGrid(): ProbabilityGrid {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(1.0));
}

export class Sequencer {
  private grids: Grid[];
  private probabilities: ProbabilityGrid[];
  private pitchOffsets: number[][];
  private _activeBank = 0;
  private _tempo = 120;
  private _swing = 0;
  private _isPlaying = false;
  private _currentStep = 0;
  private clipboard: { grid: Grid; probabilities: ProbabilityGrid } | null = null;
  readonly history = new History();
  readonly muteState = new MuteState();
  readonly patternChain = new PatternChain();

  constructor() {
    this.grids = Array.from({ length: NUM_BANKS }, () =>
      Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(VELOCITY_OFF)),
    );
    this.probabilities = Array.from({ length: NUM_BANKS }, () => createEmptyProbGrid());
    this.pitchOffsets = Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0));
  }

  toggleCell(row: number, step: number): void {
    this.history.push(this.getCurrentGrid(), this._activeBank, this.getCurrentProbabilities());
    const grid = this.grids[this._activeBank];
    grid[row][step] = grid[row][step] === VELOCITY_OFF ? VELOCITY_LOUD : VELOCITY_OFF;
    eventBus.emit('cell:toggled', { row, step, velocity: grid[row][step] });
  }

  cycleVelocity(row: number, step: number): void {
    this.history.push(this.getCurrentGrid(), this._activeBank, this.getCurrentProbabilities());
    const grid = this.grids[this._activeBank];
    grid[row][step] = ((grid[row][step] + 1) % 4) as VelocityLevel;
    eventBus.emit('cell:toggled', { row, step, velocity: grid[row][step] });
  }

  cycleProbability(row: number, step: number): void {
    this.history.push(this.getCurrentGrid(), this._activeBank, this.getCurrentProbabilities());
    const prob = this.probabilities[this._activeBank];
    const current = prob[row][step];
    const idx = PROBABILITY_LEVELS.indexOf(current as typeof PROBABILITY_LEVELS[number]);
    const nextIdx = (idx + 1) % PROBABILITY_LEVELS.length;
    prob[row][step] = PROBABILITY_LEVELS[nextIdx];
    eventBus.emit('cell:probability-changed', { row, step, probability: prob[row][step] });
  }

  setCell(row: number, step: number, velocity: VelocityLevel): void {
    const grid = this.grids[this._activeBank];
    if (grid[row][step] === velocity) return;
    grid[row][step] = velocity;
    eventBus.emit('cell:toggled', { row, step, velocity });
  }

  pushHistorySnapshot(): void {
    this.history.push(this.getCurrentGrid(), this._activeBank, this.getCurrentProbabilities());
  }

  setBank(bankIndex: number): void {
    this._activeBank = clamp(bankIndex, 0, NUM_BANKS - 1);
    eventBus.emit('bank:changed', this._activeBank);
  }

  getCurrentGrid(): Grid {
    return this.grids[this._activeBank];
  }

  getCurrentProbabilities(): ProbabilityGrid {
    return this.probabilities[this._activeBank];
  }

  getAllProbabilities(): ProbabilityGrid[] {
    return this.probabilities;
  }

  getPitchOffset(row: number): number {
    return this.pitchOffsets[this._activeBank][row] ?? 0;
  }

  setPitchOffset(row: number, semitones: number): void {
    this.pitchOffsets[this._activeBank][row] = clamp(semitones, -12, 12);
    eventBus.emit('pitch:changed', { row, offset: this.pitchOffsets[this._activeBank][row] });
  }

  getCurrentPitchOffsets(): number[] {
    return this.pitchOffsets[this._activeBank];
  }

  clearCurrentBank(): void {
    this.history.push(this.getCurrentGrid(), this._activeBank, this.getCurrentProbabilities());
    this.grids[this._activeBank] = Array.from({ length: NUM_ROWS }, () =>
      new Array<number>(NUM_STEPS).fill(VELOCITY_OFF),
    );
    this.probabilities[this._activeBank] = createEmptyProbGrid();
    this.pitchOffsets[this._activeBank] = new Array<number>(NUM_ROWS).fill(0);
    eventBus.emit('grid:cleared');
  }

  copyBank(): void {
    this.clipboard = {
      grid: this.grids[this._activeBank].map((row) => [...row]),
      probabilities: this.probabilities[this._activeBank].map((row) => [...row]),
    };
    eventBus.emit('bank:copied', this._activeBank);
  }

  pasteBank(): void {
    if (!this.clipboard) return;
    this.history.push(this.getCurrentGrid(), this._activeBank, this.getCurrentProbabilities());
    this.grids[this._activeBank] = this.clipboard.grid.map((row) => [...row]);
    this.probabilities[this._activeBank] = this.clipboard.probabilities.map((row) => [...row]);
    eventBus.emit('bank:pasted', this._activeBank);
    eventBus.emit('grid:cleared');
  }

  get tempo(): number { return this._tempo; }
  set tempo(bpm: number) {
    this._tempo = clamp(bpm, 30, 300);
    eventBus.emit('tempo:changed', this._tempo);
  }

  get swing(): number { return this._swing; }
  set swing(val: number) { this._swing = clamp(val, 0, 0.5); }

  get isPlaying(): boolean { return this._isPlaying; }
  set isPlaying(val: boolean) { this._isPlaying = val; }

  get activeBank(): number { return this._activeBank; }

  get currentStep(): number { return this._currentStep; }
  set currentStep(step: number) { this._currentStep = step; }

  loadGrid(grid: Grid): void {
    this.history.push(this.getCurrentGrid(), this._activeBank, this.getCurrentProbabilities());
    this.grids[this._activeBank] = grid.map((row) => [...row]);
    eventBus.emit('grid:cleared');
  }

  getAllGrids(): Grid[] {
    return this.grids;
  }

  loadFullState(
    grids: Grid[],
    tempo: number,
    swing: number,
    activeBank: number,
    probabilities?: ProbabilityGrid[],
  ): void {
    for (let b = 0; b < NUM_BANKS; b++) {
      if (grids[b]) {
        this.grids[b] = grids[b].map((row) => [...row]);
      }
      if (probabilities?.[b]) {
        this.probabilities[b] = probabilities[b].map((row) => [...row]);
      } else {
        this.probabilities[b] = createEmptyProbGrid();
      }
    }
    this._tempo = clamp(tempo, 30, 300);
    this._swing = clamp(swing, 0, 0.5);
    this._activeBank = clamp(activeBank, 0, NUM_BANKS - 1);
    eventBus.emit('tempo:changed', this._tempo);
    eventBus.emit('bank:changed', this._activeBank);
    eventBus.emit('grid:cleared');
  }

  undo(): void {
    const entry = this.history.undo();
    if (!entry) return;
    if (entry.bank !== this._activeBank) {
      this._activeBank = entry.bank;
      eventBus.emit('bank:changed', this._activeBank);
    }
    this.grids[entry.bank] = entry.grid;
    if (entry.probabilities) {
      this.probabilities[entry.bank] = entry.probabilities;
    }
    eventBus.emit('grid:cleared');
  }

  redo(): void {
    const entry = this.history.redo();
    if (!entry) return;
    if (entry.bank !== this._activeBank) {
      this._activeBank = entry.bank;
      eventBus.emit('bank:changed', this._activeBank);
    }
    this.grids[entry.bank] = entry.grid;
    if (entry.probabilities) {
      this.probabilities[entry.bank] = entry.probabilities;
    }
    eventBus.emit('grid:cleared');
  }
}
