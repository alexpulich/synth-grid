export interface StepData {
  velocities: number[];
  probabilities: number[];
  notes: number[];
  filterLocks: number[];
  ratchets: number[];
  conditions: number[];
  gates: number[];
  slides: boolean[];
}

export class StepClipboard {
  private data: StepData | null = null;
  private _sourceStep = -1;

  copy(step: number, data: StepData): void {
    this.data = {
      velocities: [...data.velocities],
      probabilities: [...data.probabilities],
      notes: [...data.notes],
      filterLocks: [...data.filterLocks],
      ratchets: [...data.ratchets],
      conditions: [...data.conditions],
      gates: [...data.gates],
      slides: [...data.slides],
    };
    this._sourceStep = step;
  }

  get hasData(): boolean { return this.data !== null; }
  get sourceStep(): number { return this._sourceStep; }

  paste(): StepData | null {
    if (!this.data) return null;
    return {
      velocities: [...this.data.velocities],
      probabilities: [...this.data.probabilities],
      notes: [...this.data.notes],
      filterLocks: [...this.data.filterLocks],
      ratchets: [...this.data.ratchets],
      conditions: [...this.data.conditions],
      gates: [...this.data.gates],
      slides: [...this.data.slides],
    };
  }
}
