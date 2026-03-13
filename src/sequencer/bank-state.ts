import { NUM_ROWS, NUM_STEPS, NUM_BANKS, NUM_AUTO_PARAMS, VELOCITY_OFF } from '../types';
import type { Grid, ProbabilityGrid, NoteGrid, FilterLockGrid, RatchetGrid, ConditionGrid, GateGrid, SlideGrid, AutomationData } from '../types';
import type { HistoryEntry } from '../state/history';

// ── Factory functions ──

export function createEmptyGrid(): Grid {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(VELOCITY_OFF));
}

export function createEmptyProbGrid(): ProbabilityGrid {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(1.0));
}

export function createEmptyNoteGrid(): NoteGrid {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(0));
}

export function createEmptyFilterLockGrid(): FilterLockGrid {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(NaN));
}

export function createEmptyRatchetGrid(): RatchetGrid {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(1));
}

export function createEmptyConditionGrid(): ConditionGrid {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(0));
}

export function createEmptyGateGrid(): GateGrid {
  return Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(1));
}

export function createEmptySlideGrid(): SlideGrid {
  return Array.from({ length: NUM_ROWS }, () => new Array<boolean>(NUM_STEPS).fill(false));
}

export function createEmptyAutomationData(): AutomationData {
  return Array.from({ length: NUM_AUTO_PARAMS }, () =>
    Array.from({ length: NUM_ROWS }, () => new Array<number>(NUM_STEPS).fill(NaN)),
  );
}

// ── BankStateManager ──

/**
 * Manages all 16 per-bank data layers for the sequencer.
 * Each layer is an array of NUM_BANKS entries.
 */
export class BankStateManager {
  readonly grids: Grid[];
  readonly probabilities: ProbabilityGrid[];
  readonly pitchOffsets: number[][];
  readonly noteGrids: NoteGrid[];
  readonly rowVolumes: number[][];
  readonly rowPans: number[][];
  readonly filterLocks: FilterLockGrid[];
  readonly ratchets: RatchetGrid[];
  readonly conditions: ConditionGrid[];
  readonly gates: GateGrid[];
  readonly slides: SlideGrid[];
  readonly rowSwings: number[][];
  readonly reverbSends: number[][];
  readonly delaySends: number[][];
  readonly automationData: AutomationData[];
  readonly rowLengths: number[][];

  constructor() {
    this.grids = Array.from({ length: NUM_BANKS }, () => createEmptyGrid());
    this.probabilities = Array.from({ length: NUM_BANKS }, () => createEmptyProbGrid());
    this.pitchOffsets = Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0));
    this.noteGrids = Array.from({ length: NUM_BANKS }, () => createEmptyNoteGrid());
    this.rowVolumes = Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0.8));
    this.rowPans = Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0));
    this.filterLocks = Array.from({ length: NUM_BANKS }, () => createEmptyFilterLockGrid());
    this.ratchets = Array.from({ length: NUM_BANKS }, () => createEmptyRatchetGrid());
    this.conditions = Array.from({ length: NUM_BANKS }, () => createEmptyConditionGrid());
    this.gates = Array.from({ length: NUM_BANKS }, () => createEmptyGateGrid());
    this.slides = Array.from({ length: NUM_BANKS }, () => createEmptySlideGrid());
    this.rowSwings = Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0));
    this.reverbSends = Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0.3));
    this.delaySends = Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(0.25));
    this.automationData = Array.from({ length: NUM_BANKS }, () => createEmptyAutomationData());
    this.rowLengths = Array.from({ length: NUM_BANKS }, () => new Array<number>(NUM_ROWS).fill(NUM_STEPS));
  }

  /** Capture a snapshot of a single bank for history */
  captureEntry(bank: number): HistoryEntry {
    return {
      grid: this.grids[bank],
      bank,
      probabilities: this.probabilities[bank],
      noteGrid: this.noteGrids[bank],
      filterLocks: this.filterLocks[bank],
      ratchets: this.ratchets[bank],
      conditions: this.conditions[bank],
      gates: this.gates[bank],
      slides: this.slides[bank],
      rowVolumes: this.rowVolumes[bank],
      rowPans: this.rowPans[bank],
      rowSwings: this.rowSwings[bank],
      reverbSends: this.reverbSends[bank],
      delaySends: this.delaySends[bank],
      automationData: this.automationData[bank],
      rowLengths: this.rowLengths[bank],
      pitchOffsets: this.pitchOffsets[bank],
    };
  }

  /** Restore a history entry into its bank */
  restoreEntry(entry: HistoryEntry): void {
    const b = entry.bank;
    this.grids[b] = entry.grid;
    this.probabilities[b] = entry.probabilities;
    this.noteGrids[b] = entry.noteGrid;
    this.filterLocks[b] = entry.filterLocks;
    this.ratchets[b] = entry.ratchets;
    this.conditions[b] = entry.conditions;
    this.gates[b] = entry.gates;
    this.slides[b] = entry.slides;
    this.rowVolumes[b] = entry.rowVolumes;
    this.rowPans[b] = entry.rowPans;
    this.rowSwings[b] = entry.rowSwings;
    this.reverbSends[b] = entry.reverbSends;
    this.delaySends[b] = entry.delaySends;
    this.automationData[b] = entry.automationData;
    this.rowLengths[b] = entry.rowLengths;
    this.pitchOffsets[b] = entry.pitchOffsets;
  }

  /** Reset a bank to empty defaults */
  clearBank(bank: number): void {
    this.grids[bank] = createEmptyGrid();
    this.probabilities[bank] = createEmptyProbGrid();
    this.pitchOffsets[bank] = new Array<number>(NUM_ROWS).fill(0);
    this.noteGrids[bank] = createEmptyNoteGrid();
    this.rowVolumes[bank] = new Array<number>(NUM_ROWS).fill(0.8);
    this.rowPans[bank] = new Array<number>(NUM_ROWS).fill(0);
    this.filterLocks[bank] = createEmptyFilterLockGrid();
    this.ratchets[bank] = createEmptyRatchetGrid();
    this.conditions[bank] = createEmptyConditionGrid();
    this.gates[bank] = createEmptyGateGrid();
    this.slides[bank] = createEmptySlideGrid();
    this.rowSwings[bank] = new Array<number>(NUM_ROWS).fill(0);
    this.reverbSends[bank] = new Array<number>(NUM_ROWS).fill(0.3);
    this.delaySends[bank] = new Array<number>(NUM_ROWS).fill(0.25);
    this.automationData[bank] = createEmptyAutomationData();
    this.rowLengths[bank] = new Array<number>(NUM_STEPS).fill(NUM_STEPS);
  }

  /** Load full state for all banks (used by loadFullState) */
  loadAllBanks(data: {
    grids: Grid[];
    probabilities?: ProbabilityGrid[];
    pitchOffsets?: number[][];
    noteGrids?: NoteGrid[];
    rowVolumes?: number[][];
    rowPans?: number[][];
    filterLocks?: FilterLockGrid[];
    ratchets?: RatchetGrid[];
    conditions?: ConditionGrid[];
    rowSwings?: number[][];
    gates?: GateGrid[];
    slides?: SlideGrid[];
    reverbSends?: number[][];
    delaySends?: number[][];
    automationData?: AutomationData[];
    rowLengths?: number[][];
  }): void {
    for (let b = 0; b < NUM_BANKS; b++) {
      if (data.grids[b]) {
        this.grids[b] = data.grids[b].map((row) => [...row]);
      }
      if (data.probabilities?.[b]) {
        this.probabilities[b] = data.probabilities[b].map((row) => [...row]);
      } else {
        this.probabilities[b] = createEmptyProbGrid();
      }
      if (data.pitchOffsets?.[b]) {
        this.pitchOffsets[b] = [...data.pitchOffsets[b]];
      } else {
        this.pitchOffsets[b] = new Array<number>(NUM_ROWS).fill(0);
      }
      if (data.noteGrids?.[b]) {
        this.noteGrids[b] = data.noteGrids[b].map((row) => [...row]);
      } else {
        this.noteGrids[b] = createEmptyNoteGrid();
      }
      if (data.rowVolumes?.[b]) {
        this.rowVolumes[b] = [...data.rowVolumes[b]];
      } else {
        this.rowVolumes[b] = new Array<number>(NUM_ROWS).fill(0.8);
      }
      if (data.rowPans?.[b]) {
        this.rowPans[b] = [...data.rowPans[b]];
      } else {
        this.rowPans[b] = new Array<number>(NUM_ROWS).fill(0);
      }
      if (data.filterLocks?.[b]) {
        this.filterLocks[b] = data.filterLocks[b].map((row) => [...row]);
      } else {
        this.filterLocks[b] = createEmptyFilterLockGrid();
      }
      if (data.ratchets?.[b]) {
        this.ratchets[b] = data.ratchets[b].map((row) => [...row]);
      } else {
        this.ratchets[b] = createEmptyRatchetGrid();
      }
      if (data.conditions?.[b]) {
        this.conditions[b] = data.conditions[b].map((row) => [...row]);
      } else {
        this.conditions[b] = createEmptyConditionGrid();
      }
      if (data.rowSwings?.[b]) {
        this.rowSwings[b] = [...data.rowSwings[b]];
      } else {
        this.rowSwings[b] = new Array<number>(NUM_ROWS).fill(0);
      }
      if (data.gates?.[b]) {
        this.gates[b] = data.gates[b].map((row) => [...row]);
      } else {
        this.gates[b] = createEmptyGateGrid();
      }
      if (data.slides?.[b]) {
        this.slides[b] = data.slides[b].map((row) => [...row]);
      } else {
        this.slides[b] = createEmptySlideGrid();
      }
      if (data.reverbSends?.[b]) {
        this.reverbSends[b] = [...data.reverbSends[b]];
      } else {
        this.reverbSends[b] = new Array<number>(NUM_ROWS).fill(0.3);
      }
      if (data.delaySends?.[b]) {
        this.delaySends[b] = [...data.delaySends[b]];
      } else {
        this.delaySends[b] = new Array<number>(NUM_ROWS).fill(0.25);
      }
      if (data.automationData?.[b]) {
        this.automationData[b] = data.automationData[b].map(param =>
          param.map(row => [...row]),
        );
      } else {
        this.automationData[b] = createEmptyAutomationData();
      }
      if (data.rowLengths?.[b]) {
        this.rowLengths[b] = [...data.rowLengths[b]];
      } else {
        this.rowLengths[b] = new Array<number>(NUM_ROWS).fill(NUM_STEPS);
      }
    }
  }
}
