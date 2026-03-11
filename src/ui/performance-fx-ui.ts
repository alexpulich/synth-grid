import type { PerformanceFX } from '../audio/performance-fx';
import { eventBus } from '../utils/event-bus';

const FX_LIST = [
  { key: 'tapestop', label: 'Tape Stop', shortcut: 'F1' },
  { key: 'stutter', label: 'Stutter', shortcut: 'F2' },
  { key: 'bitcrush', label: 'Bitcrush', shortcut: 'F3' },
  { key: 'reverbwash', label: 'Rev Wash', shortcut: 'F4' },
] as const;

export class PerformanceFXUI {
  private buttons: Map<string, HTMLButtonElement> = new Map();

  constructor(parent: HTMLElement, _perfFx: PerformanceFX) {
    const panel = document.createElement('div');
    panel.className = 'perf-fx-panel';

    const label = document.createElement('span');
    label.className = 'section-label';
    label.textContent = 'Performance FX (Hold)';
    panel.appendChild(label);

    const row = document.createElement('div');
    row.className = 'perf-fx-row';

    for (const fx of FX_LIST) {
      const btn = document.createElement('button');
      btn.className = 'perf-fx-btn';
      btn.dataset.fx = fx.key;

      const led = document.createElement('span');
      led.className = 'perf-fx-led';
      btn.appendChild(led);

      const keySpan = document.createElement('span');
      keySpan.className = 'perf-fx-key';
      keySpan.textContent = fx.shortcut;
      btn.appendChild(keySpan);
      btn.appendChild(document.createTextNode(fx.label));

      btn.disabled = true; // Visual only — controlled by keyboard
      row.appendChild(btn);
      this.buttons.set(fx.key, btn);
    }

    panel.appendChild(row);
    parent.appendChild(panel);

    eventBus.on('perfx:engaged', (fxName) => {
      const btn = this.buttons.get(fxName);
      if (btn) btn.classList.add('perf-fx-btn--active');
    });

    eventBus.on('perfx:disengaged', (fxName) => {
      const btn = this.buttons.get(fxName);
      if (btn) btn.classList.remove('perf-fx-btn--active');
    });
  }
}
