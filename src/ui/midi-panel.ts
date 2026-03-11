import type { MidiManager } from '../midi/midi-manager';
import type { MidiLearn } from '../midi/midi-learn';
import type { MidiOutput } from '../midi/midi-output';
import type { MidiClock } from '../midi/midi-clock';
import type { Sequencer } from '../sequencer/sequencer';
import type { MidiDeviceInfo, MidiCCMapping, ClockMode } from '../types';
import { NUM_ROWS } from '../types';
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

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

function midiNoteToName(note: number): string {
  const octave = Math.floor(note / 12) - 1;
  return `${NOTE_NAMES[note % 12]}${octave}`;
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
  private outputDots: HTMLElement[] = [];
  private outputDotTimers: (number | null)[] = Array.from({ length: NUM_ROWS }, () => null);
  private outputPortSelect: HTMLSelectElement | null = null;
  private outputEnableCheckbox: HTMLInputElement | null = null;
  private clockRadios: HTMLInputElement[] = [];

  constructor(
    parent: HTMLElement,
    midiManager: MidiManager,
    private midiLearn: MidiLearn,
    private readonly midiOutput?: MidiOutput,
    private readonly midiClock?: MidiClock,
    private readonly sequencer?: Sequencer,
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

    // Output section (Round 13)
    if (this.midiOutput && this.sequencer) {
      this.buildOutputSection();
    }

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
    eventBus.on('midi:output-note', ({ row }) => this.flashOutputDot(row));
    eventBus.on('midi:output-ports-changed', () => this.updateOutputPortSelect());
    eventBus.on('midi:output-enabled-changed', (enabled) => {
      if (this.outputEnableCheckbox) this.outputEnableCheckbox.checked = enabled;
    });

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

  private buildOutputSection(): void {
    const seq = this.sequencer!;
    const output = this.midiOutput!;

    const section = document.createElement('div');
    section.className = 'midi-section';
    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'midi-section-title';
    sectionTitle.textContent = 'Output';
    section.appendChild(sectionTitle);

    // Global enable + port selector row
    const headerRow = document.createElement('div');
    headerRow.className = 'midi-output-header';

    const enableLabel = document.createElement('label');
    enableLabel.className = 'midi-output-enable-label';
    this.outputEnableCheckbox = document.createElement('input');
    this.outputEnableCheckbox.type = 'checkbox';
    this.outputEnableCheckbox.checked = seq.midiOutputGlobalEnabled;
    this.outputEnableCheckbox.addEventListener('change', () => {
      seq.midiOutputGlobalEnabled = this.outputEnableCheckbox!.checked;
    });
    enableLabel.appendChild(this.outputEnableCheckbox);
    const enableText = document.createElement('span');
    enableText.textContent = ' Enabled';
    enableLabel.appendChild(enableText);
    headerRow.appendChild(enableLabel);

    const portLabel = document.createElement('span');
    portLabel.className = 'midi-output-port-label';
    portLabel.textContent = 'Port:';
    headerRow.appendChild(portLabel);

    this.outputPortSelect = document.createElement('select');
    this.outputPortSelect.className = 'midi-output-port-select';
    this.outputPortSelect.addEventListener('change', () => {
      output.setGlobalPort(this.outputPortSelect!.value || null);
    });
    headerRow.appendChild(this.outputPortSelect);
    this.updateOutputPortSelect();

    section.appendChild(headerRow);

    // Clock mode row
    const clockRow = document.createElement('div');
    clockRow.className = 'midi-output-clock-row';
    const clockLabel = document.createElement('span');
    clockLabel.textContent = 'Clock:';
    clockRow.appendChild(clockLabel);

    const clockModes: ClockMode[] = ['off', 'send', 'receive'];
    for (const mode of clockModes) {
      const label = document.createElement('label');
      label.className = 'midi-output-clock-label';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'midi-clock-mode';
      radio.value = mode;
      radio.checked = seq.midiClockMode === mode;
      radio.addEventListener('change', () => {
        if (radio.checked && this.midiClock) {
          this.midiClock.setMode(mode);
        }
      });
      this.clockRadios.push(radio);
      label.appendChild(radio);
      const text = document.createElement('span');
      text.textContent = ` ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
      label.appendChild(text);
      clockRow.appendChild(label);
    }
    section.appendChild(clockRow);

    // Per-row config table
    const table = document.createElement('div');
    table.className = 'midi-output-table';

    // Header
    const tableHeader = document.createElement('div');
    tableHeader.className = 'midi-output-row midi-output-row--header';
    for (const text of ['Row', 'Ch', 'Note', 'On']) {
      const cell = document.createElement('span');
      cell.className = 'midi-output-cell';
      cell.textContent = text;
      tableHeader.appendChild(cell);
    }
    // Activity header
    const actHdr = document.createElement('span');
    actHdr.className = 'midi-output-cell';
    tableHeader.appendChild(actHdr);
    table.appendChild(tableHeader);

    // Rows
    for (let i = 0; i < NUM_ROWS; i++) {
      const cfg = seq.getMidiOutputConfig(i);
      const row = document.createElement('div');
      row.className = 'midi-output-row';

      // Instrument name
      const nameCell = document.createElement('span');
      nameCell.className = 'midi-output-cell midi-output-cell--name';
      nameCell.textContent = INSTRUMENTS[i].name;
      nameCell.style.color = INSTRUMENTS[i].color;
      row.appendChild(nameCell);

      // Channel select
      const chSelect = document.createElement('select');
      chSelect.className = 'midi-output-ch-select';
      for (let ch = 0; ch < 16; ch++) {
        const opt = document.createElement('option');
        opt.value = String(ch);
        opt.textContent = String(ch + 1);
        chSelect.appendChild(opt);
      }
      chSelect.value = String(cfg.channel);
      const rowIdx = i;
      chSelect.addEventListener('change', () => {
        const c = seq.getMidiOutputConfig(rowIdx);
        seq.setMidiOutputConfig(rowIdx, { ...c, channel: parseInt(chSelect.value, 10) });
      });
      const chCell = document.createElement('span');
      chCell.className = 'midi-output-cell';
      chCell.appendChild(chSelect);
      row.appendChild(chCell);

      // Base note
      const noteBtn = document.createElement('button');
      noteBtn.className = 'midi-output-note-btn';
      noteBtn.textContent = midiNoteToName(cfg.baseNote);
      noteBtn.addEventListener('wheel', (e) => {
        e.preventDefault();
        const c = seq.getMidiOutputConfig(rowIdx);
        const delta = e.deltaY < 0 ? 1 : -1;
        const newNote = Math.max(0, Math.min(127, c.baseNote + delta));
        seq.setMidiOutputConfig(rowIdx, { ...c, baseNote: newNote });
        noteBtn.textContent = midiNoteToName(newNote);
      });
      const noteCell = document.createElement('span');
      noteCell.className = 'midi-output-cell';
      noteCell.appendChild(noteBtn);
      row.appendChild(noteCell);

      // Enable checkbox
      const enableCb = document.createElement('input');
      enableCb.type = 'checkbox';
      enableCb.checked = cfg.enabled;
      enableCb.addEventListener('change', () => {
        const c = seq.getMidiOutputConfig(rowIdx);
        seq.setMidiOutputConfig(rowIdx, { ...c, enabled: enableCb.checked });
      });
      const enableCell = document.createElement('span');
      enableCell.className = 'midi-output-cell';
      enableCell.appendChild(enableCb);
      row.appendChild(enableCell);

      // Activity dot
      const dot = document.createElement('span');
      dot.className = 'midi-output-dot';
      this.outputDots.push(dot);
      const dotCell = document.createElement('span');
      dotCell.className = 'midi-output-cell';
      dotCell.appendChild(dot);
      row.appendChild(dotCell);

      table.appendChild(row);
    }

    section.appendChild(table);
    this.panel.appendChild(section);
  }

  private updateOutputPortSelect(): void {
    if (!this.outputPortSelect || !this.midiOutput) return;
    clearChildren(this.outputPortSelect);

    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '(none)';
    this.outputPortSelect.appendChild(noneOpt);

    const ports = this.midiOutput.getOutputPorts();
    for (const port of ports) {
      const opt = document.createElement('option');
      opt.value = port.id;
      opt.textContent = port.name;
      this.outputPortSelect.appendChild(opt);
    }

    // Restore selection
    const currentPort = this.midiOutput.globalPortId;
    if (currentPort) {
      this.outputPortSelect.value = currentPort;
    }
  }

  private flashOutputDot(row: number): void {
    const dot = this.outputDots[row];
    if (!dot) return;
    dot.classList.add('midi-output-dot--active');
    if (this.outputDotTimers[row] !== null) {
      clearTimeout(this.outputDotTimers[row]!);
    }
    this.outputDotTimers[row] = window.setTimeout(() => {
      dot.classList.remove('midi-output-dot--active');
      this.outputDotTimers[row] = null;
    }, 100);
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
