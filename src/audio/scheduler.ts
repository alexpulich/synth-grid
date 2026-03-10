import type { AudioEngine } from './audio-engine';
import type { Sequencer } from '../sequencer/sequencer';
import { NUM_STEPS, VELOCITY_MAP } from '../types';

function checkCondition(condIndex: number, loopCount: number): boolean {
  switch (condIndex) {
    case 1: return loopCount % 2 === 0;       // 1:2
    case 2: return loopCount % 2 === 1;       // 2:2
    case 3: return loopCount % 4 === 0;       // 1:4
    case 4: return loopCount % 4 === 2;       // 3:4
    case 5: return loopCount > 0;             // !1
    default: return true;
  }
}

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
    this.sequencer.resetLoopCount();
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
    const notes = this.sequencer.getCurrentNoteGrid();
    const ratchets = this.sequencer.getCurrentRatchets();
    const conditions = this.sequencer.getCurrentConditions();
    const stepDuration = 60.0 / this.sequencer.tempo / 4;

    let kickFired = false;

    for (let row = 0; row < grid.length; row++) {
      const vel = grid[row][step];
      if (vel > 0 && this.sequencer.muteState.isRowAudible(row)) {
        // Check trig condition
        const cond = conditions[row][step];
        if (cond > 0 && !checkCondition(cond, this.sequencer.loopCount)) continue;

        const prob = probs[row][step];
        if (prob >= 1.0 || Math.random() < prob) {
          const totalPitch = pitches[row] + notes[row][step];
          const ratchetCount = ratchets[row][step] ?? 1;

          if (ratchetCount > 1) {
            // Subdivide step into ratchetCount evenly spaced triggers
            const subDuration = stepDuration / ratchetCount;
            for (let r = 0; r < ratchetCount; r++) {
              this.audioEngine.trigger(row, time + r * subDuration, VELOCITY_MAP[vel], totalPitch);
            }
          } else {
            this.audioEngine.trigger(row, time, VELOCITY_MAP[vel], totalPitch);
          }

          if (row === 0) kickFired = true;
        }
      }
    }

    // Sidechain ducking: duck rows 1-7 when kick fires
    if (kickFired && this.sequencer.sidechainEnabled) {
      this.audioEngine.scheduleSidechainDuck(
        time,
        this.sequencer.sidechainDepth,
        this.sequencer.sidechainRelease,
        this.sequencer.getCurrentRowVolumes(),
      );
    }

    // Filter locks: find minimum lock value for this step, apply as frequency pulse
    const filterLocks = this.sequencer.getCurrentFilterLocks();
    let minLock = NaN;
    for (let row = 0; row < grid.length; row++) {
      const lock = filterLocks[row][step];
      if (!isNaN(lock) && grid[row][step] > 0) {
        if (isNaN(minLock) || lock < minLock) minLock = lock;
      }
    }
    if (!isNaN(minLock)) {
      this.audioEngine.filter.scheduleFrequencyPulse(minLock, time, stepDuration * 0.9);
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

    // Increment loop count when wrapping
    if (this.currentStep === 0) {
      this.sequencer.incrementLoopCount();

      // Song mode: advance chain
      if (this.sequencer.patternChain.songMode) {
        const nextBank = this.sequencer.patternChain.advanceChain();
        if (nextBank !== null) {
          this.sequencer.setBank(nextBank);
        }
      }
    }
  }
}
