import type { InstrumentTrigger } from '../../types';

export const triggerHiHat: InstrumentTrigger = (ctx, dest, time, velocity = 1, pitchOffset = 0) => {
  const pitchMult = Math.pow(2, pitchOffset / 12);
  const fundamental = 40 * pitchMult;
  const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(10000 * pitchMult, time);
  bandpass.Q.setValueAtTime(0.5, time);

  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.setValueAtTime(7000 * pitchMult, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(velocity * 0.25, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

  for (const ratio of ratios) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(fundamental * ratio, time);
    osc.connect(bandpass);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  bandpass.connect(highpass);
  highpass.connect(gain);
  gain.connect(dest);
};
