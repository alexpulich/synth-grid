import { NUM_ROWS, DEFAULT_SAMPLE_META } from '../types';
import type { SampleMeta, InstrumentTrigger } from '../types';

export class SampleEngine {
  private buffers: (AudioBuffer | null)[] = new Array(NUM_ROWS).fill(null);
  private metas: SampleMeta[] = Array.from({ length: NUM_ROWS }, () => ({ ...DEFAULT_SAMPLE_META }));
  private triggers: (InstrumentTrigger | null)[] = new Array(NUM_ROWS).fill(null);

  async loadSample(ctx: BaseAudioContext, row: number, arrayBuffer: ArrayBuffer, filename: string): Promise<void> {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    this.buffers[row] = audioBuffer;
    this.metas[row] = { ...this.metas[row], filename };
    this.triggers[row] = this.createTrigger(row);
  }

  removeSample(row: number): void {
    this.buffers[row] = null;
    this.metas[row] = { ...DEFAULT_SAMPLE_META };
    this.triggers[row] = null;
  }

  hasSample(row: number): boolean {
    return this.buffers[row] !== null;
  }

  getBuffer(row: number): AudioBuffer | null {
    return this.buffers[row];
  }

  getMeta(row: number): SampleMeta {
    return this.metas[row];
  }

  setMeta(row: number, meta: Partial<SampleMeta>): void {
    this.metas[row] = { ...this.metas[row], ...meta };
    // Rebuild trigger with updated trim/loop settings
    if (this.buffers[row]) {
      this.triggers[row] = this.createTrigger(row);
    }
  }

  getAllMetas(): SampleMeta[] {
    return this.metas;
  }

  loadMetas(metas: SampleMeta[]): void {
    for (let i = 0; i < NUM_ROWS; i++) {
      if (metas[i]) this.metas[i] = { ...metas[i] };
    }
  }

  getTrigger(row: number): InstrumentTrigger | null {
    return this.triggers[row];
  }

  private createTrigger(row: number): InstrumentTrigger {
    return (ctx, dest, time, velocity = 1, pitchOffset = 0, _params, gate, glideFrom) => {
      const buffer = this.buffers[row];
      if (!buffer) return;
      const meta = this.metas[row];

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = meta.loop;

      // Pitch via playbackRate
      const pitchMult = Math.pow(2, (pitchOffset ?? 0) / 12);
      if (glideFrom !== undefined) {
        const fromRate = Math.pow(2, glideFrom / 12);
        source.playbackRate.setValueAtTime(fromRate, time);
        source.playbackRate.exponentialRampToValueAtTime(pitchMult, time + 0.06);
      } else {
        source.playbackRate.setValueAtTime(pitchMult, time);
      }

      // Gain for velocity
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(velocity, time);

      // Calculate sample region
      const sampleDuration = buffer.duration;
      const trimStart = meta.trimStart * sampleDuration;
      const trimEnd = meta.trimEnd * sampleDuration;
      const regionDuration = trimEnd - trimStart;

      source.connect(gain);
      gain.connect(dest);

      // Start from trim point, limit by gate or region
      const playDuration = gate !== undefined ? Math.min(gate, regionDuration) : regionDuration;
      source.start(time, trimStart, meta.loop ? undefined : playDuration);

      // Fade out at end of gate
      if (gate !== undefined && !meta.loop) {
        const fadeStart = time + gate - 0.005;
        if (fadeStart > time) {
          gain.gain.setValueAtTime(velocity, fadeStart);
          gain.gain.linearRampToValueAtTime(0.001, time + gate);
        }
      }
    };
  }
}
