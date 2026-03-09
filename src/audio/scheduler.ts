import type { AudioEngine } from './audio-engine';
import type { Sequencer } from '../sequencer/sequencer';
import { NUM_STEPS, VELOCITY_MAP } from '../types';

export class Scheduler {
  private readonly LOOKAHEAD_MS = 25;
  private readonly SCHEDULE_AHEAD_S = 0.1;

  private timerId: number | null = null;
  private currentStep = 0;
  private nextStepTime = 0;

  constructor(
    private audioEngine: AudioEngine,
    private sequencer: Sequencer,
    private onStepAdvance: (step: number) => void,
  ) {}

  start(): void {
    this.currentStep = 0;
    this.nextStepTime = this.audioEngine.ctx.currentTime;
    this.tick();
  }

  stop(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private tick = (): void => {
    const currentTime = this.audioEngine.ctx.currentTime;

    while (this.nextStepTime < currentTime + this.SCHEDULE_AHEAD_S) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }

    this.timerId = window.setTimeout(this.tick, this.LOOKAHEAD_MS);
  };

  private scheduleStep(step: number, time: number): void {
    const grid = this.sequencer.getCurrentGrid();
    const probs = this.sequencer.getCurrentProbabilities();
    const pitches = this.sequencer.getCurrentPitchOffsets();

    for (let row = 0; row < grid.length; row++) {
      const vel = grid[row][step];
      if (vel > 0 && this.sequencer.muteState.isRowAudible(row)) {
        const prob = probs[row][step];
        if (prob >= 1.0 || Math.random() < prob) {
          this.audioEngine.trigger(row, time, VELOCITY_MAP[vel], pitches[row]);
        }
      }
    }

    const delayMs = (time - this.audioEngine.ctx.currentTime) * 1000;
    const s = step;
    setTimeout(() => this.onStepAdvance(s), Math.max(0, delayMs));
  }

  private advanceStep(): void {
    const secondsPerStep = 60.0 / this.sequencer.tempo / 4;
    const swingAmount = this.sequencer.swing;

    if (this.currentStep % 2 === 1) {
      this.nextStepTime += secondsPerStep * (1 + swingAmount);
    } else {
      this.nextStepTime += secondsPerStep * (1 - swingAmount);
    }

    this.currentStep = (this.currentStep + 1) % NUM_STEPS;

    // Song mode: advance chain when wrapping back to step 0
    if (this.currentStep === 0 && this.sequencer.patternChain.songMode) {
      const nextBank = this.sequencer.patternChain.advanceChain();
      if (nextBank !== null) {
        this.sequencer.setBank(nextBank);
      }
    }
  }
}
