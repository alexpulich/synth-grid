import type { Grid, ProbabilityGrid, NoteGrid, FilterLockGrid, RatchetGrid, ConditionGrid, GateGrid, SlideGrid, AutomationData } from '../types';

export interface HistoryEntry {
  grid: Grid;
  bank: number;
  probabilities: ProbabilityGrid;
  noteGrid: NoteGrid;
  filterLocks: FilterLockGrid;
  ratchets: RatchetGrid;
  conditions: ConditionGrid;
  gates: GateGrid;
  slides: SlideGrid;
  rowVolumes: number[];
  rowPans: number[];
  rowSwings: number[];
  reverbSends: number[];
  delaySends: number[];
  automationData: AutomationData;
  rowLengths: number[];
  pitchOffsets: number[];
}

export class History {
  private stack: HistoryEntry[] = [];
  private pointer = 0;
  private readonly MAX_SIZE = 50;

  push(entry: HistoryEntry): void {
    this.stack = this.stack.slice(0, this.pointer);
    this.stack.push(this.cloneEntry(entry));
    if (this.stack.length > this.MAX_SIZE) {
      this.stack.shift();
    }
    this.pointer = this.stack.length;
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
    return {
      grid: entry.grid.map((row) => [...row]),
      bank: entry.bank,
      probabilities: entry.probabilities.map((row) => [...row]),
      noteGrid: entry.noteGrid.map((row) => [...row]),
      filterLocks: entry.filterLocks.map((row) => [...row]),
      ratchets: entry.ratchets.map((row) => [...row]),
      conditions: entry.conditions.map((row) => [...row]),
      gates: entry.gates.map((row) => [...row]),
      slides: entry.slides.map((row) => [...row]),
      rowVolumes: [...entry.rowVolumes],
      rowPans: [...entry.rowPans],
      rowSwings: [...entry.rowSwings],
      reverbSends: [...entry.reverbSends],
      delaySends: [...entry.delaySends],
      automationData: entry.automationData.map((param) => param.map((row) => [...row])),
      rowLengths: [...entry.rowLengths],
      pitchOffsets: [...entry.pitchOffsets],
    };
  }
}
