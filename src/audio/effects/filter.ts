export class FilterEffect {
  readonly input: GainNode;
  readonly output: GainNode;
  private filter: BiquadFilterNode;
  private _currentNormFreq = 1.0;
  private static readonly MIN_FREQ = 20;
  private static readonly MAX_FREQ = 20000;

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

  private normToFreq(norm: number): number {
    return FilterEffect.MIN_FREQ * Math.pow(FilterEffect.MAX_FREQ / FilterEffect.MIN_FREQ, norm);
  }

  setFrequency(normalizedValue: number): void {
    this._currentNormFreq = normalizedValue;
    const freq = this.normToFreq(normalizedValue);
    this.filter.frequency.setValueAtTime(freq, 0);
  }

  /** Schedule a temporary filter frequency change for one step, then restore */
  scheduleFrequencyPulse(normValue: number, time: number, duration: number): void {
    const freq = this.normToFreq(normValue);
    const restoreFreq = this.normToFreq(this._currentNormFreq);
    this.filter.frequency.setValueAtTime(freq, time);
    this.filter.frequency.setValueAtTime(restoreFreq, time + duration);
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
