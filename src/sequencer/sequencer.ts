import { NUM_ROWS, NUM_STEPS, NUM_BANKS, VELOCITY_OFF, VELOCITY_LOUD, PROBABILITY_LEVELS, MELODIC_ROWS } from '../types';
import type { Grid, VelocityLevel, ProbabilityGrid, NoteGrid, FilterLockGrid } from '../types';
import { clamp } from '../utils/math';
import { euclidean, rotatePattern } from '../utils/euclidean';
import { eventBus } from '../utils/event-bus';
import { History } from '../state/history';
import { MuteState } from './mute-state';
import { PatternChain } from './pattern-chain';

function createEmptyProbGrid(): ProbabilityGrid {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(1.0));
}

function createEmptyNoteGrid(): NoteGrid {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(0));
}

function createEmptyFilterLockGrid(): FilterLockGrid {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(NaN));
}

export class Sequencer {
  private grids: Grid[];
  private probabilities: ProbabilityGrid[];
  private pitchOffsets: number[][];
  private noteGrids: NoteGrid[];
  private rowVolumes: number[][];
  private rowPans: number[][];
  private filterLocks: FilterLockGrid[];
  private _activeBank = 0;
  private _tempo = 120;
  private _swing = 0;
  private _isPlaying = false;
  private _currentStep = 0;
  private _selectedScale = 0; // index into SCALES (0 = Chromatic)
  private _rootNote = 0; // 0-11 (C through B)
  private _sidechainEnabled = false;
  private _sidechainDepth = 0.7;
  private _sidechainRelease = 0.15;
  private clipboard: { grid: Grid; probabilities: ProbabilityGrid; noteGrid: NoteGrid } | null = null;
  readonly history = new History();
  readonly muteState = new MuteState();
  readonly patternChain = new PatternChain();

  constructor() {
    this.grids = Array.from({ length: NUM_BANKS }, () =>
      Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(VELOCITY_OFF)),
    );
    this.probabilities = Array.from({ length: NUM_BANKS }, () => createEmptyProbGrid());
    this.pitchOffsets = Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0));
    this.noteGrids = Array.from({ length: NUM_BANKS }, () => createEmptyNoteGrid());
    this.rowVolumes = Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0.8));
    this.rowPans = Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0));
    this.filterLocks = Array.from({ length: NUM_BANKS }, () => createEmptyFilterLockGrid());
  }

  private pushHistory(): void {
    this.history.push(
      this.getCurrentGrid(), this._activeBank,
      this.getCurrentProbabilities(), this.getCurrentNoteGrid(),
    );
  }

  toggleCell(row: number, step: number): void {
    this.pushHistory();
    const grid = this.grids[this._activeBank];
    grid[row][step] = grid[row][step] === VELOCITY_OFF ? VELOCITY_LOUD : VELOCITY_OFF;
    eventBus.emit('cell:toggled', { row, step, velocity: grid[row][step] });
  }

  cycleVelocity(row: number, step: number): void {
    this.pushHistory();
    const grid = this.grids[this._activeBank];
    grid[row][step] = ((grid[row][step] + 1) % 4) as VelocityLevel;
    eventBus.emit('cell:toggled', { row, step, velocity: grid[row][step] });
  }

  cycleProbability(row: number, step: number): void {
    this.pushHistory();
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
    this.pushHistory();
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

  getAllPitchOffsets(): number[][] {
    return this.pitchOffsets;
  }

  // Per-step note offsets (melodic rows only)
  getNoteOffset(row: number, step: number): number {
    if (!MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number])) return 0;
    return this.noteGrids[this._activeBank][row][step];
  }

  setNoteOffset(row: number, step: number, semitones: number): void {
    if (!MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number])) return;
    this.pushHistory();
    this.noteGrids[this._activeBank][row][step] = clamp(semitones, -12, 12);
    eventBus.emit('note:changed', { row, step, note: this.noteGrids[this._activeBank][row][step] });
  }

  getCurrentNoteGrid(): NoteGrid {
    return this.noteGrids[this._activeBank];
  }

  getAllNoteGrids(): NoteGrid[] {
    return this.noteGrids;
  }

  // Per-row volume (0-1)
  getRowVolume(row: number): number {
    return this.rowVolumes[this._activeBank][row] ?? 0.8;
  }

  setRowVolume(row: number, volume: number): void {
    this.rowVolumes[this._activeBank][row] = clamp(volume, 0, 1);
    eventBus.emit('volume:changed', { row, volume: this.rowVolumes[this._activeBank][row] });
  }

  getCurrentRowVolumes(): number[] {
    return this.rowVolumes[this._activeBank];
  }

  getAllRowVolumes(): number[][] {
    return this.rowVolumes;
  }

  // Per-row pan (-1 to 1, 0 = center)
  getRowPan(row: number): number {
    return this.rowPans[this._activeBank][row] ?? 0;
  }

  setRowPan(row: number, pan: number): void {
    this.rowPans[this._activeBank][row] = clamp(pan, -1, 1);
    eventBus.emit('pan:changed', { row, pan: this.rowPans[this._activeBank][row] });
  }

  getCurrentRowPans(): number[] {
    return this.rowPans[this._activeBank];
  }

  getAllRowPans(): number[][] {
    return this.rowPans;
  }

  // Scale (global, not per-bank)
  get selectedScale(): number { return this._selectedScale; }
  get rootNote(): number { return this._rootNote; }

  setScale(scaleIndex: number, rootNote: number): void {
    this._selectedScale = clamp(scaleIndex, 0, 6);
    this._rootNote = clamp(rootNote, 0, 11);
    eventBus.emit('scale:changed', { scaleIndex: this._selectedScale, rootNote: this._rootNote });
  }

  // Sidechain
  get sidechainEnabled(): boolean { return this._sidechainEnabled; }
  get sidechainDepth(): number { return this._sidechainDepth; }
  get sidechainRelease(): number { return this._sidechainRelease; }

  setSidechain(enabled: boolean, depth: number, release: number): void {
    this._sidechainEnabled = enabled;
    this._sidechainDepth = clamp(depth, 0, 1);
    this._sidechainRelease = clamp(release, 0.01, 0.5);
    eventBus.emit('sidechain:changed', {
      enabled: this._sidechainEnabled,
      depth: this._sidechainDepth,
      release: this._sidechainRelease,
    });
  }

  // Filter locks (per-step filter automation)
  getFilterLock(row: number, step: number): number {
    return this.filterLocks[this._activeBank][row][step];
  }

  setFilterLock(row: number, step: number, value: number): void {
    this.pushHistory();
    this.filterLocks[this._activeBank][row][step] = clamp(value, 0, 1);
    eventBus.emit('filterlock:changed', { row, step, value: this.filterLocks[this._activeBank][row][step] });
  }

  clearFilterLock(row: number, step: number): void {
    this.pushHistory();
    this.filterLocks[this._activeBank][row][step] = NaN;
    eventBus.emit('filterlock:changed', { row, step, value: NaN });
  }

  getCurrentFilterLocks(): FilterLockGrid {
    return this.filterLocks[this._activeBank];
  }

  getAllFilterLocks(): FilterLockGrid[] {
    return this.filterLocks;
  }

  clearCurrentBank(): void {
    this.pushHistory();
    this.grids[this._activeBank] = Array.from({ length: NUM_ROWS }, () =>
      new Array<number>(NUM_STEPS).fill(VELOCITY_OFF),
    );
    this.probabilities[this._activeBank] = createEmptyProbGrid();
    this.pitchOffsets[this._activeBank] = new Array<number>(NUM_ROWS).fill(0);
    this.noteGrids[this._activeBank] = createEmptyNoteGrid();
    this.rowVolumes[this._activeBank] = new Array<number>(NUM_ROWS).fill(0.8);
    this.rowPans[this._activeBank] = new Array<number>(NUM_ROWS).fill(0);
    this.filterLocks[this._activeBank] = createEmptyFilterLockGrid();
    eventBus.emit('grid:cleared');
  }

  applyEuclidean(row: number, hits: number, rotation: number): void {
    this.pushHistory();
    const pattern = rotatePattern(euclidean(NUM_STEPS, hits), rotation);
    const grid = this.grids[this._activeBank];
    for (let step = 0; step < NUM_STEPS; step++) {
      grid[row][step] = pattern[step] ? VELOCITY_LOUD : VELOCITY_OFF;
    }
    eventBus.emit('grid:cleared');
  }

  copyBank(): void {
    this.clipboard = {
      grid: this.grids[this._activeBank].map((row) => [...row]),
      probabilities: this.probabilities[this._activeBank].map((row) => [...row]),
      noteGrid: this.noteGrids[this._activeBank].map((row) => [...row]),
    };
    eventBus.emit('bank:copied', this._activeBank);
  }

  pasteBank(): void {
    if (!this.clipboard) return;
    this.pushHistory();
    this.grids[this._activeBank] = this.clipboard.grid.map((row) => [...row]);
    this.probabilities[this._activeBank] = this.clipboard.probabilities.map((row) => [...row]);
    this.noteGrids[this._activeBank] = this.clipboard.noteGrid.map((row) => [...row]);
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

  rotateLeft(): void {
    this.pushHistory();
    const grid = this.grids[this._activeBank];
    const probs = this.probabilities[this._activeBank];
    const notes = this.noteGrids[this._activeBank];
    const locks = this.filterLocks[this._activeBank];
    for (let row = 0; row < NUM_ROWS; row++) {
      grid[row].push(grid[row].shift()!);
      probs[row].push(probs[row].shift()!);
      notes[row].push(notes[row].shift()!);
      locks[row].push(locks[row].shift()!);
    }
    eventBus.emit('grid:cleared');
  }

  rotateRight(): void {
    this.pushHistory();
    const grid = this.grids[this._activeBank];
    const probs = this.probabilities[this._activeBank];
    const notes = this.noteGrids[this._activeBank];
    const locks = this.filterLocks[this._activeBank];
    for (let row = 0; row < NUM_ROWS; row++) {
      grid[row].unshift(grid[row].pop()!);
      probs[row].unshift(probs[row].pop()!);
      notes[row].unshift(notes[row].pop()!);
      locks[row].unshift(locks[row].pop()!);
    }
    eventBus.emit('grid:cleared');
  }

  loadGrid(grid: Grid): void {
    this.pushHistory();
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
    pitchOffsets?: number[][],
    noteGrids?: NoteGrid[],
    rowVolumes?: number[][],
    rowPans?: number[][],
    filterLocks?: FilterLockGrid[],
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
      if (pitchOffsets?.[b]) {
        this.pitchOffsets[b] = [...pitchOffsets[b]];
      } else {
        this.pitchOffsets[b] = new Array<number>(NUM_ROWS).fill(0);
      }
      if (noteGrids?.[b]) {
        this.noteGrids[b] = noteGrids[b].map((row) => [...row]);
      } else {
        this.noteGrids[b] = createEmptyNoteGrid();
      }
      if (rowVolumes?.[b]) {
        this.rowVolumes[b] = [...rowVolumes[b]];
      } else {
        this.rowVolumes[b] = new Array<number>(NUM_ROWS).fill(0.8);
      }
      if (rowPans?.[b]) {
        this.rowPans[b] = [...rowPans[b]];
      } else {
        this.rowPans[b] = new Array<number>(NUM_ROWS).fill(0);
      }
      if (filterLocks?.[b]) {
        this.filterLocks[b] = filterLocks[b].map((row) => [...row]);
      } else {
        this.filterLocks[b] = createEmptyFilterLockGrid();
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
    if (entry.noteGrid) {
      this.noteGrids[entry.bank] = entry.noteGrid;
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
    if (entry.noteGrid) {
      this.noteGrids[entry.bank] = entry.noteGrid;
    }
    eventBus.emit('grid:cleared');
  }
}
