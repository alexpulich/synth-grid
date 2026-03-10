import type { InstrumentTrigger } from '../../types';

export const triggerLead: InstrumentTrigger = (ctx, dest, time, velocity = 1, pitchOffset = 0, params) => {
  const pitchMult = Math.pow(2, pitchOffset / 12);
  const a = params?.attack ?? 0.5;
  const d = params?.decay ?? 0.5;
  const t = params?.tone ?? 0.5;
  const p = params?.punch ?? 0.5;

  const fadeIn = 0.005 + a * 0.045;                    // 5-50ms
  const sustain = 0.15 + d * 0.45;                     // 0.15-0.6s
  const filterCutoff = (800 + t * 3200) * pitchMult;   // 800-4kHz
  const attackPeak = 0.25 + p * 0.3;                   // 0.25-0.55

  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(440 * pitchMult, time);

  const osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(440 * 1.005 * pitchMult, time);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterCutoff, time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(filterCutoff * 0.3, 200), time + sustain);
  filter.Q.setValueAtTime(3, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(velocity * attackPeak, time + fadeIn);
  gain.gain.linearRampToValueAtTime(velocity * attackPeak * 0.7, time + fadeIn + 0.05);
  gain.gain.linearRampToValueAtTime(0.001, time + sustain);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  const totalDuration = sustain + 0.05;
  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + totalDuration);
  osc2.stop(time + totalDuration);
};
