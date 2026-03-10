import type { InstrumentTrigger } from '../../types';

export const triggerHiHat: InstrumentTrigger = (ctx, dest, time, velocity = 1, pitchOffset = 0, params, gate, _glideFrom) => {
  const pitchMult = Math.pow(2, pitchOffset / 12);
  const a = params?.attack ?? 0.5;
  const d = params?.decay ?? 0.5;
  const t = params?.tone ?? 0.5;
  const p = params?.punch ?? 0.5;

  const duration = gate ?? (0.03 + d * 0.12);      // 0.03-0.15s
  const filterFreq = (5000 + t * 10000) * pitchMult; // 5k-15kHz
  const initialGain = 0.15 + p * 0.2;              // 0.15-0.35
  const clickSharpness = 0.5 + (1 - a) * 0.5;     // sharper attack = higher Q

  const fundamental = 40 * pitchMult;
  const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(filterFreq, time);
  bandpass.Q.setValueAtTime(clickSharpness, time);

  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.setValueAtTime(filterFreq * 0.7, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(velocity * initialGain, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  for (const ratio of ratios) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(fundamental * ratio, time);
    osc.connect(bandpass);
    osc.start(time);
    osc.stop(time + duration);
  }

  bandpass.connect(highpass);
  highpass.connect(gain);
  gain.connect(dest);
};
