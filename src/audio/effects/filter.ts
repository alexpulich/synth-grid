export class FilterEffect {
  readonly input: GainNode;
  readonly output: GainNode;
  private filter: BiquadFilterNode;

  constructor(ctx: AudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(20000, 0);
    this.filter.Q.setValueAtTime(1, 0);

    this.input.connect(this.filter);
    this.filter.connect(this.output);
  }

  setFrequency(normalizedValue: number): void {
    const minFreq = 20;
    const maxFreq = 20000;
    const freq = minFreq * Math.pow(maxFreq / minFreq, normalizedValue);
    this.filter.frequency.setValueAtTime(freq, 0);
  }

  setResonance(normalizedValue: number): void {
    this.filter.Q.setValueAtTime(0.5 + normalizedValue * 19.5, 0);
  }

  setType(type: BiquadFilterType): void {
    this.filter.type = type;
  }

  getType(): BiquadFilterType {
    return this.filter.type;
  }
}
