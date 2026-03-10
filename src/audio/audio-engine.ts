import { NUM_ROWS } from '../types';
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
  private readonly compressor: DynamicsCompressorNode;

  // Per-row channel strips
  private readonly rowGains: GainNode[] = [];
  private readonly rowPans: StereoPannerNode[] = [];

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

    // Master limiter to prevent clipping
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-6, 0);
    this.compressor.knee.setValueAtTime(3, 0);
    this.compressor.ratio.setValueAtTime(12, 0);
    this.compressor.attack.setValueAtTime(0.003, 0);
    this.compressor.release.setValueAtTime(0.1, 0);

    // Per-row channel strips: gain → pan → dryBus + effectsSend
    for (let i = 0; i < NUM_ROWS; i++) {
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.8, 0);
      const pan = this.ctx.createStereoPanner();
      pan.pan.setValueAtTime(0, 0);

      gain.connect(pan);
      pan.connect(this.dryBus);
      pan.connect(this.effectsSend);

      this.rowGains.push(gain);
      this.rowPans.push(pan);
    }

    // Routing: dry path
    this.dryBus.connect(this.masterGain);

    // Routing: effects path
    this.effectsSend.connect(this.reverb.input);
    this.effectsSend.connect(this.delay.input);

    this.reverb.output.connect(this.masterGain);
    this.delay.output.connect(this.masterGain);

    // Chain: masterGain → compressor → analyser → filter → destination
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.filter.input);
    this.filter.output.connect(this.ctx.destination);
  }

  /**
   * Insert performance FX between masterGain and compressor.
   * Chain: masterGain → perfInsertIn → perfInsertOut → compressor → analyser → filter → dest
   */
  insertPerformanceFX(insertIn: GainNode, insertOut: GainNode): void {
    this.masterGain.disconnect(this.compressor);
    this.masterGain.connect(insertIn);
    insertOut.connect(this.compressor);
  }

  resume(): Promise<void> {
    return this.ctx.resume();
  }

  trigger(instrumentIndex: number, time: number, velocity: number, pitchOffset = 0): void {
    const instrument = INSTRUMENTS[instrumentIndex];
    if (!instrument) return;

    // Route through per-row channel strip
    const dest = this.rowGains[instrumentIndex] ?? this.dryBus;
    instrument.trigger(this.ctx, dest, time, velocity, pitchOffset);
  }

  setRowVolume(row: number, value: number): void {
    const gain = this.rowGains[row];
    if (gain) gain.gain.setValueAtTime(value, this.ctx.currentTime);
  }

  setRowPan(row: number, value: number): void {
    const pan = this.rowPans[row];
    if (pan) pan.pan.setValueAtTime(value, this.ctx.currentTime);
  }

  getRowGainNode(row: number): GainNode | undefined {
    return this.rowGains[row];
  }

  /** Duck rows 1-7 when kick fires (sidechain compression effect) */
  scheduleSidechainDuck(time: number, depth: number, release: number, baseVolumes: number[]): void {
    const attackTime = 0.005;
    for (let row = 1; row < NUM_ROWS; row++) {
      const gain = this.rowGains[row];
      if (!gain) continue;
      const base = baseVolumes[row] ?? 0.8;
      const ducked = base * (1 - depth);
      gain.gain.cancelScheduledValues(time);
      gain.gain.setValueAtTime(base, time);
      gain.gain.linearRampToValueAtTime(ducked, time + attackTime);
      gain.gain.linearRampToValueAtTime(base, time + attackTime + release);
    }
  }
}
