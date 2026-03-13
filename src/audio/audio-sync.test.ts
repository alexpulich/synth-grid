import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { eventBus } from '../utils/event-bus';
import { wireAudioSync } from './audio-sync';
import { NUM_ROWS } from '../types';

const sequencerMock = {
  getCurrentRowVolumes: vi.fn(() => Array(NUM_ROWS).fill(0.8)),
  getCurrentRowPans: vi.fn(() => Array(NUM_ROWS).fill(0)),
  getCurrentReverbSends: vi.fn(() => Array(NUM_ROWS).fill(0.2)),
  getCurrentDelaySends: vi.fn(() => Array(NUM_ROWS).fill(0.1)),
};

const audioEngineMock = {
  setRowVolume: vi.fn(),
  setRowPan: vi.fn(),
  setRowReverbSend: vi.fn(),
  setRowDelaySend: vi.fn(),
  soundParams: Array.from({ length: NUM_ROWS }, () => ({})),
};

describe('wireAudioSync', () => {
  beforeAll(() => {
    wireAudioSync(sequencerMock as never, audioEngineMock as never);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('volume:changed calls audioEngine.setRowVolume', () => {
    eventBus.emit('volume:changed', { row: 2, volume: 0.5 });
    expect(audioEngineMock.setRowVolume).toHaveBeenCalledWith(2, 0.5);
  });

  it('pan:changed calls audioEngine.setRowPan', () => {
    eventBus.emit('pan:changed', { row: 3, pan: -0.7 });
    expect(audioEngineMock.setRowPan).toHaveBeenCalledWith(3, -0.7);
  });

  it('send:reverb-changed calls audioEngine.setRowReverbSend', () => {
    eventBus.emit('send:reverb-changed', { row: 1, value: 0.6 });
    expect(audioEngineMock.setRowReverbSend).toHaveBeenCalledWith(1, 0.6);
  });

  it('send:delay-changed calls audioEngine.setRowDelaySend', () => {
    eventBus.emit('send:delay-changed', { row: 4, value: 0.3 });
    expect(audioEngineMock.setRowDelaySend).toHaveBeenCalledWith(4, 0.3);
  });

  it('soundparam:changed assigns to audioEngine.soundParams[row]', () => {
    const params = { attack: 0.1, decay: 0.2 };
    eventBus.emit('soundparam:changed', { row: 5, params: params as never });
    expect(audioEngineMock.soundParams[5]).toEqual(params);
  });

  it('bank:changed resyncs all rows', () => {
    eventBus.emit('bank:changed', 1);
    expect(audioEngineMock.setRowVolume).toHaveBeenCalledTimes(NUM_ROWS);
    expect(audioEngineMock.setRowPan).toHaveBeenCalledTimes(NUM_ROWS);
    expect(audioEngineMock.setRowReverbSend).toHaveBeenCalledTimes(NUM_ROWS);
    expect(audioEngineMock.setRowDelaySend).toHaveBeenCalledTimes(NUM_ROWS);
  });

  it('grid:cleared resyncs all rows', () => {
    eventBus.emit('grid:cleared');
    expect(audioEngineMock.setRowVolume).toHaveBeenCalledTimes(NUM_ROWS);
    expect(audioEngineMock.setRowPan).toHaveBeenCalledTimes(NUM_ROWS);
  });

  it('resync reads correct current values from sequencer', () => {
    sequencerMock.getCurrentRowVolumes.mockReturnValueOnce(
      [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3],
    );
    eventBus.emit('bank:changed', 0);
    expect(audioEngineMock.setRowVolume).toHaveBeenCalledWith(0, 1);
    expect(audioEngineMock.setRowVolume).toHaveBeenCalledWith(7, 0.3);
  });
});
