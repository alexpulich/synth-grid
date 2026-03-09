import type { InstrumentTrigger } from '../../types';

export const triggerPad: InstrumentTrigger = (ctx, dest, time, velocity = 1) => {
  const baseFreq = 220;
  const detunes = [-12, -5, 5, 12];

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, time);
  filter.Q.setValueAtTime(1, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(velocity * 0.2, time + 0.3);
  gain.gain.linearRampToValueAtTime(0.001, time + 1.5);

  for (const detune of detunes) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, time);
    osc.detune.setValueAtTime(detune, time);
    osc.connect(filter);
    osc.start(time);
    osc.stop(time + 1.5);
  }

  filter.connect(gain);
  gain.connect(dest);
};
