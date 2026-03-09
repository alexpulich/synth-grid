export class DelayEffect {
  readonly input: GainNode;
  readonly output: GainNode;
  private delayNode: DelayNode;
  private feedbackGain: GainNode;
  private wetGain: GainNode;

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
    this.delayNode.delayTime.setValueAtTime(seconds, 0);
  }

  setFeedback(value: number): void {
    this.feedbackGain.gain.setValueAtTime(Math.min(value, 0.9), 0);
  }

  setMix(value: number): void {
    this.wetGain.gain.setValueAtTime(value, 0);
  }
}
