import type { InstrumentTrigger } from '../../types';

export const triggerClap: InstrumentTrigger = (ctx, dest, time, velocity = 1, pitchOffset = 0, params, gate, _glideFrom) => {
  const pitchMult = Math.pow(2, pitchOffset / 12);
  const a = params?.attack ?? 0.5;
  const d = params?.decay ?? 0.5;
  const t = params?.tone ?? 0.5;
  const p = params?.punch ?? 0.5;

  const burstSpacing = 0.005 + a * 0.015;           // 5-20ms
  const tailDuration = gate ?? (0.15 + d * 0.35);   // 0.15-0.5s
  const filterFreq = (1500 + t * 3500) * pitchMult; // 1.5k-5kHz
  const burstGain = 0.3 + p * 0.4;                  // 0.3-0.7

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(filterFreq, time);
  filter.Q.setValueAtTime(2, time);
  filter.connect(dest);

  // Multiple short noise bursts
  for (let i = 0; i < 3; i++) {
    const burstTime = time + i * burstSpacing;
    const bufSize = Math.floor(ctx.sampleRate * 0.02);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufSize; j++) {
      data[j] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(velocity * burstGain, burstTime);
    g.gain.exponentialRampToValueAtTime(0.001, burstTime + 0.08);
    src.connect(g);
    g.connect(filter);
    src.start(burstTime);
    src.stop(burstTime + 0.08);
  }

  // Noise tail
  const tailSize = Math.floor(ctx.sampleRate * tailDuration);
  const tailBuf = ctx.createBuffer(1, tailSize, ctx.sampleRate);
  const tailData = tailBuf.getChannelData(0);
  for (let i = 0; i < tailSize; i++) {
    tailData[i] = Math.random() * 2 - 1;
  }
  const tail = ctx.createBufferSource();
  tail.buffer = tailBuf;
  const tailGain = ctx.createGain();
  tailGain.gain.setValueAtTime(velocity * 0.25, time + 0.03);
  tailGain.gain.exponentialRampToValueAtTime(0.001, time + tailDuration);
  tail.connect(tailGain);
  tailGain.connect(filter);
  tail.start(time + 0.03);
  tail.stop(time + tailDuration);
};
