import { NUM_ROWS, DEFAULT_SOUND_PARAMS } from '../types';
import type { SoundParams } from '../types';
import { INSTRUMENTS } from './instruments';
import { ReverbEffect } from './effects/reverb';
import { DelayEffect } from './effects/delay';
import { FilterEffect } from './effects/filter';
import { SaturationEffect } from './effects/saturation';
import { EQEffect } from './effects/eq';
import { SampleEngine } from './sample-engine';

export class AudioEngine {
  readonly ctx: AudioContext;
  readonly masterGain: GainNode;
  readonly dryBus: GainNode;
  readonly reverb: ReverbEffect;
  readonly delay: DelayEffect;
  readonly filter: FilterEffect;
  readonly saturation: SaturationEffect;
  readonly eq: EQEffect;
  readonly analyser: AnalyserNode;
  private readonly compressor: DynamicsCompressorNode;

  // Per-row channel strips
  private readonly rowGains: GainNode[] = [];
  private readonly rowPans: StereoPannerNode[] = [];

  // Per-row effect sends
  private readonly rowReverbSends: GainNode[] = [];
  private readonly rowDelaySends: GainNode[] = [];

  // Per-row sound params (synced from sequencer)
  soundParams: SoundParams[] = Array.from({ length: NUM_ROWS }, () => ({ ...DEFAULT_SOUND_PARAMS }));

  // Sample engine
  readonly sampleEngine = new SampleEngine();
  useSample: boolean[] = new Array(NUM_ROWS).fill(false);

  constructor() {
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, 0);

    this.dryBus = this.ctx.createGain();

    this.reverb = new ReverbEffect(this.ctx);
    this.delay = new DelayEffect(this.ctx);
    this.filter = new FilterEffect(this.ctx);
    this.saturation = new SaturationEffect(this.ctx);
    this.eq = new EQEffect(this.ctx);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    // Master limiter to prevent clipping
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-6, 0);
    this.compressor.knee.setValueAtTime(3, 0);
    this.compressor.ratio.setValueAtTime(12, 0);
    this.compressor.attack.setValueAtTime(0.003, 0);
    this.compressor.release.setValueAtTime(0.1, 0);

    // Per-row channel strips: gain → pan → dryBus + per-row reverb/delay sends
    for (let i = 0; i < NUM_ROWS; i++) {
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.8, 0);
      const pan = this.ctx.createStereoPanner();
      pan.pan.setValueAtTime(0, 0);

      gain.connect(pan);
      pan.connect(this.dryBus);

      // Per-row reverb send
      const reverbSend = this.ctx.createGain();
      reverbSend.gain.setValueAtTime(0.3, 0);
      pan.connect(reverbSend);
      reverbSend.connect(this.reverb.input);
      this.rowReverbSends.push(reverbSend);

      // Per-row delay send
      const delaySend = this.ctx.createGain();
      delaySend.gain.setValueAtTime(0.25, 0);
      pan.connect(delaySend);
      delaySend.connect(this.delay.input);
      this.rowDelaySends.push(delaySend);

      this.rowGains.push(gain);
      this.rowPans.push(pan);
    }

    // Routing: dry path
    this.dryBus.connect(this.masterGain);

    // Routing: effects outputs
    this.reverb.output.connect(this.masterGain);
    this.delay.output.connect(this.masterGain);

    // Chain: masterGain → saturation → EQ → compressor → analyser → filter → destination
    this.masterGain.connect(this.saturation.input);
    this.saturation.output.connect(this.eq.input);
    this.eq.output.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.filter.input);
    this.filter.output.connect(this.ctx.destination);
  }

  /**
   * Insert performance FX between EQ and compressor.
   */
  insertPerformanceFX(insertIn: GainNode, insertOut: GainNode): void {
    this.eq.output.disconnect(this.compressor);
    this.eq.output.connect(insertIn);
    insertOut.connect(this.compressor);
  }

  resume(): Promise<void> {
    return this.ctx.resume();
  }

  trigger(instrumentIndex: number, time: number, velocity: number, pitchOffset = 0, gate?: number, glideFrom?: number): void {
    // Route through per-row channel strip
    const dest = this.rowGains[instrumentIndex] ?? this.dryBus;

    if (this.useSample[instrumentIndex] && this.sampleEngine.hasSample(instrumentIndex)) {
      const sampleTrigger = this.sampleEngine.getTrigger(instrumentIndex);
      if (sampleTrigger) {
        sampleTrigger(this.ctx, dest, time, velocity, pitchOffset, undefined, gate, glideFrom);
      }
    } else {
      const instrument = INSTRUMENTS[instrumentIndex];
      if (!instrument) return;
      instrument.trigger(this.ctx, dest, time, velocity, pitchOffset, this.soundParams[instrumentIndex], gate, glideFrom);
    }
  }

  setRowVolume(row: number, value: number): void {
    const gain = this.rowGains[row];
    if (gain) gain.gain.setValueAtTime(value, this.ctx.currentTime);
  }

  setRowPan(row: number, value: number): void {
    const pan = this.rowPans[row];
    if (pan) pan.pan.setValueAtTime(value, this.ctx.currentTime);
  }

  setRowReverbSend(row: number, value: number): void {
    const node = this.rowReverbSends[row];
    if (node) node.gain.setValueAtTime(value, this.ctx.currentTime);
  }

  setRowDelaySend(row: number, value: number): void {
    const node = this.rowDelaySends[row];
    if (node) node.gain.setValueAtTime(value, this.ctx.currentTime);
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
