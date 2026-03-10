export const DELAY_DIVISIONS = [
  { label: '1/2',   mult: 2.0   },
  { label: '1/4',   mult: 1.0   },
  { label: '1/4D',  mult: 1.5   },
  { label: '1/8',   mult: 0.5   },
  { label: '1/8D',  mult: 0.75  },
  { label: '1/8T',  mult: 1/3   },
  { label: '1/16',  mult: 0.25  },
  { label: '1/16T', mult: 1/6   },
] as const;

export class DelayEffect {
  readonly input: GainNode;
  readonly output: GainNode;
  private delayNode: DelayNode;
  private feedbackGain: GainNode;
  private wetGain: GainNode;
  private _currentMult: number | null = null;

  constructor(ctx: AudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();

    this.delayNode = ctx.createDelay(2.0);
    this.delayNode.delayTime.setValueAtTime(0.375, 0);

    this.feedbackGain = ctx.createGain();
    this.feedbackGain.gain.setValueAtTime(0.35, 0);

    const feedbackFilter = ctx.createBiquadFilter();
    feedbackFilter.type = 'lowpass';
    feedbackFilter.frequency.setValueAtTime(4000, 0);

    this.wetGain = ctx.createGain();
    this.wetGain.gain.setValueAtTime(0.25, 0);

    // Signal path
    this.input.connect(this.delayNode);
    this.delayNode.connect(feedbackFilter);
    feedbackFilter.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.wetGain);
    this.wetGain.connect(this.output);
  }

  setTime(seconds: number): void {
    this._currentMult = null;
    this.delayNode.delayTime.setValueAtTime(seconds, 0);
  }

  setTimeFromDivision(bpm: number, mult: number): void {
    this._currentMult = mult;
    const seconds = Math.min((60 / bpm) * mult, 2.0);
    this.delayNode.delayTime.setValueAtTime(seconds, 0);
  }

  syncToBpm(bpm: number): void {
    if (this._currentMult !== null) {
      const seconds = Math.min((60 / bpm) * this._currentMult, 2.0);
      this.delayNode.delayTime.setValueAtTime(seconds, 0);
    }
  }

  get currentMult(): number | null {
    return this._currentMult;
  }

  setFeedback(value: number): void {
    this.feedbackGain.gain.setValueAtTime(Math.min(value, 0.9), 0);
  }

  setMix(value: number): void {
    this.wetGain.gain.setValueAtTime(value, 0);
  }
}
