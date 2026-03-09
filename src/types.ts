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
export type ProbabilityGrid = number[][];
export type NoteGrid = number[][];

export const MELODIC_ROWS = [4, 5, 6] as const; // bass, lead, pad

export const PROBABILITY_LEVELS = [1.0, 0.75, 0.5, 0.25] as const;

export type InstrumentTrigger = (
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  velocity?: number,
  pitchOffset?: number,
) => void;

export interface InstrumentConfig {
  name: string;
  trigger: InstrumentTrigger;
  color: string;
}
