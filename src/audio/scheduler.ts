import type { AudioEngine } from './audio-engine';
import type { Sequencer } from '../sequencer/sequencer';
import type { MidiOutput } from '../midi/midi-output';
import { NUM_STEPS, VELOCITY_MAP, GATE_LEVELS, MELODIC_ROWS } from '../types';
import { eventBus } from '../utils/event-bus';

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
    private readonly midiOutput?: MidiOutput,
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
    const rowLengths = this.sequencer.getCurrentRowLengths();
    const stepDuration = 60.0 / this.sequencer.tempo / 4;
    const ctxTime = this.audioEngine.ctx.currentTime;

    const kickFired = this.scheduleNotes(step, time, grid, rowLengths, stepDuration, ctxTime);

    // Sidechain ducking: duck rows 1-7 when kick fires
    if (kickFired && this.sequencer.sidechainEnabled) {
      this.audioEngine.scheduleSidechainDuck(
        time,
        this.sequencer.sidechainDepth,
        this.sequencer.sidechainRelease,
        this.sequencer.getCurrentRowVolumes(),
      );
    }

    this.scheduleFilterLocks(step, time, grid, rowLengths, stepDuration);
    this.scheduleAutomation(step, time, grid, rowLengths);

    // Metronome: click on beat boundaries (steps 0, 4, 8, 12)
    if (step % 4 === 0) {
      this.audioEngine.metronome.scheduleClick(time, step === 0);
      const beat = step / 4;
      setTimeout(() => eventBus.emit('metronome:beat', beat), Math.max(0, (time - ctxTime) * 1000));
    }

    const delayMs = (time - ctxTime) * 1000;
    const s = step;
    setTimeout(() => this.onStepAdvance(s), Math.max(0, delayMs));
  }

  private scheduleNotes(
    step: number, time: number, grid: number[][], rowLengths: number[],
    stepDuration: number, ctxTime: number,
  ): boolean {
    const probs = this.sequencer.getCurrentProbabilities();
    const pitches = this.sequencer.getCurrentPitchOffsets();
    const notes = this.sequencer.getCurrentNoteGrid();
    const ratchets = this.sequencer.getCurrentRatchets();
    const conditions = this.sequencer.getCurrentConditions();
    const gates = this.sequencer.getCurrentGates();
    const slides = this.sequencer.getCurrentSlides();
    const rowSwings = this.sequencer.getCurrentRowSwings();
    const humanize = this.sequencer.humanize;
    let kickFired = false;

    for (let row = 0; row < grid.length; row++) {
      const rowLen = rowLengths[row] ?? NUM_STEPS;
      const rowStep = step % rowLen;
      const vel = grid[row][rowStep];
      if (vel > 0 && this.sequencer.muteState.isRowAudible(row)) {
        const cond = conditions[row][rowStep];
        if (cond > 0 && !checkCondition(cond, this.sequencer.loopCount)) continue;

        const prob = probs[row][rowStep];
        if (prob >= 1.0 || Math.random() < prob) {
          const totalPitch = pitches[row] + notes[row][rowStep];
          const ratchetCount = ratchets[row][rowStep] ?? 1;
          const gateLevel = gates[row][rowStep] ?? 1;
          const gateDuration = stepDuration * GATE_LEVELS[gateLevel];

          let triggerTime = time;
          if (rowStep % 2 === 1) {
            triggerTime += rowSwings[row] * stepDuration;
          }

          let glideFrom: number | undefined;
          if (MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number]) && slides[row][rowStep]) {
            for (let s = 1; s <= rowLen; s++) {
              const prevStep = (rowStep - s + rowLen) % rowLen;
              if (grid[row][prevStep] > 0) {
                glideFrom = pitches[row] + notes[row][prevStep];
                break;
              }
            }
          }

          if (ratchetCount > 1) {
            const subDuration = stepDuration / ratchetCount;
            for (let r = 0; r < ratchetCount; r++) {
              let subTime = triggerTime + r * subDuration;
              let subVel = VELOCITY_MAP[vel];
              if (humanize > 0) {
                subTime += (Math.random() - 0.5) * 2 * humanize * 0.08 * subDuration;
                subTime = Math.max(subTime, ctxTime);
                subVel *= 1 + (Math.random() - 0.5) * 2 * humanize * 0.2;
                subVel = Math.max(0.01, Math.min(1.0, subVel));
              }
              this.audioEngine.trigger(row, subTime, subVel, totalPitch, gateDuration / ratchetCount, r === 0 ? glideFrom : undefined);
              this.scheduleMidiNote(row, totalPitch, subVel, subTime, gateDuration / ratchetCount, ctxTime);
            }
          } else {
            let tVel = VELOCITY_MAP[vel];
            if (humanize > 0) {
              triggerTime += (Math.random() - 0.5) * 2 * humanize * 0.08 * stepDuration;
              triggerTime = Math.max(triggerTime, ctxTime);
              tVel *= 1 + (Math.random() - 0.5) * 2 * humanize * 0.2;
              tVel = Math.max(0.01, Math.min(1.0, tVel));
            }
            this.audioEngine.trigger(row, triggerTime, tVel, totalPitch, gateDuration, glideFrom);
            this.scheduleMidiNote(row, totalPitch, tVel, triggerTime, gateDuration, ctxTime);
          }

          if (row === 0) kickFired = true;
        }
      }
    }

    return kickFired;
  }

  private scheduleFilterLocks(
    step: number, time: number, grid: number[][], rowLengths: number[], stepDuration: number,
  ): void {
    const filterLocks = this.sequencer.getCurrentFilterLocks();
    let minLock = NaN;
    for (let row = 0; row < grid.length; row++) {
      const rowLen = rowLengths[row] ?? NUM_STEPS;
      const rowStep = step % rowLen;
      const lock = filterLocks[row][rowStep];
      if (!isNaN(lock) && grid[row][rowStep] > 0) {
        if (isNaN(minLock) || lock < minLock) minLock = lock;
      }
    }
    if (!isNaN(minLock)) {
      this.audioEngine.filter.scheduleFrequencyPulse(minLock, time, stepDuration * 0.9);
    }
  }

  private scheduleAutomation(
    step: number, time: number, grid: number[][], rowLengths: number[],
  ): void {
    const automation = this.sequencer.getCurrentAutomation();
    const rowVolumes = this.sequencer.getCurrentRowVolumes();
    const rowPans = this.sequencer.getCurrentRowPans();
    const reverbSends = this.sequencer.getCurrentReverbSends();
    const delaySends = this.sequencer.getCurrentDelaySends();
    for (let row = 0; row < grid.length; row++) {
      const rowLen = rowLengths[row] ?? NUM_STEPS;
      const rowStep = step % rowLen;
      const volAuto = automation[0]?.[row]?.[rowStep] ?? NaN;
      const panAuto = automation[1]?.[row]?.[rowStep] ?? NaN;
      const revAuto = automation[2]?.[row]?.[rowStep] ?? NaN;
      const delAuto = automation[3]?.[row]?.[rowStep] ?? NaN;

      if (!isNaN(volAuto)) {
        this.audioEngine.scheduleRowVolume(row, volAuto, time);
      } else {
        this.audioEngine.scheduleRowVolume(row, rowVolumes[row] ?? 0.8, time);
      }

      if (!isNaN(panAuto)) {
        this.audioEngine.scheduleRowPan(row, panAuto * 2 - 1, time);
      } else {
        this.audioEngine.scheduleRowPan(row, rowPans[row] ?? 0, time);
      }

      if (!isNaN(revAuto)) {
        this.audioEngine.scheduleReverbSend(row, revAuto, time);
      } else {
        this.audioEngine.scheduleReverbSend(row, reverbSends[row] ?? 0.3, time);
      }

      if (!isNaN(delAuto)) {
        this.audioEngine.scheduleDelaySend(row, delAuto, time);
      } else {
        this.audioEngine.scheduleDelaySend(row, delaySends[row] ?? 0.25, time);
      }
    }
  }

  private scheduleMidiNote(row: number, totalPitch: number, velocity: number, triggerTime: number, gateDuration: number, ctxTime: number): void {
    if (!this.midiOutput || !this.sequencer.midiOutputGlobalEnabled) return;
    const cfg = this.sequencer.getMidiOutputConfig(row);
    if (!cfg.enabled) return;

    const midiNote = Math.max(0, Math.min(127, Math.round(cfg.baseNote + totalPitch)));
    const delayMs = Math.max(0, (triggerTime - ctxTime) * 1000);
    const gateMs = gateDuration * 1000;

    setTimeout(() => {
      this.midiOutput!.sendNoteOn(cfg.portId, cfg.channel, midiNote, velocity);
      eventBus.emit('midi:output-note', { row, note: midiNote, velocity, channel: cfg.channel });
    }, delayMs);

    setTimeout(() => {
      this.midiOutput!.sendNoteOff(cfg.portId, cfg.channel, midiNote);
    }, delayMs + gateMs);
  }

  private advanceStep(): void {
    const secondsPerStep = 60.0 / this.sequencer.tempo / 4;
    // All steps evenly spaced; per-row swing is applied in scheduleStep()
    this.nextStepTime += secondsPerStep;

    this.currentStep = (this.currentStep + 1) % NUM_STEPS;

    // Increment loop count when wrapping
    if (this.currentStep === 0) {
      this.sequencer.incrementLoopCount();

      // Pattern queue: process queued bank before song mode
      this.sequencer.processQueue();

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
