import type { InstrumentTrigger } from '../../types';

export const triggerSnare: InstrumentTrigger = (ctx, dest, time, velocity = 1, pitchOffset = 0) => {
  const pitchMult = Math.pow(2, pitchOffset / 12);

  // Noise component
  const bufferSize = Math.floor(ctx.sampleRate * 0.2);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(5000 * pitchMult, time);
  noiseFilter.Q.setValueAtTime(1.2, time);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(velocity * 0.7, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(dest);

  // Body component
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180 * pitchMult, time);
  osc.frequency.exponentialRampToValueAtTime(80 * pitchMult, time + 0.04);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(velocity * 0.6, time);
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

  osc.connect(oscGain);
  oscGain.connect(dest);

  noise.start(time);
  noise.stop(time + 0.2);
  osc.start(time);
  osc.stop(time + 0.1);
};
