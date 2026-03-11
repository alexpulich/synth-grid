import type { MidiDeviceInfo } from '../types';
import { eventBus } from '../utils/event-bus';

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
    const data = event.data;
    if (!data || data.length < 1) return;

    // System real-time messages (single byte, no channel)
    if (data[0] >= 0xf0) {
      if (this.clockHandler) {
        this.clockHandler(data[0]);
      }
      return;
    }

    if (data.length < 2) return;

    const status = data[0] & 0xf0;
    const channel = data[0] & 0x0f;

    eventBus.emit('midi:activity');

    if (status === 0x90 && data.length >= 3) {
      // Note On (velocity 0 = note off)
      const note = data[1];
      const velocity = data[2];
      if (velocity > 0 && this.noteHandler) {
        this.noteHandler(note, velocity, channel);
      }
    } else if (status === 0xb0 && data.length >= 3) {
      // Control Change
      const cc = data[1];
      const value = data[2];
      if (this.ccHandler) {
        this.ccHandler(cc, value, channel);
      }
    }
  }
}
