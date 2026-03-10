const DB_NAME = 'synth-grid-samples';
const DB_VERSION = 1;
const STORE_NAME = 'samples';
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50MB

export interface SampleRecord {
  row: number;
  filename: string;
  arrayBuffer: ArrayBuffer;
  trimStart: number;
  trimEnd: number;
  loop: boolean;
}

export class SampleStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<boolean> {
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'row' });
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

  async saveSample(row: number, filename: string, arrayBuffer: ArrayBuffer,
    trimStart: number, trimEnd: number, loop: boolean): Promise<void> {
    if (!this.db) return;
    const record: SampleRecord = { row, filename, arrayBuffer, trimStart, trimEnd, loop };
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async loadSample(row: number): Promise<SampleRecord | null> {
    if (!this.db) return null;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(row);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async loadAll(): Promise<SampleRecord[]> {
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  async removeSample(row: number): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(row);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTotalSize(): Promise<number> {
    const records = await this.loadAll();
    return records.reduce((sum, r) => sum + r.arrayBuffer.byteLength, 0);
  }

  get maxBytes(): number {
    return MAX_TOTAL_BYTES;
  }
}
