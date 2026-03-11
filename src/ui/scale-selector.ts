import type { Sequencer } from '../sequencer/sequencer';
import { SCALES, NOTE_NAMES } from '../utils/scales';
import { eventBus } from '../utils/event-bus';

export class ScaleSelector {
  constructor(parent: HTMLElement, sequencer: Sequencer) {
    const container = document.createElement('div');
    container.className = 'scale-selector';

    const label = document.createElement('span');
    label.className = 'section-label';
    label.textContent = 'Scale';
    container.appendChild(label);

    const selects = document.createElement('div');
    selects.className = 'scale-selector-row';

    // Root note dropdown
    const rootSelect = document.createElement('select');
    rootSelect.className = 'scale-select';
    for (let i = 0; i < NOTE_NAMES.length; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = NOTE_NAMES[i];
      rootSelect.appendChild(opt);
    }
    rootSelect.value = String(sequencer.rootNote);

    // Scale type dropdown
    const scaleSelect = document.createElement('select');
    scaleSelect.className = 'scale-select';
    for (let i = 0; i < SCALES.length; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = SCALES[i].name;
      scaleSelect.appendChild(opt);
    }
    scaleSelect.value = String(sequencer.selectedScale);

    rootSelect.addEventListener('change', () => {
      sequencer.setScale(sequencer.selectedScale, Number(rootSelect.value));
    });

    scaleSelect.addEventListener('change', () => {
      sequencer.setScale(Number(scaleSelect.value), sequencer.rootNote);
    });

    eventBus.on('scale:changed', ({ scaleIndex, rootNote }) => {
      rootSelect.value = String(rootNote);
      scaleSelect.value = String(scaleIndex);
    });

    selects.appendChild(rootSelect);
    selects.appendChild(scaleSelect);
    container.appendChild(selects);
    parent.appendChild(container);
  }
}
