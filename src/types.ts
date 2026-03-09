export const NUM_ROWS = 8;
export const NUM_STEPS = 16;
export const NUM_BANKS = 4;

export const VELOCITY_OFF = 0;
export const VELOCITY_SOFT = 1;
export const VELOCITY_MEDIUM = 2;
export const VELOCITY_LOUD = 3;
export type VelocityLevel = 0 | 1 | 2 | 3;

export const VELOCITY_MAP: Record<number, number> = {
  0: 0,
  1: 0.33,
  2: 0.66,
  3: 1.0,
};

export type Grid = number[][];

export type InstrumentTrigger = (
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  velocity?: number,
) => void;

export interface InstrumentConfig {
  name: string;
  trigger: InstrumentTrigger;
  color: string;
}
