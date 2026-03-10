export class ReverbEffect {
  readonly input: GainNode;
  readonly output: GainNode;
  private wetGain: GainNode;
  private _mix = 0.3;

  constructor(ctx: AudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.wetGain.gain.setValueAtTime(0.3, 0);

    // Use ConvolverNode with synthetic impulse response
    const convolver = ctx.createConvolver();
    convolver.buffer = this.createImpulseResponse(ctx, 2.5, 3);

    this.input.connect(convolver);
    convolver.connect(this.wetGain);
    this.wetGain.connect(this.output);
  }

  private createImpulseResponse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  get mix(): number { return this._mix; }

  setMix(value: number): void {
    this._mix = value;
    this.wetGain.gain.setValueAtTime(value, 0);
  }
}
