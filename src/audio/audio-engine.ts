import { INSTRUMENTS } from './instruments';
import { ReverbEffect } from './effects/reverb';
import { DelayEffect } from './effects/delay';
import { FilterEffect } from './effects/filter';

export class AudioEngine {
  readonly ctx: AudioContext;
  readonly masterGain: GainNode;
  readonly dryBus: GainNode;
  private effectsSend: GainNode;
  readonly reverb: ReverbEffect;
  readonly delay: DelayEffect;
  readonly filter: FilterEffect;
  readonly analyser: AnalyserNode;

  constructor() {
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, 0);

    this.dryBus = this.ctx.createGain();
    this.effectsSend = this.ctx.createGain();
    this.effectsSend.gain.setValueAtTime(0.5, 0);

    this.reverb = new ReverbEffect(this.ctx);
    this.delay = new DelayEffect(this.ctx);
    this.filter = new FilterEffect(this.ctx);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    // Routing: dry path
    this.dryBus.connect(this.masterGain);

    // Routing: effects path
    this.effectsSend.connect(this.reverb.input);
    this.effectsSend.connect(this.delay.input);

    this.reverb.output.connect(this.masterGain);
    this.delay.output.connect(this.masterGain);

    // Filter sits on the master output, analyser taps the signal
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.filter.input);
    this.filter.output.connect(this.ctx.destination);
  }

  /**
   * Insert performance FX between masterGain and analyser.
   * Call once after PerformanceFX is created.
   */
  insertPerformanceFX(insertIn: GainNode, insertOut: GainNode): void {
    this.masterGain.disconnect(this.analyser);
    this.masterGain.connect(insertIn);
    insertOut.connect(this.analyser);
  }

  resume(): Promise<void> {
    return this.ctx.resume();
  }

  trigger(instrumentIndex: number, time: number, velocity: number, pitchOffset = 0): void {
    const instrument = INSTRUMENTS[instrumentIndex];
    if (!instrument) return;

    // Create a per-trigger gain splitter
    const splitGain = this.ctx.createGain();
    splitGain.connect(this.dryBus);
    splitGain.connect(this.effectsSend);

    instrument.trigger(this.ctx, splitGain, time, velocity, pitchOffset);
  }
}
