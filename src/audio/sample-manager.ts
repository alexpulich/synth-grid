import type { AudioEngine } from './audio-engine';
import type { SampleStorage } from '../state/sample-storage';
import { eventBus } from '../utils/event-bus';
import { showToast } from '../ui/toast';

export function wireSampleManager(
  sampleStorage: SampleStorage,
  audioEngine: AudioEngine,
): void {
  eventBus.on('sample:load-request', ({ row, file }) => {
    file.arrayBuffer().then(async (arrayBuffer) => {
      try {
        // Check size limit
        const totalSize = await sampleStorage.getTotalSize();
        if (totalSize + arrayBuffer.byteLength > sampleStorage.maxBytes) {
          showToast('Sample storage full (50MB limit)', 'warning');
          return;
        }
        await audioEngine.sampleEngine.loadSample(audioEngine.ctx, row, arrayBuffer, file.name);
        audioEngine.useSample[row] = true;
        eventBus.emit('sample:loaded', { row, filename: file.name });
        eventBus.emit('sample:mode-toggled', { row, useSample: true });
        // Persist to IndexedDB
        const meta = audioEngine.sampleEngine.getMeta(row);
        sampleStorage.saveSample(row, file.name, arrayBuffer, meta.trimStart, meta.trimEnd, meta.loop);
        showToast(`Sample loaded: ${file.name}`, 'success');
      } catch {
        showToast('Failed to load sample', 'warning');
      }
    });
  });

  eventBus.on('sample:removed', ({ row }) => {
    audioEngine.sampleEngine.removeSample(row);
    audioEngine.useSample[row] = false;
    sampleStorage.removeSample(row);
    showToast('Sample removed');
  });

  eventBus.on('sample:mode-toggled', ({ row, useSample }) => {
    audioEngine.useSample[row] = useSample;
  });

  eventBus.on('sample:meta-changed', ({ row, meta }) => {
    // Update IndexedDB with new trim/loop settings
    const buffer = audioEngine.sampleEngine.getBuffer(row);
    if (buffer) {
      // We need the raw ArrayBuffer — re-save with updated meta
      // getBuffer returns AudioBuffer, but we stored the raw ArrayBuffer in IndexedDB
      // Just update the metadata fields via a load+re-save
      sampleStorage.loadSample(row).then((record) => {
        if (record) {
          sampleStorage.saveSample(row, meta.filename, record.arrayBuffer, meta.trimStart, meta.trimEnd, meta.loop);
        }
      });
    }
  });
}
