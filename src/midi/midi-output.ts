import type { MidiDeviceInfo } from '../types';
import { eventBus } from '../utils/event-bus';
import { buildNoteOn, buildNoteOff, buildAllNotesOff, MIDI_CLOCK, MIDI_START, MIDI_STOP } from './midi-message';

export class MidiOutput {
  private access: MIDIAccess | null = null;
  private outputMap = new Map<string, MIDIOutput>();
  private _globalPortId: string | null = null;

  get globalPortId(): string | null { return this._globalPortId; }

  init(access: MIDIAccess): void {
    this.access = access;
    this.updateOutputs();
    const prev = access.onstatechange;
    access.onstatechange = (e) => {
      if (prev) prev.call(access, e);
      this.updateOutputs();
    };
  }

  getOutputPorts(): MidiDeviceInfo[] {
    const ports: MidiDeviceInfo[] = [];
    this.access?.outputs.forEach((output) => {
      if (output.state === 'connected') {
        ports.push({
          id: output.id,
          name: output.name ?? 'Unknown MIDI Output',
          manufacturer: output.manufacturer ?? '',
        });
      }
    });
    return ports;
  }

  setGlobalPort(portId: string | null): void {
    this._globalPortId = portId;
  }

  sendNoteOn(portId: string | null, channel: number, note: number, velocity: number): void {
    const port = this.resolvePort(portId);
    if (!port) return;
    port.send(buildNoteOn(channel, note, velocity));
  }

  sendNoteOff(portId: string | null, channel: number, note: number): void {
    const port = this.resolvePort(portId);
    if (!port) return;
    port.send(buildNoteOff(channel, note));
  }

  sendAllNotesOff(portId: string | null, channel: number): void {
    const port = this.resolvePort(portId);
    if (!port) return;
    port.send(buildAllNotesOff(channel));
  }

  sendClock(portId: string | null): void {
    const port = this.resolvePort(portId);
    if (!port) return;
    port.send(MIDI_CLOCK);
  }

  sendStart(portId: string | null): void {
    const port = this.resolvePort(portId);
    if (!port) return;
    port.send(MIDI_START);
  }

  sendStop(portId: string | null): void {
    const port = this.resolvePort(portId);
    if (!port) return;
    port.send(MIDI_STOP);
  }

  private resolvePort(portId: string | null): MIDIOutput | null {
    const id = portId ?? this._globalPortId;
    return id ? (this.outputMap.get(id) ?? null) : null;
  }

  private updateOutputs(): void {
    this.outputMap.clear();
    this.access?.outputs.forEach((output) => {
      if (output.state === 'connected') {
        this.outputMap.set(output.id, output);
      }
    });
    eventBus.emit('midi:output-ports-changed', this.getOutputPorts());
  }
}
