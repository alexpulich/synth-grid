import type { SoundParams, MidiDeviceInfo, MidiCCMapping, SampleMeta, MidiOutputConfig, ClockMode } from '../types';

export interface EventMap {
  'cell:toggled': { row: number; step: number; velocity: number };
  'cell:probability-changed': { row: number; step: number; probability: number };
  'bank:changed': number;
  'bank:queued': number | null;
  'grid:cleared': void;
  'bank:copied': number;
  'bank:pasted': number;
  'tempo:changed': number;
  'transport:play': void;
  'transport:stop': void;
  'step:advance': number;
  'mute:changed': { muted: boolean[]; soloRow: number | null };
  'pitch:changed': { row: number; offset: number };
  'theme:changed': string;
  'perfx:engaged': string;
  'perfx:disengaged': string;
  'chain:mode-changed': boolean;
  'chain:updated': number[];
  'chain:position-changed': number;
  'note:changed': { row: number; step: number; note: number };
  'volume:changed': { row: number; volume: number };
  'pan:changed': { row: number; pan: number };
  'scale:changed': { scaleIndex: number; rootNote: number };
  'sidechain:changed': { enabled: boolean; depth: number; release: number };
  'filterlock:changed': { row: number; step: number; value: number };
  'ratchet:changed': { row: number; step: number; count: number };
  'condition:changed': { row: number; step: number; condition: number };
  'soundparam:changed': { row: number; params: SoundParams };
  'humanize:changed': number;
  'swing:changed': { row: number; swing: number };
  'gate:changed': { row: number; step: number; gate: number };
  'slide:changed': { row: number; step: number; slide: boolean };
  'midi:devices-changed': MidiDeviceInfo[];
  'midi:activity': void;
  'midi:learn-toggle': boolean;
  'midi:cc-captured': { cc: number; channel: number };
  'midi:mapping-changed': MidiCCMapping[];
  'send:reverb-changed': { row: number; value: number };
  'send:delay-changed': { row: number; value: number };
  'sample:loaded': { row: number; filename: string };
  'sample:removed': { row: number };
  'sample:load-request': { row: number; file: File };
  'sample:meta-changed': { row: number; meta: SampleMeta };
  'sample:mode-toggled': { row: number; useSample: boolean };
  // Round 12
  'metronome:toggled': boolean;
  'metronome:beat': number;
  'mutescene:saved': number;
  'mutescene:recalled': number;
  'step:copied': number;
  'step:pasted': number;
  'pattern:saved': string;
  'pattern:loaded': string;
  'pattern:deleted': string;
  // Round 13 — MIDI Output
  'midi:output-ports-changed': MidiDeviceInfo[];
  'midi:output-config-changed': { row: number; config: MidiOutputConfig };
  'midi:output-enabled-changed': boolean;
  'midi:clock-mode-changed': ClockMode;
  'midi:output-note': { row: number; note: number; velocity: number; channel: number };
  // Round 14 — Automation Lanes
  'automation:changed': { param: number; row: number; step: number; value: number };
  'automation:lanes-toggled': boolean;
  // Round 17 — Polyrhythm
  'rowlength:changed': { row: number; length: number };
}

type Listener<T> = (payload: T) => void;

class EventBus {
  private listeners = new Map<string, Set<Listener<never>>>();

  on<K extends keyof EventMap>(
    event: K,
    fn: EventMap[K] extends void ? () => void : Listener<EventMap[K]>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn as Listener<never>);
    return () => {
      this.listeners.get(event)?.delete(fn as Listener<never>);
    };
  }

  emit<K extends keyof EventMap>(
    ...args: EventMap[K] extends void ? [event: K] : [event: K, payload: EventMap[K]]
  ): void {
    const [event, payload] = args;
    this.listeners.get(event)?.forEach((fn) => {
      (fn as Listener<EventMap[K]>)(payload as EventMap[K]);
    });
  }
}

export const eventBus = new EventBus();
