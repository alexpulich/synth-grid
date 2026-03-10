import type { InstrumentTrigger } from '../../types';

export const triggerSnare: InstrumentTrigger = (ctx, dest, time, velocity = 1, pitchOffset = 0, params, gate, _glideFrom) => {
  const pitchMult = Math.pow(2, pitchOffset / 12);
  const a = params?.attack ?? 0.5;
  const d = params?.decay ?? 0.5;
  const t = params?.tone ?? 0.5;
  const p = params?.punch ?? 0.5;

  const noiseDuration = gate ?? (0.1 + d * 0.3); // 0.1-0.4s
  const noiseFreq = (3000 + t * 5000) * pitchMult; // 3k-8kHz
  const bodyGain = 0.3 + p * 0.6;               // 0.3-0.9

  // Noise component
  const bufferSize = Math.floor(ctx.sampleRate * noiseDuration);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(noiseFreq, time);
  noiseFilter.Q.setValueAtTime(1.2, time);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(velocity * 0.7, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + noiseDuration);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(dest);

  // Body component
  const bodyDuration = Math.min(0.05 + a * 0.1, noiseDuration);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180 * pitchMult, time);
  osc.frequency.exponentialRampToValueAtTime(80 * pitchMult, time + 0.04);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(velocity * bodyGain, time);
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + bodyDuration);

  osc.connect(oscGain);
  oscGain.connect(dest);

  noise.start(time);
  noise.stop(time + noiseDuration);
  osc.start(time);
  osc.stop(time + bodyDuration);
};
