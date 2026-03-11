import type { MidiDeviceInfo } from '../types';
import { eventBus } from '../utils/event-bus';

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
    port.send([0x90 | (channel & 0x0f), note & 0x7f, Math.round(velocity * 127) & 0x7f]);
  }

  sendNoteOff(portId: string | null, channel: number, note: number): void {
    const port = this.resolvePort(portId);
    if (!port) return;
    port.send([0x80 | (channel & 0x0f), note & 0x7f, 0]);
  }

  sendAllNotesOff(portId: string | null, channel: number): void {
    const port = this.resolvePort(portId);
    if (!port) return;
    port.send([0xb0 | (channel & 0x0f), 123, 0]);
  }

  sendClock(portId: string | null): void {
    const port = this.resolvePort(portId);
    if (!port) return;
    port.send([0xf8]);
  }

  sendStart(portId: string | null): void {
    const port = this.resolvePort(portId);
    if (!port) return;
    port.send([0xfa]);
  }

  sendStop(portId: string | null): void {
    const port = this.resolvePort(portId);
    if (!port) return;
    port.send([0xfc]);
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
