export class EQEffect {
  readonly input: GainNode;
  readonly output: GainNode;
  private lowShelf: BiquadFilterNode;
  private midPeak: BiquadFilterNode;
  private highShelf: BiquadFilterNode;
  private _low = 0.5;
  private _mid = 0.5;
  private _high = 0.5;

  constructor(ctx: AudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();

    this.lowShelf = ctx.createBiquadFilter();
    this.lowShelf.type = 'lowshelf';
    this.lowShelf.frequency.setValueAtTime(200, 0);
    this.lowShelf.gain.setValueAtTime(0, 0);

    this.midPeak = ctx.createBiquadFilter();
    this.midPeak.type = 'peaking';
    this.midPeak.frequency.setValueAtTime(1000, 0);
    this.midPeak.Q.setValueAtTime(1, 0);
    this.midPeak.gain.setValueAtTime(0, 0);

    this.highShelf = ctx.createBiquadFilter();
    this.highShelf.type = 'highshelf';
    this.highShelf.frequency.setValueAtTime(8000, 0);
    this.highShelf.gain.setValueAtTime(0, 0);

    this.input.connect(this.lowShelf);
    this.lowShelf.connect(this.midPeak);
    this.midPeak.connect(this.highShelf);
    this.highShelf.connect(this.output);
  }

  get low(): number { return this._low; }
  get mid(): number { return this._mid; }
  get high(): number { return this._high; }

  /** v: 0-1, mapped to -12 to +12 dB. 0.5 = flat (0dB) */
  setLow(v: number): void {
    this._low = v;
    this.lowShelf.gain.setValueAtTime((v - 0.5) * 24, 0);
  }

  setMid(v: number): void {
    this._mid = v;
    this.midPeak.gain.setValueAtTime((v - 0.5) * 24, 0);
  }

  setHigh(v: number): void {
    this._high = v;
    this.highShelf.gain.setValueAtTime((v - 0.5) * 24, 0);
  }
}
