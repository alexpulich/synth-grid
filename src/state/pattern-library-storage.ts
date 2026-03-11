import type { Grid, ProbabilityGrid, NoteGrid, RatchetGrid, ConditionGrid, GateGrid, SlideGrid, SoundParams } from '../types';

const DB_NAME = 'synth-grid-patterns';
const DB_VERSION = 1;
const STORE_NAME = 'patterns';

export interface PatternSnapshot {
  id: string;
  name: string;
  createdAt: number;
  isFactory: boolean;
  data: PatternData;
}

export interface PatternData {
  grids: Grid[];
  probabilities: ProbabilityGrid[];
  pitchOffsets: number[][];
  noteGrids: NoteGrid[];
  rowVolumes: number[][];
  rowPans: number[][];
  filterLocks: (number | null)[][][]; // NaN → null for JSON
  ratchets: RatchetGrid[];
  conditions: ConditionGrid[];
  gates: GateGrid[];
  slides: SlideGrid[];
  rowSwings: number[][];
  reverbSends: number[][];
  delaySends: number[][];
  automationData?: (number | null)[][][][]; // NaN → null for JSON, [bank][param][row][step]
  tempo: number;
  selectedScale: number;
  rootNote: number;
  soundParams: SoundParams[];
  humanize: number;
  sidechainEnabled: boolean;
  sidechainDepth: number;
  sidechainRelease: number;
  saturationDrive: number;
  saturationTone: number;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  delayDivision: number;
}

export class PatternLibraryStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<boolean> {
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => {
          this.db = request.result;
          resolve(true);
        };
        request.onerror = () => reject(request.error);
      });
    } catch {
      return false;
    }
  }

  async savePattern(pattern: PatternSnapshot): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(pattern);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async loadAll(): Promise<PatternSnapshot[]> {
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePattern(id: string): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCount(): Promise<number> {
    if (!this.db) return 0;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
