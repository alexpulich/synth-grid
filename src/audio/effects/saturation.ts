export class SaturationEffect {
  readonly input: GainNode;
  readonly output: GainNode;
  private shaper: WaveShaperNode;
  private toneFilter: BiquadFilterNode;
  private _drive = 0;
  private _tone = 0.7;

  constructor(ctx: AudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();

    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '4x';
    this.buildCurve(1); // drive=1 = clean

    this.toneFilter = ctx.createBiquadFilter();
    this.toneFilter.type = 'lowpass';
    this.toneFilter.frequency.setValueAtTime(20000, 0);
    this.toneFilter.Q.setValueAtTime(0.7, 0);

    this.input.connect(this.shaper);
    this.shaper.connect(this.toneFilter);
    this.toneFilter.connect(this.output);
  }

  private buildCurve(drive: number): void {
    const samples = 8192;
    const curve = new Float32Array(samples);
    const denom = Math.tanh(drive);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(drive * x) / (denom || 1);
    }
    this.shaper.curve = curve;
  }

  get drive(): number { return this._drive; }
  get tone(): number { return this._tone; }

  /** drive: 0 = clean, 1 = heavy saturation */
  setDrive(v: number): void {
    this._drive = v;
    const drive = 1 + v * 19; // 1-20
    this.buildCurve(drive);
  }

  /** tone: 0 = dark (2kHz), 1 = bright (20kHz) */
  setTone(v: number): void {
    this._tone = v;
    const freq = 2000 * Math.pow(10, v); // 2kHz to 20kHz
    this.toneFilter.frequency.setValueAtTime(freq, 0);
  }
}
