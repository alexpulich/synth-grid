import { eventBus } from '../utils/event-bus';
import { showToast } from './toast';

export function wireNotifications(): void {
  const bankNames = ['A', 'B', 'C', 'D'];
  eventBus.on('bank:queued', (bank) => {
    if (bank !== null) showToast(`Bank ${bankNames[bank]} queued`);
  });
  eventBus.on('bank:copied', (bank) => showToast(`Pattern ${bankNames[bank]} copied`, 'success'));
  eventBus.on('bank:pasted', (bank) => showToast(`Pattern pasted to ${bankNames[bank]}`, 'success'));
  eventBus.on('grid:cleared', () => showToast('Bank cleared'));
  eventBus.on('midi:devices-changed', (devices) => {
    if (devices.length > 0) {
      showToast(`MIDI: ${devices.map((d) => d.name).join(', ')}`);
    }
  });
}
