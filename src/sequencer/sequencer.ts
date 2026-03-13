import { NUM_ROWS, NUM_STEPS, NUM_BANKS, NUM_AUTO_PARAMS, VELOCITY_OFF, VELOCITY_LOUD, PROBABILITY_LEVELS, MELODIC_ROWS, DEFAULT_SOUND_PARAMS, DEFAULT_ROW_BASE_NOTES } from '../types';
import type { Grid, VelocityLevel, ProbabilityGrid, NoteGrid, FilterLockGrid, RatchetGrid, ConditionGrid, GateGrid, SlideGrid, SoundParams, MidiOutputConfig, ClockMode, AutomationData } from '../types';
import { clamp } from '../utils/math';
import { euclidean, rotatePattern } from '../utils/euclidean';
import { mulberry32 } from '../utils/prng';
import { eventBus } from '../utils/event-bus';
import { History, type HistoryEntry } from '../state/history';
import { BankStateManager } from './bank-state';
import { MuteState } from './mute-state';
import { PatternChain } from './pattern-chain';
import { StepClipboard } from './step-clipboard';

export class Sequencer {
  private readonly bs = new BankStateManager();
  private _activeBank = 0;
  private _tempo = 120;
  private _swing = 0;
  private _isPlaying = false;
  private _currentStep = 0;
  private _selectedScale = 0;
  private _rootNote = 0;
  private _sidechainEnabled = false;
  private _sidechainDepth = 0.7;
  private _sidechainRelease = 0.15;
  private _loopCount = 0;
  private _humanize = 0;
  private _soundParams: SoundParams[] = Array.from({ length: NUM_ROWS }, () => ({ ...DEFAULT_SOUND_PARAMS }));
  private _midiOutputConfigs: MidiOutputConfig[] = Array.from(
    { length: NUM_ROWS },
    (_, i) => ({ enabled: false, portId: null, channel: 0, baseNote: DEFAULT_ROW_BASE_NOTES[i] }),
  );
  private _midiOutputGlobalEnabled = false;
  private _midiClockMode: ClockMode = 'off';
  private clipboard: { grid: Grid; probabilities: ProbabilityGrid; noteGrid: NoteGrid } | null = null;
  private _queuedBank: number | null = null;
  readonly history = new History();
  readonly muteState = new MuteState();
  readonly patternChain = new PatternChain();
  readonly stepClipboard = new StepClipboard();

  private pushHistory(): void {
    this.history.push(this.bs.captureEntry(this._activeBank));
  }

  toggleCell(row: number, step: number): void {
    this.pushHistory();
    const grid = this.bs.grids[this._activeBank];
    grid[row][step] = grid[row][step] === VELOCITY_OFF ? VELOCITY_LOUD : VELOCITY_OFF;
    if (grid[row][step] === VELOCITY_OFF) {
      this.bs.ratchets[this._activeBank][row][step] = 1;
    }
    eventBus.emit('cell:toggled', { row, step, velocity: grid[row][step] });
  }

  cycleVelocity(row: number, step: number): void {
    this.pushHistory();
    const grid = this.bs.grids[this._activeBank];
    grid[row][step] = ((grid[row][step] + 1) % 4) as VelocityLevel;
    eventBus.emit('cell:toggled', { row, step, velocity: grid[row][step] });
  }

  cycleProbability(row: number, step: number): void {
    this.pushHistory();
    const prob = this.bs.probabilities[this._activeBank];
    const current = prob[row][step];
    const idx = PROBABILITY_LEVELS.indexOf(current as typeof PROBABILITY_LEVELS[number]);
    const nextIdx = (idx + 1) % PROBABILITY_LEVELS.length;
    prob[row][step] = PROBABILITY_LEVELS[nextIdx];
    eventBus.emit('cell:probability-changed', { row, step, probability: prob[row][step] });
  }

  setProbability(row: number, step: number, value: number): void {
    this.pushHistory();
    this.bs.probabilities[this._activeBank][row][step] = value;
    eventBus.emit('cell:probability-changed', { row, step, probability: value });
  }

  setCell(row: number, step: number, velocity: VelocityLevel): void {
    const grid = this.bs.grids[this._activeBank];
    if (grid[row][step] === velocity) return;
    grid[row][step] = velocity;
    if (velocity === VELOCITY_OFF) {
      this.bs.ratchets[this._activeBank][row][step] = 1;
    }
    eventBus.emit('cell:toggled', { row, step, velocity });
  }

  pushHistorySnapshot(): void {
    this.pushHistory();
  }

  setBank(bankIndex: number): void {
    this._activeBank = clamp(bankIndex, 0, NUM_BANKS - 1);
    eventBus.emit('bank:changed', this._activeBank);
  }

  queueBank(bankIndex: number): void {
    if (!this._isPlaying) {
      this.setBank(bankIndex);
      return;
    }
    const idx = clamp(bankIndex, 0, NUM_BANKS - 1);
    this._queuedBank = this._queuedBank === idx ? null : idx;
    eventBus.emit('bank:queued', this._queuedBank);
  }

  processQueue(): void {
    if (this._queuedBank !== null) {
      this.setBank(this._queuedBank);
      this._queuedBank = null;
      eventBus.emit('bank:queued', null);
    }
  }

  clearQueue(): void {
    this._queuedBank = null;
    eventBus.emit('bank:queued', null);
  }

  get queuedBank(): number | null {
    return this._queuedBank;
  }

  copyStep(step: number): void {
    const b = this._activeBank;
    this.stepClipboard.copy(step, {
      velocities: this.bs.grids[b].map(r => r[step]),
      probabilities: this.bs.probabilities[b].map(r => r[step]),
      notes: this.bs.noteGrids[b].map(r => r[step]),
      filterLocks: this.bs.filterLocks[b].map(r => r[step]),
      ratchets: this.bs.ratchets[b].map(r => r[step]),
      conditions: this.bs.conditions[b].map(r => r[step]),
      gates: this.bs.gates[b].map(r => r[step]),
      slides: this.bs.slides[b].map(r => r[step]),
      automationData: this.bs.automationData[b].map(p => p.map(r => r[step])),
    });
    eventBus.emit('step:copied', step);
  }

  pasteStep(step: number): void {
    const data = this.stepClipboard.paste();
    if (!data) return;
    this.pushHistory();
    const b = this._activeBank;
    for (let row = 0; row < NUM_ROWS; row++) {
      this.bs.grids[b][row][step] = data.velocities[row];
      this.bs.probabilities[b][row][step] = data.probabilities[row];
      this.bs.noteGrids[b][row][step] = data.notes[row];
      this.bs.filterLocks[b][row][step] = data.filterLocks[row];
      this.bs.ratchets[b][row][step] = data.ratchets[row];
      this.bs.conditions[b][row][step] = data.conditions[row];
      this.bs.gates[b][row][step] = data.gates[row];
      this.bs.slides[b][row][step] = data.slides[row];
    }
    if (data.automationData) {
      const auto = this.bs.automationData[b];
      for (let p = 0; p < NUM_AUTO_PARAMS; p++) {
        for (let row = 0; row < NUM_ROWS; row++) {
          auto[p][row][step] = data.automationData[p]?.[row] ?? NaN;
        }
      }
    }
    eventBus.emit('step:pasted', step);
    eventBus.emit('grid:cleared');
  }

  // ── Per-bank accessors (delegate to BankStateManager) ──

  getCurrentGrid(): Grid { return this.bs.grids[this._activeBank]; }
  getCurrentProbabilities(): ProbabilityGrid { return this.bs.probabilities[this._activeBank]; }
  getAllProbabilities(): ProbabilityGrid[] { return this.bs.probabilities; }

  getPitchOffset(row: number): number { return this.bs.pitchOffsets[this._activeBank][row] ?? 0; }
  setPitchOffset(row: number, semitones: number): void {
    this.bs.pitchOffsets[this._activeBank][row] = clamp(semitones, -12, 12);
    eventBus.emit('pitch:changed', { row, offset: this.bs.pitchOffsets[this._activeBank][row] });
  }
  getCurrentPitchOffsets(): number[] { return this.bs.pitchOffsets[this._activeBank]; }
  getAllPitchOffsets(): number[][] { return this.bs.pitchOffsets; }

  getNoteOffset(row: number, step: number): number {
    if (!MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number])) return 0;
    return this.bs.noteGrids[this._activeBank][row][step];
  }
  setNoteOffset(row: number, step: number, semitones: number): void {
    if (!MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number])) return;
    this.pushHistory();
    this.bs.noteGrids[this._activeBank][row][step] = clamp(semitones, -12, 12);
    eventBus.emit('note:changed', { row, step, note: this.bs.noteGrids[this._activeBank][row][step] });
  }
  setNoteOffsetSilent(row: number, step: number, semitones: number): void {
    if (!MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number])) return;
    this.bs.noteGrids[this._activeBank][row][step] = clamp(semitones, -12, 12);
    eventBus.emit('note:changed', { row, step, note: this.bs.noteGrids[this._activeBank][row][step] });
  }
  getCurrentNoteGrid(): NoteGrid { return this.bs.noteGrids[this._activeBank]; }
  getAllNoteGrids(): NoteGrid[] { return this.bs.noteGrids; }

  getRowVolume(row: number): number { return this.bs.rowVolumes[this._activeBank][row] ?? 0.8; }
  setRowVolume(row: number, volume: number): void {
    this.bs.rowVolumes[this._activeBank][row] = clamp(volume, 0, 1);
    eventBus.emit('volume:changed', { row, volume: this.bs.rowVolumes[this._activeBank][row] });
  }
  getCurrentRowVolumes(): number[] { return this.bs.rowVolumes[this._activeBank]; }
  getAllRowVolumes(): number[][] { return this.bs.rowVolumes; }

  getRowPan(row: number): number { return this.bs.rowPans[this._activeBank][row] ?? 0; }
  setRowPan(row: number, pan: number): void {
    this.bs.rowPans[this._activeBank][row] = clamp(pan, -1, 1);
    eventBus.emit('pan:changed', { row, pan: this.bs.rowPans[this._activeBank][row] });
  }
  getCurrentRowPans(): number[] { return this.bs.rowPans[this._activeBank]; }
  getAllRowPans(): number[][] { return this.bs.rowPans; }

  // Scale (global, not per-bank)
  get selectedScale(): number { return this._selectedScale; }
  get rootNote(): number { return this._rootNote; }
  setScale(scaleIndex: number, rootNote: number): void {
    this._selectedScale = clamp(scaleIndex, 0, 6);
    this._rootNote = clamp(rootNote, 0, 11);
    eventBus.emit('scale:changed', { scaleIndex: this._selectedScale, rootNote: this._rootNote });
  }

  // Sidechain
  get sidechainEnabled(): boolean { return this._sidechainEnabled; }
  get sidechainDepth(): number { return this._sidechainDepth; }
  get sidechainRelease(): number { return this._sidechainRelease; }
  setSidechain(enabled: boolean, depth: number, release: number): void {
    this._sidechainEnabled = enabled;
    this._sidechainDepth = clamp(depth, 0, 1);
    this._sidechainRelease = clamp(release, 0.01, 0.5);
    eventBus.emit('sidechain:changed', {
      enabled: this._sidechainEnabled,
      depth: this._sidechainDepth,
      release: this._sidechainRelease,
    });
  }

  // Filter locks
  getFilterLock(row: number, step: number): number { return this.bs.filterLocks[this._activeBank][row][step]; }
  setFilterLock(row: number, step: number, value: number): void {
    this.pushHistory();
    this.bs.filterLocks[this._activeBank][row][step] = clamp(value, 0, 1);
    eventBus.emit('filterlock:changed', { row, step, value: this.bs.filterLocks[this._activeBank][row][step] });
  }
  clearFilterLock(row: number, step: number): void {
    this.pushHistory();
    this.bs.filterLocks[this._activeBank][row][step] = NaN;
    eventBus.emit('filterlock:changed', { row, step, value: NaN });
  }
  getCurrentFilterLocks(): FilterLockGrid { return this.bs.filterLocks[this._activeBank]; }
  getAllFilterLocks(): FilterLockGrid[] { return this.bs.filterLocks; }

  // Ratchets
  getRatchet(row: number, step: number): number { return this.bs.ratchets[this._activeBank][row][step] ?? 1; }
  setRatchet(row: number, step: number, count: number): void {
    this.bs.ratchets[this._activeBank][row][step] = clamp(count, 1, 4);
    eventBus.emit('ratchet:changed', { row, step, count: this.bs.ratchets[this._activeBank][row][step] });
  }
  getCurrentRatchets(): RatchetGrid { return this.bs.ratchets[this._activeBank]; }
  getAllRatchets(): RatchetGrid[] { return this.bs.ratchets; }

  // Trig conditions
  getCondition(row: number, step: number): number { return this.bs.conditions[this._activeBank][row][step] ?? 0; }
  setCondition(row: number, step: number, condition: number): void {
    this.bs.conditions[this._activeBank][row][step] = clamp(condition, 0, 5);
    eventBus.emit('condition:changed', { row, step, condition: this.bs.conditions[this._activeBank][row][step] });
  }
  getCurrentConditions(): ConditionGrid { return this.bs.conditions[this._activeBank]; }
  getAllConditions(): ConditionGrid[] { return this.bs.conditions; }

  // Loop count (for trig conditions)
  get loopCount(): number { return this._loopCount; }
  incrementLoopCount(): void { this._loopCount++; }
  resetLoopCount(): void { this._loopCount = 0; }

  // Sound params (global, not per-bank)
  getSoundParams(row: number): SoundParams { return this._soundParams[row] ?? { ...DEFAULT_SOUND_PARAMS }; }
  setSoundParam(row: number, key: keyof SoundParams, value: number): void {
    this._soundParams[row][key] = clamp(value, 0, 1);
    eventBus.emit('soundparam:changed', { row, params: { ...this._soundParams[row] } });
  }
  getAllSoundParams(): SoundParams[] { return this._soundParams; }

  // Humanize (global, not per-bank)
  get humanize(): number { return this._humanize; }
  set humanize(val: number) {
    this._humanize = clamp(val, 0, 1);
    eventBus.emit('humanize:changed', this._humanize);
  }

  // Per-row swing
  getRowSwing(row: number): number { return this.bs.rowSwings[this._activeBank][row] ?? 0; }
  setRowSwing(row: number, swing: number): void {
    this.bs.rowSwings[this._activeBank][row] = clamp(swing, 0, 0.75);
    eventBus.emit('swing:changed', { row, swing: this.bs.rowSwings[this._activeBank][row] });
  }
  getCurrentRowSwings(): number[] { return this.bs.rowSwings[this._activeBank]; }
  getAllRowSwings(): number[][] { return this.bs.rowSwings; }

  // Per-row reverb send
  getReverbSend(row: number): number { return this.bs.reverbSends[this._activeBank][row] ?? 0.3; }
  setReverbSend(row: number, value: number): void {
    this.bs.reverbSends[this._activeBank][row] = clamp(value, 0, 1);
    eventBus.emit('send:reverb-changed', { row, value: this.bs.reverbSends[this._activeBank][row] });
  }
  getCurrentReverbSends(): number[] { return this.bs.reverbSends[this._activeBank]; }
  getAllReverbSends(): number[][] { return this.bs.reverbSends; }

  // Per-row delay send
  getDelaySend(row: number): number { return this.bs.delaySends[this._activeBank][row] ?? 0.25; }
  setDelaySend(row: number, value: number): void {
    this.bs.delaySends[this._activeBank][row] = clamp(value, 0, 1);
    eventBus.emit('send:delay-changed', { row, value: this.bs.delaySends[this._activeBank][row] });
  }
  getCurrentDelaySends(): number[] { return this.bs.delaySends[this._activeBank]; }
  getAllDelaySends(): number[][] { return this.bs.delaySends; }

  // Per-step automation
  getAutomation(param: number, row: number, step: number): number {
    return this.bs.automationData[this._activeBank][param]?.[row]?.[step] ?? NaN;
  }
  setAutomation(param: number, row: number, step: number, value: number): void {
    this.pushHistory();
    this.bs.automationData[this._activeBank][param][row][step] = clamp(value, 0, 1);
    eventBus.emit('automation:changed', { param, row, step, value: this.bs.automationData[this._activeBank][param][row][step] });
  }
  setAutomationSilent(param: number, row: number, step: number, value: number): void {
    this.bs.automationData[this._activeBank][param][row][step] = clamp(value, 0, 1);
    eventBus.emit('automation:changed', { param, row, step, value: this.bs.automationData[this._activeBank][param][row][step] });
  }
  clearAutomation(param: number, row: number, step: number): void {
    this.pushHistory();
    this.bs.automationData[this._activeBank][param][row][step] = NaN;
    eventBus.emit('automation:changed', { param, row, step, value: NaN });
  }
  clearAutomationSilent(param: number, row: number, step: number): void {
    this.bs.automationData[this._activeBank][param][row][step] = NaN;
    eventBus.emit('automation:changed', { param, row, step, value: NaN });
  }
  getCurrentAutomation(): AutomationData { return this.bs.automationData[this._activeBank]; }
  getAllAutomation(): AutomationData[] { return this.bs.automationData; }

  // Per-row step length (polyrhythm)
  getRowLength(row: number): number { return this.bs.rowLengths[this._activeBank][row] ?? NUM_STEPS; }
  setRowLength(row: number, length: number): void {
    this.bs.rowLengths[this._activeBank][row] = clamp(length, 1, NUM_STEPS);
    eventBus.emit('rowlength:changed', { row, length: this.bs.rowLengths[this._activeBank][row] });
  }
  getCurrentRowLengths(): number[] { return this.bs.rowLengths[this._activeBank]; }
  getAllRowLengths(): number[][] { return this.bs.rowLengths; }
  getMaxRowLength(): number { return Math.max(...this.bs.rowLengths[this._activeBank]); }

  // Gate
  getGate(row: number, step: number): number { return this.bs.gates[this._activeBank][row][step] ?? 1; }
  setGate(row: number, step: number, gate: number): void {
    this.bs.gates[this._activeBank][row][step] = clamp(gate, 0, 3);
    eventBus.emit('gate:changed', { row, step, gate: this.bs.gates[this._activeBank][row][step] });
  }
  getCurrentGates(): GateGrid { return this.bs.gates[this._activeBank]; }
  getAllGates(): GateGrid[] { return this.bs.gates; }

  // Slide
  getSlide(row: number, step: number): boolean { return this.bs.slides[this._activeBank][row][step] ?? false; }
  setSlide(row: number, step: number, slide: boolean): void {
    if (!MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number])) return;
    this.bs.slides[this._activeBank][row][step] = slide;
    eventBus.emit('slide:changed', { row, step, slide });
  }
  getCurrentSlides(): SlideGrid { return this.bs.slides[this._activeBank]; }
  getAllSlides(): SlideGrid[] { return this.bs.slides; }

  loadSoundParams(params: SoundParams[]): void {
    for (let i = 0; i < NUM_ROWS; i++) {
      if (params[i]) {
        this._soundParams[i] = { ...params[i] };
      }
    }
  }

  // MIDI output config (global, not per-bank)
  getMidiOutputConfig(row: number): MidiOutputConfig {
    return this._midiOutputConfigs[row] ?? { enabled: false, portId: null, channel: 0, baseNote: 60 };
  }
  setMidiOutputConfig(row: number, config: MidiOutputConfig): void {
    this._midiOutputConfigs[row] = { ...config };
    eventBus.emit('midi:output-config-changed', { row, config: { ...config } });
  }
  getAllMidiOutputConfigs(): MidiOutputConfig[] { return this._midiOutputConfigs; }
  loadMidiOutputConfigs(configs: MidiOutputConfig[]): void {
    for (let i = 0; i < NUM_ROWS; i++) {
      if (configs[i]) this._midiOutputConfigs[i] = { ...configs[i] };
    }
  }

  get midiOutputGlobalEnabled(): boolean { return this._midiOutputGlobalEnabled; }
  set midiOutputGlobalEnabled(val: boolean) {
    this._midiOutputGlobalEnabled = val;
    eventBus.emit('midi:output-enabled-changed', val);
  }

  get midiClockMode(): ClockMode { return this._midiClockMode; }
  set midiClockMode(val: ClockMode) {
    this._midiClockMode = val;
    eventBus.emit('midi:clock-mode-changed', val);
  }

  clearCurrentBank(): void {
    this.pushHistory();
    this.bs.clearBank(this._activeBank);
    eventBus.emit('grid:cleared');
  }

  randomizeRow(row: number, density: number, seed?: number): void {
    this.pushHistory();
    const grid = this.bs.grids[this._activeBank];
    const len = this.getRowLength(row);
    const rand = seed !== undefined ? mulberry32(seed) : Math.random;
    for (let step = 0; step < len; step++) {
      grid[row][step] = rand() < density ? VELOCITY_LOUD : VELOCITY_OFF;
    }
    for (let step = len; step < NUM_STEPS; step++) {
      grid[row][step] = VELOCITY_OFF;
    }
    eventBus.emit('grid:cleared');
  }

  applyEuclidean(row: number, hits: number, rotation: number): void {
    this.pushHistory();
    const len = this.getRowLength(row);
    const pattern = rotatePattern(euclidean(len, hits), rotation);
    const grid = this.bs.grids[this._activeBank];
    for (let step = 0; step < len; step++) {
      grid[row][step] = pattern[step] ? VELOCITY_LOUD : VELOCITY_OFF;
    }
    for (let step = len; step < NUM_STEPS; step++) {
      grid[row][step] = VELOCITY_OFF;
    }
    eventBus.emit('grid:cleared');
  }

  copyBank(): void {
    const b = this._activeBank;
    this.clipboard = {
      grid: this.bs.grids[b].map((row) => [...row]),
      probabilities: this.bs.probabilities[b].map((row) => [...row]),
      noteGrid: this.bs.noteGrids[b].map((row) => [...row]),
    };
    eventBus.emit('bank:copied', this._activeBank);
  }

  pasteBank(): void {
    if (!this.clipboard) return;
    this.pushHistory();
    const b = this._activeBank;
    this.bs.grids[b] = this.clipboard.grid.map((row) => [...row]);
    this.bs.probabilities[b] = this.clipboard.probabilities.map((row) => [...row]);
    this.bs.noteGrids[b] = this.clipboard.noteGrid.map((row) => [...row]);
    eventBus.emit('bank:pasted', this._activeBank);
    eventBus.emit('grid:cleared');
  }

  get tempo(): number { return this._tempo; }
  set tempo(bpm: number) {
    this._tempo = clamp(bpm, 30, 300);
    eventBus.emit('tempo:changed', this._tempo);
  }

  get swing(): number { return this._swing; }
  set swing(val: number) { this._swing = clamp(val, 0, 0.5); }

  get isPlaying(): boolean { return this._isPlaying; }
  set isPlaying(val: boolean) { this._isPlaying = val; }

  get activeBank(): number { return this._activeBank; }

  get currentStep(): number { return this._currentStep; }
  set currentStep(step: number) { this._currentStep = step; }

  rotateLeft(): void {
    this.pushHistory();
    const b = this._activeBank;
    for (let row = 0; row < NUM_ROWS; row++) {
      const len = this.getRowLength(row);
      const rotateArr = <T>(arr: T[]): void => {
        const first = arr[0];
        for (let i = 0; i < len - 1; i++) arr[i] = arr[i + 1];
        arr[len - 1] = first;
      };
      rotateArr(this.bs.grids[b][row]);
      rotateArr(this.bs.probabilities[b][row]);
      rotateArr(this.bs.noteGrids[b][row]);
      rotateArr(this.bs.filterLocks[b][row]);
      rotateArr(this.bs.ratchets[b][row]);
      rotateArr(this.bs.conditions[b][row]);
      rotateArr(this.bs.gates[b][row]);
      rotateArr(this.bs.slides[b][row]);
      for (let p = 0; p < NUM_AUTO_PARAMS; p++) {
        rotateArr(this.bs.automationData[b][p][row]);
      }
    }
    eventBus.emit('grid:cleared');
  }

  rotateRight(): void {
    this.pushHistory();
    const b = this._activeBank;
    for (let row = 0; row < NUM_ROWS; row++) {
      const len = this.getRowLength(row);
      const rotateArr = <T>(arr: T[]): void => {
        const last = arr[len - 1];
        for (let i = len - 1; i > 0; i--) arr[i] = arr[i - 1];
        arr[0] = last;
      };
      rotateArr(this.bs.grids[b][row]);
      rotateArr(this.bs.probabilities[b][row]);
      rotateArr(this.bs.noteGrids[b][row]);
      rotateArr(this.bs.filterLocks[b][row]);
      rotateArr(this.bs.ratchets[b][row]);
      rotateArr(this.bs.conditions[b][row]);
      rotateArr(this.bs.gates[b][row]);
      rotateArr(this.bs.slides[b][row]);
      for (let p = 0; p < NUM_AUTO_PARAMS; p++) {
        rotateArr(this.bs.automationData[b][p][row]);
      }
    }
    eventBus.emit('grid:cleared');
  }

  loadGrid(grid: Grid): void {
    this.pushHistory();
    this.bs.grids[this._activeBank] = grid.map((row) => [...row]);
    eventBus.emit('grid:cleared');
  }

  getAllGrids(): Grid[] { return this.bs.grids; }

  loadFullState(
    grids: Grid[],
    tempo: number,
    swing: number,
    activeBank: number,
    probabilities?: ProbabilityGrid[],
    pitchOffsets?: number[][],
    noteGrids?: NoteGrid[],
    rowVolumes?: number[][],
    rowPans?: number[][],
    filterLocks?: FilterLockGrid[],
    ratchets?: RatchetGrid[],
    conditions?: ConditionGrid[],
    rowSwings?: number[][],
    gates?: GateGrid[],
    slides?: SlideGrid[],
    reverbSends?: number[][],
    delaySends?: number[][],
    automationData?: AutomationData[],
    rowLengths?: number[][],
  ): void {
    this.bs.loadAllBanks({
      grids, probabilities, pitchOffsets, noteGrids,
      rowVolumes, rowPans, filterLocks, ratchets, conditions,
      rowSwings, gates, slides, reverbSends, delaySends,
      automationData, rowLengths,
    });
    this._tempo = clamp(tempo, 30, 300);
    this._swing = clamp(swing, 0, 0.5);
    this._activeBank = clamp(activeBank, 0, NUM_BANKS - 1);
    eventBus.emit('tempo:changed', this._tempo);
    eventBus.emit('bank:changed', this._activeBank);
    eventBus.emit('grid:cleared');
  }

  private restoreEntry(entry: HistoryEntry): void {
    if (entry.bank !== this._activeBank) {
      this._activeBank = entry.bank;
      eventBus.emit('bank:changed', this._activeBank);
    }
    this.bs.restoreEntry(entry);
    eventBus.emit('grid:cleared');
  }

  private captureCurrentBankState(): HistoryEntry {
    return this.bs.captureEntry(this._activeBank);
  }

  undo(): void {
    const entry = this.history.undoWithLiveState(this.captureCurrentBankState());
    if (!entry) return;
    this.restoreEntry(entry);
  }

  redo(): void {
    const entry = this.history.redo();
    if (!entry) return;
    this.restoreEntry(entry);
  }
}
