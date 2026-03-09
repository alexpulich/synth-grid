import type { InstrumentTrigger } from '../../types';

export const triggerPerc: InstrumentTrigger = (ctx, dest, time, velocity = 1, pitchOffset = 0) => {
  const pitchMult = Math.pow(2, pitchOffset / 12);

  const osc1 = ctx.createOscillator();
  osc1.type = 'square';
  osc1.frequency.setValueAtTime(587 * pitchMult, time);

  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(845 * pitchMult, time);

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(2000 * pitchMult, time);
  bandpass.Q.setValueAtTime(3, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(velocity * 0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

  osc1.connect(bandpass);
  osc2.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(dest);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + 0.04);
  osc2.stop(time + 0.04);
};
