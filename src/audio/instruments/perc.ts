import type { InstrumentTrigger } from '../../types';

export const triggerPerc: InstrumentTrigger = (ctx, dest, time, velocity = 1, pitchOffset = 0, params, gate, _glideFrom) => {
  const pitchMult = Math.pow(2, pitchOffset / 12);
  const a = params?.attack ?? 0.5;
  const d = params?.decay ?? 0.5;
  const t = params?.tone ?? 0.5;
  const p = params?.punch ?? 0.5;

  const clickSharpness = 0.5 + (1 - a) * 3.5;        // Q: 0.5-4 (higher = clickier)
  const duration = gate ?? (0.02 + d * 0.1);          // 0.02-0.12s
  const filterFreq = (1000 + t * 4000) * pitchMult;   // 1k-5kHz
  const burstGain = 0.2 + p * 0.2;                    // 0.2-0.4

  const osc1 = ctx.createOscillator();
  osc1.type = 'square';
  osc1.frequency.setValueAtTime(587 * pitchMult, time);

  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(845 * pitchMult, time);

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(filterFreq, time);
  bandpass.Q.setValueAtTime(clickSharpness, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(velocity * burstGain, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc1.connect(bandpass);
  osc2.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(dest);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + duration);
  osc2.stop(time + duration);
};
