import type { MidiDeviceInfo } from '../types';
import { eventBus } from '../utils/event-bus';
import { parseMidiMessage } from './midi-message';

type NoteHandler = (note: number, velocity: number, channel: number) => void;
type CCHandler = (cc: number, value: number, channel: number) => void;
type ClockHandler = (status: number) => void;

export class MidiManager {
  private access: MIDIAccess | null = null;
  private inputs: MIDIInput[] = [];
  private noteHandler: NoteHandler | null = null;
  private ccHandler: CCHandler | null = null;
  private clockHandler: ClockHandler | null = null;
  private _available = false;

  get available(): boolean { return this._available; }
  get midiAccess(): MIDIAccess | null { return this.access; }

  get connectedDevices(): MidiDeviceInfo[] {
    return this.inputs.map((i) => ({
      id: i.id,
      name: i.name ?? 'Unknown MIDI Device',
      manufacturer: i.manufacturer ?? '',
    }));
  }

  async init(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) {
      this._available = false;
      return false;
    }
    try {
      this.access = await navigator.requestMIDIAccess();
      this._available = true;
      this.access.onstatechange = () => this.updateDevices();
      this.updateDevices();
      return true;
    } catch {
      this._available = false;
      return false;
    }
  }

  onNote(handler: NoteHandler): void {
    this.noteHandler = handler;
  }

  onCC(handler: CCHandler): void {
    this.ccHandler = handler;
  }

  onClock(handler: ClockHandler): void {
    this.clockHandler = handler;
  }

  private updateDevices(): void {
    if (!this.access) return;

    // Disconnect old inputs
    for (const input of this.inputs) {
      input.onmidimessage = null;
    }

    // Connect new inputs
    this.inputs = [];
    this.access.inputs.forEach((input) => {
      if (input.state === 'connected') {
        this.inputs.push(input);
        input.onmidimessage = (e) => this.handleMessage(e);
      }
    });

    eventBus.emit('midi:devices-changed', this.connectedDevices);
  }

  private handleMessage(event: MIDIMessageEvent): void {
    const msg = parseMidiMessage(event.data as unknown as Uint8Array);
    if (!msg) return;

    if (msg.type === 'system') {
      this.clockHandler?.(msg.status);
      return;
    }

    eventBus.emit('midi:activity');

    if (msg.type === 'note-on') {
      this.noteHandler?.(msg.note, msg.velocity, msg.channel);
    } else if (msg.type === 'cc') {
      this.ccHandler?.(msg.cc, msg.value, msg.channel);
    }
  }
}
