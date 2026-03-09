import type { Grid, ProbabilityGrid, NoteGrid } from '../types';

export interface HistoryEntry {
  grid: Grid;
  bank: number;
  probabilities?: ProbabilityGrid;
  noteGrid?: NoteGrid;
}

export class History {
  private stack: HistoryEntry[] = [];
  private pointer = -1;
  private readonly MAX_SIZE = 50;

  push(grid: Grid, bank: number, probabilities?: ProbabilityGrid, noteGrid?: NoteGrid): void {
    this.stack = this.stack.slice(0, this.pointer + 1);
    const clone: Grid = grid.map((row) => [...row]);
    const entry: HistoryEntry = { grid: clone, bank };
    if (probabilities) {
      entry.probabilities = probabilities.map((row) => [...row]);
    }
    if (noteGrid) {
      entry.noteGrid = noteGrid.map((row) => [...row]);
    }
    this.stack.push(entry);
    if (this.stack.length > this.MAX_SIZE) {
      this.stack.shift();
    }
    this.pointer = this.stack.length - 1;
  }

  undo(): HistoryEntry | null {
    if (this.pointer <= 0) return null;
    this.pointer--;
    return this.cloneEntry(this.stack[this.pointer]);
  }

  redo(): HistoryEntry | null {
    if (this.pointer >= this.stack.length - 1) return null;
    this.pointer++;
    return this.cloneEntry(this.stack[this.pointer]);
  }

  private cloneEntry(entry: HistoryEntry): HistoryEntry {
    const result: HistoryEntry = { grid: entry.grid.map((row) => [...row]), bank: entry.bank };
    if (entry.probabilities) {
      result.probabilities = entry.probabilities.map((row) => [...row]);
    }
    if (entry.noteGrid) {
      result.noteGrid = entry.noteGrid.map((row) => [...row]);
    }
    return result;
  }
}
