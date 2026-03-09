import type { InstrumentConfig } from '../../types';
import { triggerKick } from './kick';
import { triggerSnare } from './snare';
import { triggerHiHat } from './hihat';
import { triggerClap } from './clap';
import { triggerBass } from './bass';
import { triggerLead } from './lead';
import { triggerPad } from './pad';
import { triggerPerc } from './perc';

export const INSTRUMENTS: InstrumentConfig[] = [
  { name: 'Kick', trigger: triggerKick, color: '#ff3366' },
  { name: 'Snare', trigger: triggerSnare, color: '#ff6633' },
  { name: 'HiHat', trigger: triggerHiHat, color: '#ffcc00' },
  { name: 'Clap', trigger: triggerClap, color: '#33ff66' },
  { name: 'Bass', trigger: triggerBass, color: '#00ccff' },
  { name: 'Lead', trigger: triggerLead, color: '#6633ff' },
  { name: 'Pad', trigger: triggerPad, color: '#ff33cc' },
  { name: 'Perc', trigger: triggerPerc, color: '#33ccff' },
];
