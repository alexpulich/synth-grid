import type { InstrumentTrigger } from '../../types';

export const triggerKick: InstrumentTrigger = (ctx, dest, time, velocity = 1) => {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(30, time + 0.08);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(velocity * 0.9, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + 0.5);
};
