export const NUM_ROWS = 8;
export const NUM_STEPS = 16;
export const NUM_BANKS = 4;

export type Grid = boolean[][];

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

export interface SequencerState {
  grids: Grid[];
  activeBank: number;
  tempo: number;
  swing: number;
  isPlaying: boolean;
  currentStep: number;
}
