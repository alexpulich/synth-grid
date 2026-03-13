import type { MidiOutput } from './midi-output';
import type { Sequencer } from '../sequencer/sequencer';
import type { Transport } from '../sequencer/transport';
import type { ClockMode } from '../types';
import { eventBus } from '../utils/event-bus';

/** Derive BPM from an array of clock tick timestamps (ms). Returns null if insufficient data or out of range. */
export function deriveBpmFromClockTimes(times: number[]): number | null {
  if (times.length < 6) return null;
  let totalInterval = 0;
  for (let i = 1; i < times.length; i++) {
    totalInterval += times[i] - times[i - 1];
  }
  const avgInterval = totalInterval / (times.length - 1);
  const bpm = Math.round(60000 / (avgInterval * 24));
  if (bpm >= 30 && bpm <= 300) return bpm;
  return null;
}

export class MidiClock {
  private sendTimerId: number | null = null;
  private receivedClockTimes: number[] = [];
  private _transport: Transport | null = null;

  constructor(
    private midiOutput: MidiOutput,
    private sequencer: Sequencer,
  ) {
    // Re-sync send interval when tempo changes
    eventBus.on('tempo:changed', () => {
      if (this.sequencer.midiClockMode === 'send' && this.sendTimerId !== null) {
        this.restartSendInterval();
      }
    });
  }

  /** Late-bind transport to avoid circular dependency */
  setTransport(transport: Transport): void {
    this._transport = transport;
  }

  get mode(): ClockMode { return this.sequencer.midiClockMode; }

  setMode(mode: ClockMode): void {
    if (this.sequencer.midiClockMode === 'send') this.stopSending();
    this.receivedClockTimes = [];
    this.sequencer.midiClockMode = mode;
  }

  onTransportPlay(): void {
    if (this.sequencer.midiClockMode === 'send') {
      this.midiOutput.sendStart(null);
      this.startSendingClock();
    }
  }

  onTransportStop(): void {
    if (this.sequencer.midiClockMode === 'send') {
      this.stopSending();
      this.midiOutput.sendStop(null);
    }
  }

  /** Process incoming system real-time MIDI byte */
  handleClockByte(status: number): void {
    if (this.sequencer.midiClockMode !== 'receive') return;

    if (status === 0xf8) {
      // Clock tick — derive BPM from intervals
      const now = performance.now();
      this.receivedClockTimes.push(now);
      if (this.receivedClockTimes.length > 48) {
        this.receivedClockTimes = this.receivedClockTimes.slice(-48);
      }
      const bpm = deriveBpmFromClockTimes(this.receivedClockTimes);
      if (bpm !== null) {
        this.sequencer.tempo = bpm;
      }
    } else if (status === 0xfa) {
      // Start
      this.receivedClockTimes = [];
      this._transport?.play();
    } else if (status === 0xfc) {
      // Stop
      this._transport?.stop();
    }
  }

  private startSendingClock(): void {
    const intervalMs = (60 / this.sequencer.tempo / 24) * 1000;
    this.sendTimerId = window.setInterval(() => {
      this.midiOutput.sendClock(null);
    }, intervalMs);
  }

  private stopSending(): void {
    if (this.sendTimerId !== null) {
      clearInterval(this.sendTimerId);
      this.sendTimerId = null;
    }
  }

  private restartSendInterval(): void {
    this.stopSending();
    this.startSendingClock();
  }
}
