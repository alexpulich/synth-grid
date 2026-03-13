import type { AudioEngine } from './audio-engine';
import { eventBus } from '../utils/event-bus';

type FxName = 'tapestop' | 'stutter' | 'bitcrush' | 'reverbwash';

export function createBitcrushCurve(bits: number): Float32Array<ArrayBuffer> {
  const steps = Math.pow(2, bits);
  const n = 65536;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / n) * 2 - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}

export class PerformanceFX {
  private activeEffects = new Set<FxName>();

  // Tape stop nodes
  private tapeStopGain: GainNode;
  private tapeStopOsc: OscillatorNode | null = null;

  // Bitcrush nodes
  private crushShaper: WaveShaperNode;
  private crushWet: GainNode;
  private crushDry: GainNode;

  // Stutter state
  private stutterIntervalId: number | null = null;
  private stutterSource: AudioBufferSourceNode | null = null;
  private stutterGain: GainNode;

  // Reverb wash saved state
  private savedReverbMix = 0.3;
  private savedDryGain = 1.0;

  // Insert nodes (placed between masterGain and analyser)
  readonly insertIn: GainNode;
  readonly insertOut: GainNode;

  constructor(private engine: AudioEngine) {
    const ctx = engine.ctx;

    this.insertIn = ctx.createGain();
    this.insertOut = ctx.createGain();

    // Default pass-through
    this.insertIn.connect(this.insertOut);

    // Tape stop
    this.tapeStopGain = ctx.createGain();

    // Bitcrush (WaveShaperNode with staircase curve)
    this.crushShaper = ctx.createWaveShaper();
    this.crushShaper.curve = createBitcrushCurve(4);
    this.crushWet = ctx.createGain();
    this.crushWet.gain.setValueAtTime(0, 0);
    this.crushDry = ctx.createGain();
    this.crushDry.gain.setValueAtTime(1, 0);

    // Stutter gain
    this.stutterGain = ctx.createGain();
    this.stutterGain.gain.setValueAtTime(0, 0);
  }

  engage(fx: FxName): void {
    if (this.activeEffects.has(fx)) return;
    this.activeEffects.add(fx);
    const ctx = this.engine.ctx;
    const now = ctx.currentTime;

    switch (fx) {
      case 'tapestop':
        // Ramp playback rate down by reducing gain and adding pitch drop illusion
        this.insertIn.disconnect();
        this.tapeStopGain = ctx.createGain();
        this.tapeStopGain.gain.setValueAtTime(1, now);
        this.tapeStopGain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
        this.insertIn.connect(this.tapeStopGain);
        this.tapeStopGain.connect(this.insertOut);

        // Low-frequency oscillator to simulate wow
        this.tapeStopOsc = ctx.createOscillator();
        this.tapeStopOsc.type = 'sine';
        this.tapeStopOsc.frequency.setValueAtTime(8, now);
        this.tapeStopOsc.frequency.exponentialRampToValueAtTime(0.5, now + 1.5);
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.3, now);
        this.tapeStopOsc.connect(oscGain);
        oscGain.connect(this.tapeStopGain.gain);
        this.tapeStopOsc.start(now);
        break;

      case 'stutter': {
        // Rapid gating effect
        this.stutterGain = ctx.createGain();
        this.stutterGain.gain.setValueAtTime(1, now);
        this.insertIn.disconnect();
        this.insertIn.connect(this.stutterGain);
        this.stutterGain.connect(this.insertOut);

        let on = true;
        this.stutterIntervalId = window.setInterval(() => {
          const t = ctx.currentTime;
          on = !on;
          this.stutterGain.gain.setValueAtTime(on ? 1 : 0, t);
        }, 60000 / this.engine.masterGain.context.sampleRate * 256 || 62.5);
        // ~62.5ms = 1/16 at 120bpm
        break;
      }

      case 'bitcrush':
        this.insertIn.disconnect();
        // Wet path (crushed)
        this.crushWet.gain.setValueAtTime(0, now);
        this.crushWet.gain.linearRampToValueAtTime(0.8, now + 0.05);
        this.crushDry.gain.setValueAtTime(1, now);
        this.crushDry.gain.linearRampToValueAtTime(0.3, now + 0.05);

        this.insertIn.connect(this.crushShaper);
        this.crushShaper.connect(this.crushWet);
        this.crushWet.connect(this.insertOut);

        this.insertIn.connect(this.crushDry);
        this.crushDry.connect(this.insertOut);
        break;

      case 'reverbwash':
        this.savedReverbMix = 0.3; // default mix
        this.savedDryGain = this.engine.dryBus.gain.value;
        this.engine.reverb.setMix(1.0);
        this.engine.dryBus.gain.setValueAtTime(this.savedDryGain, now);
        this.engine.dryBus.gain.linearRampToValueAtTime(0.1, now + 0.2);
        break;
    }

    eventBus.emit('perfx:engaged', fx);
  }

  disengage(fx: FxName): void {
    if (!this.activeEffects.has(fx)) return;
    this.activeEffects.delete(fx);
    const ctx = this.engine.ctx;
    const now = ctx.currentTime;

    switch (fx) {
      case 'tapestop':
        if (this.tapeStopOsc) {
          this.tapeStopOsc.stop(now);
          this.tapeStopOsc = null;
        }
        this.insertIn.disconnect();
        this.insertIn.connect(this.insertOut);
        break;

      case 'stutter':
        if (this.stutterIntervalId !== null) {
          clearInterval(this.stutterIntervalId);
          this.stutterIntervalId = null;
        }
        if (this.stutterSource) {
          this.stutterSource.stop(now);
          this.stutterSource = null;
        }
        this.insertIn.disconnect();
        this.insertIn.connect(this.insertOut);
        break;

      case 'bitcrush':
        this.crushWet.gain.linearRampToValueAtTime(0, now + 0.05);
        this.crushDry.gain.linearRampToValueAtTime(1, now + 0.05);
        setTimeout(() => {
          if (!this.activeEffects.has('bitcrush')) {
            try {
              this.insertIn.disconnect();
              this.insertIn.connect(this.insertOut);
            } catch { /* already disconnected */ }
          }
        }, 100);
        break;

      case 'reverbwash':
        this.engine.reverb.setMix(this.savedReverbMix);
        this.engine.dryBus.gain.setValueAtTime(0.1, now);
        this.engine.dryBus.gain.linearRampToValueAtTime(this.savedDryGain, now + 0.3);
        break;
    }

    eventBus.emit('perfx:disengaged', fx);
  }

  isActive(fx: FxName): boolean {
    return this.activeEffects.has(fx);
  }
}
