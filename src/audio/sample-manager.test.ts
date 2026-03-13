import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { eventBus } from '../utils/event-bus';

vi.mock('../ui/toast', () => ({
  showToast: vi.fn(),
}));

import { showToast } from '../ui/toast';
import { wireSampleManager } from './sample-manager';

function createMockFile(name: string, size: number): File {
  const buffer = new ArrayBuffer(size);
  return {
    name,
    arrayBuffer: vi.fn(() => Promise.resolve(buffer)),
  } as unknown as File;
}

const sampleStorageMock = {
  getTotalSize: vi.fn(() => Promise.resolve(0)),
  maxBytes: 50 * 1024 * 1024,
  saveSample: vi.fn(() => Promise.resolve()),
  removeSample: vi.fn(() => Promise.resolve()),
  loadSample: vi.fn(() => Promise.resolve(null)),
};

const sampleEngineMock = {
  loadSample: vi.fn(() => Promise.resolve()),
  removeSample: vi.fn(),
  getBuffer: vi.fn(() => null),
  getMeta: vi.fn(() => ({ trimStart: 0, trimEnd: 1, loop: false, filename: 'test.wav' })),
};

const audioEngineMock = {
  ctx: {},
  sampleEngine: sampleEngineMock,
  useSample: new Array(8).fill(false),
};

describe('wireSampleManager', () => {
  beforeAll(() => {
    wireSampleManager(sampleStorageMock as never, audioEngineMock as never);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    audioEngineMock.useSample = new Array(8).fill(false);
    sampleStorageMock.getTotalSize.mockResolvedValue(0);
    sampleEngineMock.loadSample.mockResolvedValue(undefined);
    sampleEngineMock.getBuffer.mockReturnValue(null);
    sampleEngineMock.getMeta.mockReturnValue({ trimStart: 0, trimEnd: 1, loop: false, filename: 'test.wav' });
    sampleStorageMock.loadSample.mockResolvedValue(null);
  });

  describe('sample:load-request', () => {
    it('successful load: calls loadSample, sets useSample, emits events, persists, toasts', async () => {
      const emitted: string[] = [];
      const off1 = eventBus.on('sample:loaded', () => emitted.push('loaded'));
      const off2 = eventBus.on('sample:mode-toggled', () => emitted.push('toggled'));

      const file = createMockFile('kick.wav', 1024);
      eventBus.emit('sample:load-request', { row: 0, file });

      // Wait for async chain
      await vi.waitFor(() => {
        expect(sampleEngineMock.loadSample).toHaveBeenCalled();
      });

      expect(sampleEngineMock.loadSample).toHaveBeenCalledWith(
        audioEngineMock.ctx, 0, expect.any(ArrayBuffer), 'kick.wav',
      );
      expect(audioEngineMock.useSample[0]).toBe(true);
      expect(emitted).toContain('loaded');
      expect(emitted).toContain('toggled');
      expect(sampleStorageMock.saveSample).toHaveBeenCalledWith(0, 'kick.wav', expect.any(ArrayBuffer), 0, 1, false);
      expect(showToast).toHaveBeenCalledWith('Sample loaded: kick.wav', 'success');

      off1();
      off2();
    });

    it('storage full: shows warning, does NOT load', async () => {
      sampleStorageMock.getTotalSize.mockResolvedValue(50 * 1024 * 1024);

      const file = createMockFile('big.wav', 1024);
      eventBus.emit('sample:load-request', { row: 1, file });

      await vi.waitFor(() => {
        expect(showToast).toHaveBeenCalled();
      });

      expect(showToast).toHaveBeenCalledWith('Sample storage full (50MB limit)', 'warning');
      expect(sampleEngineMock.loadSample).not.toHaveBeenCalled();
    });

    it('decode failure: shows warning toast', async () => {
      sampleEngineMock.loadSample.mockRejectedValueOnce(new Error('decode error'));

      const file = createMockFile('bad.wav', 512);
      eventBus.emit('sample:load-request', { row: 2, file });

      await vi.waitFor(() => {
        expect(showToast).toHaveBeenCalled();
      });

      expect(showToast).toHaveBeenCalledWith('Failed to load sample', 'warning');
    });
  });

  describe('sample:removed', () => {
    it('removes sample, sets useSample false, removes from storage, toasts', () => {
      audioEngineMock.useSample[3] = true;
      eventBus.emit('sample:removed', { row: 3 });

      expect(sampleEngineMock.removeSample).toHaveBeenCalledWith(3);
      expect(audioEngineMock.useSample[3]).toBe(false);
      expect(sampleStorageMock.removeSample).toHaveBeenCalledWith(3);
      expect(showToast).toHaveBeenCalledWith('Sample removed');
    });
  });

  describe('sample:mode-toggled', () => {
    it('sets useSample[row] to provided value', () => {
      eventBus.emit('sample:mode-toggled', { row: 5, useSample: true });
      expect(audioEngineMock.useSample[5]).toBe(true);

      eventBus.emit('sample:mode-toggled', { row: 5, useSample: false });
      expect(audioEngineMock.useSample[5]).toBe(false);
    });
  });

  describe('sample:meta-changed', () => {
    it('with existing buffer + record: re-saves with updated meta', async () => {
      sampleEngineMock.getBuffer.mockReturnValue({} as never);
      sampleStorageMock.loadSample.mockResolvedValue({
        arrayBuffer: new ArrayBuffer(64),
        filename: 'old.wav',
      } as never);

      const meta = { filename: 'test.wav', trimStart: 0.1, trimEnd: 0.9, loop: true };
      eventBus.emit('sample:meta-changed', { row: 4, meta });

      await vi.waitFor(() => {
        expect(sampleStorageMock.saveSample).toHaveBeenCalled();
      });

      expect(sampleStorageMock.loadSample).toHaveBeenCalledWith(4);
      expect(sampleStorageMock.saveSample).toHaveBeenCalledWith(
        4, 'test.wav', expect.any(ArrayBuffer), 0.1, 0.9, true,
      );
    });

    it('without buffer: does NOT call loadSample on storage', () => {
      sampleEngineMock.getBuffer.mockReturnValue(null);

      const meta = { filename: 'x.wav', trimStart: 0, trimEnd: 1, loop: false };
      eventBus.emit('sample:meta-changed', { row: 6, meta });

      expect(sampleStorageMock.loadSample).not.toHaveBeenCalled();
    });

    it('with buffer but no record in storage: does NOT re-save', async () => {
      sampleEngineMock.getBuffer.mockReturnValue({} as never);
      sampleStorageMock.loadSample.mockResolvedValue(null);

      const meta = { filename: 'gone.wav', trimStart: 0, trimEnd: 1, loop: false };
      eventBus.emit('sample:meta-changed', { row: 7, meta });

      await vi.waitFor(() => {
        expect(sampleStorageMock.loadSample).toHaveBeenCalled();
      });

      expect(sampleStorageMock.saveSample).not.toHaveBeenCalled();
    });
  });
});
