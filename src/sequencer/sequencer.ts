import { NUM_ROWS, NUM_STEPS, NUM_BANKS } from '../types';
import type { Grid } from '../types';
import { clamp } from '../utils/math';
import { eventBus } from '../utils/event-bus';

export class Sequencer {
  private grids: Grid[];
  private _activeBank = 0;
  private _tempo = 120;
  private _swing = 0;
  private _isPlaying = false;
  private _currentStep = 0;

  constructor() {
    this.grids = Array.from({ length: NUM_BANKS }, () =>
      Array.from({ length: NUM_ROWS }, () => new Array<boolean>(NUM_STEPS).fill(false)),
    );
  }

  toggleCell(row: number, step: number): void {
    const grid = this.grids[this._activeBank];
    grid[row][step] = !grid[row][step];
    eventBus.emit('cell:toggled', { row, step, active: grid[row][step] });
  }

  setBank(bankIndex: number): void {
    this._activeBank = clamp(bankIndex, 0, NUM_BANKS - 1);
    eventBus.emit('bank:changed', this._activeBank);
  }

  getCurrentGrid(): Grid {
    return this.grids[this._activeBank];
  }

  clearCurrentBank(): void {
    this.grids[this._activeBank] = Array.from({ length: NUM_ROWS }, () =>
      new Array<boolean>(NUM_STEPS).fill(false),
    );
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
}
