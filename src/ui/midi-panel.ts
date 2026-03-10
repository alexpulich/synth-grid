import type { MidiManager } from '../midi/midi-manager';
import type { MidiLearn } from '../midi/midi-learn';
import type { MidiDeviceInfo, MidiCCMapping } from '../types';
import { INSTRUMENTS } from '../audio/instruments';
import { eventBus } from '../utils/event-bus';

/** Available CC mapping targets with display names */
const MIDI_TARGETS: { value: string; label: string }[] = [
  { value: 'tempo', label: 'Tempo' },
  { value: 'master-volume', label: 'Master Volume' },
  { value: 'reverb-mix', label: 'Reverb Mix' },
  { value: 'delay-feedback', label: 'Delay Feedback' },
  { value: 'delay-mix', label: 'Delay Mix' },
  { value: 'filter-cutoff', label: 'Filter Cutoff' },
  { value: 'filter-resonance', label: 'Filter Resonance' },
  { value: 'saturation-drive', label: 'Saturation Drive' },
  { value: 'eq-low', label: 'EQ Low' },
  { value: 'eq-mid', label: 'EQ Mid' },
  { value: 'eq-high', label: 'EQ High' },
  { value: 'humanize', label: 'Humanize' },
  ...INSTRUMENTS.map((inst, i) => ({ value: `volume:${i}`, label: `Vol: ${inst.name}` })),
  ...INSTRUMENTS.map((inst, i) => ({ value: `pan:${i}`, label: `Pan: ${inst.name}` })),
];

function clearChildren(el: HTMLElement): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

export class MidiPanel {
  private panel: HTMLElement;
  private visible = false;
  private deviceList: HTMLElement;
  private mappingList: HTMLElement;
  private learnBtn: HTMLButtonElement;
  private learnStatus: HTMLElement;
  private targetSelect: HTMLSelectElement;
  private activityDot: HTMLElement;
  private activityTimer: number | null = null;
  private assignRow: HTMLElement;

  constructor(
    parent: HTMLElement,
    midiManager: MidiManager,
    private midiLearn: MidiLearn,
  ) {
    // MIDI toggle button in controls row
    const btn = document.createElement('button');
    btn.className = 'midi-btn';
    btn.textContent = 'MIDI';
    this.activityDot = document.createElement('span');
    this.activityDot.className = 'midi-activity-dot';
    btn.appendChild(this.activityDot);
    btn.addEventListener('click', () => this.toggle());
    parent.appendChild(btn);

    // Panel (popover)
    this.panel = document.createElement('div');
    this.panel.className = 'midi-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'midi-panel-header';
    const title = document.createElement('span');
    title.textContent = 'MIDI';
    title.className = 'midi-panel-title';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'midi-panel-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);
    this.panel.appendChild(header);

    // Devices section
    const devSection = document.createElement('div');
    devSection.className = 'midi-section';
    const devTitle = document.createElement('div');
    devTitle.className = 'midi-section-title';
    devTitle.textContent = 'Devices';
    devSection.appendChild(devTitle);
    this.deviceList = document.createElement('div');
    this.deviceList.className = 'midi-device-list';
    devSection.appendChild(this.deviceList);
    this.panel.appendChild(devSection);

    // Learn section
    const learnSection = document.createElement('div');
    learnSection.className = 'midi-section';
    const learnTitle = document.createElement('div');
    learnTitle.className = 'midi-section-title';
    learnTitle.textContent = 'CC Mapping';
    learnSection.appendChild(learnTitle);

    const learnRow = document.createElement('div');
    learnRow.className = 'midi-learn-row';

    this.learnBtn = document.createElement('button');
    this.learnBtn.className = 'midi-learn-btn';
    this.learnBtn.textContent = 'Learn';
    this.learnBtn.addEventListener('click', () => {
      if (this.midiLearn.armed) {
        this.midiLearn.cancelLearn();
      } else {
        this.midiLearn.armLearn();
      }
    });
    learnRow.appendChild(this.learnBtn);

    this.learnStatus = document.createElement('span');
    this.learnStatus.className = 'midi-learn-status';
    learnRow.appendChild(this.learnStatus);

    learnSection.appendChild(learnRow);

    // Target selector (shown after CC captured)
    this.assignRow = document.createElement('div');
    this.assignRow.className = 'midi-assign-row';
    this.assignRow.style.display = 'none';

    this.targetSelect = document.createElement('select');
    this.targetSelect.className = 'midi-target-select';
    for (const target of MIDI_TARGETS) {
      const opt = document.createElement('option');
      opt.value = target.value;
      opt.textContent = target.label;
      this.targetSelect.appendChild(opt);
    }
    this.assignRow.appendChild(this.targetSelect);

    const assignBtn = document.createElement('button');
    assignBtn.className = 'midi-assign-btn';
    assignBtn.textContent = 'Assign';
    assignBtn.addEventListener('click', () => {
      this.midiLearn.assignTarget(this.targetSelect.value);
      this.assignRow.style.display = 'none';
    });
    this.assignRow.appendChild(assignBtn);

    learnSection.appendChild(this.assignRow);
    this.panel.appendChild(learnSection);

    // Mappings list
    const mapSection = document.createElement('div');
    mapSection.className = 'midi-section';
    const mapTitle = document.createElement('div');
    mapTitle.className = 'midi-section-title';
    mapTitle.textContent = 'Active Mappings';
    mapSection.appendChild(mapTitle);
    this.mappingList = document.createElement('div');
    this.mappingList.className = 'midi-mapping-list';
    mapSection.appendChild(this.mappingList);
    this.panel.appendChild(mapSection);

    parent.appendChild(this.panel);

    // Wire events
    eventBus.on('midi:devices-changed', (devices) => this.updateDevices(devices));
    eventBus.on('midi:learn-toggle', (armed) => this.updateLearnState(armed));
    eventBus.on('midi:cc-captured', ({ cc, channel }) => {
      this.learnStatus.textContent = `CC ${cc} (ch ${channel + 1})`;
      this.assignRow.style.display = 'flex';
    });
    eventBus.on('midi:mapping-changed', (mappings) => this.updateMappings(mappings));
    eventBus.on('midi:activity', () => this.flashActivity());

    // Init device list
    this.updateDevices(midiManager.connectedDevices);
    this.updateMappings(midiLearn.currentMappings);
  }

  private toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  private show(): void {
    this.visible = true;
    this.panel.classList.add('midi-panel--visible');
  }

  private hide(): void {
    this.visible = false;
    this.panel.classList.remove('midi-panel--visible');
  }

  private updateDevices(devices: MidiDeviceInfo[]): void {
    clearChildren(this.deviceList);
    if (devices.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'midi-empty';
      empty.textContent = 'No MIDI devices connected';
      this.deviceList.appendChild(empty);
      return;
    }
    for (const dev of devices) {
      const el = document.createElement('div');
      el.className = 'midi-device';
      el.textContent = dev.name;
      this.deviceList.appendChild(el);
    }
  }

  private updateLearnState(armed: boolean): void {
    this.learnBtn.classList.toggle('midi-learn-btn--active', armed);
    this.learnBtn.textContent = armed ? 'Cancel' : 'Learn';
    if (!armed) {
      this.learnStatus.textContent = '';
      this.assignRow.style.display = 'none';
    } else {
      this.learnStatus.textContent = 'Move a MIDI knob\u2026';
    }
  }

  private updateMappings(mappings: MidiCCMapping[]): void {
    clearChildren(this.mappingList);
    if (mappings.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'midi-empty';
      empty.textContent = 'No CC mappings';
      this.mappingList.appendChild(empty);
      return;
    }
    for (const mapping of mappings) {
      const row = document.createElement('div');
      row.className = 'midi-mapping-row';

      const info = document.createElement('span');
      info.className = 'midi-mapping-info';
      const targetLabel = MIDI_TARGETS.find((t) => t.value === mapping.target)?.label ?? mapping.target;
      info.textContent = `CC ${mapping.cc} (ch ${mapping.channel + 1}) \u2192 ${targetLabel}`;
      row.appendChild(info);

      const delBtn = document.createElement('button');
      delBtn.className = 'midi-mapping-delete';
      delBtn.textContent = '\u00d7';
      delBtn.addEventListener('click', () => this.midiLearn.removeMapping(mapping.target));
      row.appendChild(delBtn);

      this.mappingList.appendChild(row);
    }
  }

  private flashActivity(): void {
    this.activityDot.classList.add('midi-activity-dot--active');
    if (this.activityTimer !== null) {
      clearTimeout(this.activityTimer);
    }
    this.activityTimer = window.setTimeout(() => {
      this.activityDot.classList.remove('midi-activity-dot--active');
      this.activityTimer = null;
    }, 100);
  }
}
