import type { SoundParams } from '../types';

export interface EventMap {
  'cell:toggled': { row: number; step: number; velocity: number };
  'cell:probability-changed': { row: number; step: number; probability: number };
  'bank:changed': number;
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
