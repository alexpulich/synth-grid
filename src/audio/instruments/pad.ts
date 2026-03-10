import type { InstrumentTrigger } from '../../types';

export const triggerPad: InstrumentTrigger = (ctx, dest, time, velocity = 1, pitchOffset = 0, params, gate, glideFrom) => {
  const pitchMult = Math.pow(2, pitchOffset / 12);
  const a = params?.attack ?? 0.5;
  const d = params?.decay ?? 0.5;
  const t = params?.tone ?? 0.5;
  const p = params?.punch ?? 0.5;

  let swellTime = 0.05 + a * 1.95;                    // 0.05-2.0s
  let release = 0.5 + d * 2.5;                        // 0.5-3.0s
  const filterCutoff = (600 + t * 2400) * pitchMult;  // 600-3kHz
  const brightness = 0.1 + p * 0.15;                  // 0.1-0.25 (initial gain)

  // Scale swell + release proportionally to gate duration
  if (gate != null) {
    const natural = swellTime + release;
    const ratio = gate / natural;
    swellTime *= ratio;
    release *= ratio;
  }

  const baseFreq = 220 * pitchMult;
  const detunes = [-12, -5, 5, 12];

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterCutoff, time);
  filter.Q.setValueAtTime(1, time);

  const totalDuration = swellTime + release;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(velocity * brightness, time + swellTime);
  gain.gain.linearRampToValueAtTime(0.001, time + totalDuration);

  for (const detune of detunes) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    if (glideFrom != null) {
      const fromFreq = 220 * Math.pow(2, glideFrom / 12);
      osc.frequency.setValueAtTime(fromFreq, time);
      osc.frequency.exponentialRampToValueAtTime(baseFreq, time + 0.06);
    } else {
      osc.frequency.setValueAtTime(baseFreq, time);
    }
    osc.detune.setValueAtTime(detune, time);
    osc.connect(filter);
    osc.start(time);
    osc.stop(time + totalDuration);
  }

  filter.connect(gain);
  gain.connect(dest);
};
