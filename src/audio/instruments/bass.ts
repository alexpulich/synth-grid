import type { InstrumentTrigger } from '../../types';

export const triggerBass: InstrumentTrigger = (ctx, dest, time, velocity = 1, pitchOffset = 0, params, gate, glideFrom) => {
  const pitchMult = Math.pow(2, pitchOffset / 12);
  const a = params?.attack ?? 0.5;
  const d = params?.decay ?? 0.5;
  const t = params?.tone ?? 0.5;
  const p = params?.punch ?? 0.5;

  const attackTime = 0.002 + a * 0.018;               // 2-20ms
  const duration = gate ?? (0.2 + d * 0.6);           // 0.2-0.8s
  const filterCutoff = (400 + t * 1200) * pitchMult;  // 400-1600Hz
  const punchGain = 0.5 + p * 0.4;                    // 0.5-0.9

  const targetFreq = 55 * pitchMult;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';

  if (glideFrom != null) {
    const fromFreq = 55 * Math.pow(2, glideFrom / 12);
    osc.frequency.setValueAtTime(fromFreq, time);
    osc.frequency.exponentialRampToValueAtTime(targetFreq, time + 0.06);
  } else {
    osc.frequency.setValueAtTime(targetFreq, time);
  }

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterCutoff, time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(filterCutoff * 0.25, 60), time + duration * 0.6);
  filter.Q.setValueAtTime(5, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(velocity * punchGain, time + attackTime);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + duration);
};
