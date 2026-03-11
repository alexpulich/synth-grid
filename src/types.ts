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
export type FilterLockGrid = number[][]; // NaN = no lock, 0-1 = normalized frequency
export type RatchetGrid = number[][]; // 1 = normal, 2-4 = repeats within step
export type ConditionGrid = number[][]; // index into TRIG_CONDITIONS
export type GateGrid = number[][]; // 0-3 per step (short/normal/long/held)
export type SlideGrid = boolean[][]; // per-step slide toggle
export type SwingGrid = number[]; // per-row swing values, 0-0.75

export const GATE_LEVELS = [0.25, 0.5, 0.75, 1.0] as const; // short, normal, long, held
export const GATE_LABELS = ['S', 'N', 'L', 'H'] as const;

export const MELODIC_ROWS = [4, 5, 6] as const; // bass, lead, pad

export const PROBABILITY_LEVELS = [1.0, 0.75, 0.5, 0.25] as const;

export const TRIG_CONDITIONS = ['', '1:2', '2:2', '1:4', '3:4', '!1'] as const;

export interface SoundParams {
  attack: number; // 0-1
  decay: number;  // 0-1
  tone: number;   // 0-1
  punch: number;  // 0-1
}

export const DEFAULT_SOUND_PARAMS: SoundParams = { attack: 0.5, decay: 0.5, tone: 0.5, punch: 0.5 };

export type InstrumentTrigger = (
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  velocity?: number,
  pitchOffset?: number,
  params?: SoundParams,
  gate?: number,
  glideFrom?: number,
) => void;

export interface InstrumentConfig {
  name: string;
  trigger: InstrumentTrigger;
  color: string;
}

export interface MidiCCMapping {
  channel: number;
  cc: number;
  target: string;
}

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export interface SampleMeta {
  filename: string;
  trimStart: number;  // 0-1 normalized
  trimEnd: number;    // 0-1 normalized
  loop: boolean;
}

export const DEFAULT_SAMPLE_META: SampleMeta = {
  filename: '',
  trimStart: 0,
  trimEnd: 1,
  loop: false,
};

// MIDI Output (Round 13)
export type ClockMode = 'off' | 'send' | 'receive';

export interface MidiOutputConfig {
  enabled: boolean;       // Per-row output enable
  portId: string | null;  // Selected output port ID (null = use global default)
  channel: number;        // 0-15 (MIDI channel 1-16)
  baseNote: number;       // Base MIDI note number for this row
}

export const DEFAULT_MIDI_OUTPUT_CONFIG: MidiOutputConfig = {
  enabled: false,
  portId: null,
  channel: 0,
  baseNote: 60,
};

// GM drum map for drum rows, middle C region for melodic
export const DEFAULT_ROW_BASE_NOTES = [36, 38, 42, 39, 33, 48, 60, 56] as const;
