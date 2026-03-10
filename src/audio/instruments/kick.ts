import type { InstrumentTrigger } from '../../types';

export const triggerKick: InstrumentTrigger = (ctx, dest, time, velocity = 1, pitchOffset = 0, params, gate, _glideFrom) => {
  const pitchMult = Math.pow(2, pitchOffset / 12);
  const a = params?.attack ?? 0.5;
  const d = params?.decay ?? 0.5;
  const t = params?.tone ?? 0.5;
  const p = params?.punch ?? 0.5;

  const sweepTime = 0.04 + (1 - a) * 0.11;   // 0.04-0.15s
  const duration = gate ?? (0.2 + d * 0.8);   // 0.2-1.0s
  const startFreq = (100 + t * 150) * pitchMult;  // 100-250Hz
  const gainBoost = 0.7 + p * 0.5;            // 0.7-1.2

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(startFreq, time);
  osc.frequency.exponentialRampToValueAtTime(30 * pitchMult, time + Math.min(sweepTime, duration));

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(velocity * gainBoost, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + duration);
};
