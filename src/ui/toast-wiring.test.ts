import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { eventBus } from '../utils/event-bus';

vi.mock('./toast', () => ({
  showToast: vi.fn(),
}));

import { showToast } from './toast';
import { wireNotifications } from './toast-wiring';

describe('wireNotifications', () => {
  beforeAll(() => {
    wireNotifications();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bank:queued with bank 0 shows "Bank A queued"', () => {
    eventBus.emit('bank:queued', 0);
    expect(showToast).toHaveBeenCalledWith('Bank A queued');
  });

  it('bank:queued with null does not show toast', () => {
    eventBus.emit('bank:queued', null);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('bank:copied with bank 1 shows success toast', () => {
    eventBus.emit('bank:copied', 1);
    expect(showToast).toHaveBeenCalledWith('Pattern B copied', 'success');
  });

  it('bank:pasted with bank 2 shows success toast', () => {
    eventBus.emit('bank:pasted', 2);
    expect(showToast).toHaveBeenCalledWith('Pattern pasted to C', 'success');
  });

  it('grid:cleared shows "Bank cleared"', () => {
    eventBus.emit('grid:cleared');
    expect(showToast).toHaveBeenCalledWith('Bank cleared');
  });

  it('midi:devices-changed with devices shows device names', () => {
    eventBus.emit('midi:devices-changed', [
      { id: '1', name: 'Keyboard', manufacturer: '' },
      { id: '2', name: 'Pad', manufacturer: '' },
    ]);
    expect(showToast).toHaveBeenCalledWith('MIDI: Keyboard, Pad');
  });

  it('midi:devices-changed with empty array does not show toast', () => {
    eventBus.emit('midi:devices-changed', []);
    expect(showToast).not.toHaveBeenCalled();
  });
});
