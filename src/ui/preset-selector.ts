import type { Sequencer } from '../sequencer/sequencer';
import { PRESETS } from '../data/presets';

export class PresetSelector {
  constructor(parent: HTMLElement, private sequencer: Sequencer) {
    const container = document.createElement('div');
    container.className = 'preset-selector';

    const label = document.createElement('span');
    label.className = 'preset-selector-label';
    label.textContent = 'Preset';
    container.appendChild(label);

    const select = document.createElement('select');
    select.className = 'preset-select';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— Select —';
    select.appendChild(defaultOpt);

    PRESETS.forEach((preset, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = preset.name;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      const idx = Number(select.value);
      if (!isNaN(idx) && PRESETS[idx]) {
        this.sequencer.loadGrid(PRESETS[idx].grid);
        select.value = '';
      }
    });

    container.appendChild(select);
    parent.appendChild(container);
  }
}
