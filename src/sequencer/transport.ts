import type { Sequencer } from './sequencer';
import type { Scheduler } from '../audio/scheduler';
import type { AudioEngine } from '../audio/audio-engine';
import { eventBus } from '../utils/event-bus';

export class Transport {
  private tapTimes: number[] = [];
  private readonly MAX_TAP_INTERVAL = 2000;

  constructor(
    private sequencer: Sequencer,
    private scheduler: Scheduler,
    private audioEngine: AudioEngine,
  ) {}

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
    eventBus.emit('transport:play');
  }

  stop(): void {
    this.sequencer.isPlaying = false;
    this.scheduler.stop();
    this.sequencer.currentStep = 0;
    eventBus.emit('transport:stop');
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
