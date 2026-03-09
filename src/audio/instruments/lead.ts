import type { InstrumentTrigger } from '../../types';

export const triggerLead: InstrumentTrigger = (ctx, dest, time, velocity = 1, pitchOffset = 0) => {
  const pitchMult = Math.pow(2, pitchOffset / 12);

  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(440 * pitchMult, time);

  const osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(440 * 1.005 * pitchMult, time);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000 * pitchMult, time);
  filter.frequency.exponentialRampToValueAtTime(600 * pitchMult, time + 0.3);
  filter.Q.setValueAtTime(3, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(velocity * 0.4, time + 0.01);
  gain.gain.linearRampToValueAtTime(velocity * 0.28, time + 0.08);
  gain.gain.linearRampToValueAtTime(0.001, time + 0.3);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + 0.35);
  osc2.stop(time + 0.35);
};
