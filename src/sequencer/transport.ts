import type { Sequencer } from './sequencer';
import type { Scheduler } from '../audio/scheduler';
import type { AudioEngine } from '../audio/audio-engine';
import type { MidiOutput } from '../midi/midi-output';
import type { MidiClock } from '../midi/midi-clock';
import { NUM_ROWS } from '../types';
import { eventBus } from '../utils/event-bus';

export class Transport {
  private tapTimes: number[] = [];
  private readonly MAX_TAP_INTERVAL = 2000;
  private midiOutput: MidiOutput | null = null;
  private midiClock: MidiClock | null = null;

  constructor(
    private sequencer: Sequencer,
    private scheduler: Scheduler,
    private audioEngine: AudioEngine,
  ) {
    // Stuck note prevention on page unload
    window.addEventListener('beforeunload', () => this.sendAllNotesOff());
  }

  setMidiOutput(output: MidiOutput): void {
    this.midiOutput = output;
  }

  setMidiClock(clock: MidiClock): void {
    this.midiClock = clock;
  }

  play(): void {
    if (this.sequencer.isPlaying) return;
    this.audioEngine.resume();
    this.sequencer.isPlaying = true;

    // Song mode: reset chain position and set initial bank
    if (this.sequencer.patternChain.songMode && this.sequencer.patternChain.length > 0) {
      this.sequencer.patternChain.resetPosition();
      const initialBank = this.sequencer.patternChain.getCurrentChainBank();
      if (initialBank !== null) {
        this.sequencer.setBank(initialBank);
      }
    }

    this.scheduler.start();
    this.midiClock?.onTransportPlay();
    eventBus.emit('transport:play');
  }

  stop(): void {
    this.sequencer.isPlaying = false;
    this.scheduler.stop();
    this.sendAllNotesOff();
    this.midiClock?.onTransportStop();
    this.sequencer.currentStep = 0;
    this.sequencer.clearQueue();
    eventBus.emit('transport:stop');
  }

  private sendAllNotesOff(): void {
    if (!this.midiOutput) return;
    const sentChannels = new Set<string>();
    for (let row = 0; row < NUM_ROWS; row++) {
      const cfg = this.sequencer.getMidiOutputConfig(row);
      if (cfg.enabled) {
        const key = `${cfg.portId ?? 'global'}:${cfg.channel}`;
        if (!sentChannels.has(key)) {
          sentChannels.add(key);
          this.midiOutput.sendAllNotesOff(cfg.portId, cfg.channel);
        }
      }
    }
  }

  toggle(): void {
    if (this.sequencer.isPlaying) {
      this.stop();
    } else {
      this.play();
    }
  }

  tapTempo(): void {
    const now = performance.now();
    if (this.tapTimes.length > 0) {
      const lastTap = this.tapTimes[this.tapTimes.length - 1];
      if (now - lastTap > this.MAX_TAP_INTERVAL) {
        this.tapTimes = [];
      }
    }
    this.tapTimes.push(now);
    if (this.tapTimes.length >= 2) {
      let totalInterval = 0;
      for (let i = 1; i < this.tapTimes.length; i++) {
        totalInterval += this.tapTimes[i] - this.tapTimes[i - 1];
      }
      const avgInterval = totalInterval / (this.tapTimes.length - 1);
      this.sequencer.tempo = Math.round(60000 / avgInterval);
    }
    if (this.tapTimes.length > 8) {
      this.tapTimes = this.tapTimes.slice(-8);
    }
  }
}
