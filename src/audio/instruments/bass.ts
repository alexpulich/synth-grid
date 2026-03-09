import type { InstrumentTrigger } from '../../types';

export const triggerBass: InstrumentTrigger = (ctx, dest, time, velocity = 1) => {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(55, time);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, time);
  filter.frequency.exponentialRampToValueAtTime(200, time + 0.3);
  filter.Q.setValueAtTime(5, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(velocity * 0.7, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + 0.4);
};
