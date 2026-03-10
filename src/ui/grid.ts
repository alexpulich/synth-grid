import { NUM_ROWS, NUM_STEPS, VELOCITY_OFF, VELOCITY_LOUD, MELODIC_ROWS, TRIG_CONDITIONS, GATE_LEVELS, GATE_LABELS } from '../types';
import type { VelocityLevel } from '../types';
import { INSTRUMENTS } from '../audio/instruments';
import type { Sequencer } from '../sequencer/sequencer';
import { Knob } from './knob';
import { eventBus } from '../utils/event-bus';
import { SCALES, scaleDegreesToSemitones, semitonesToScaleDegree, semitoneToNoteName } from '../utils/scales';
import type { AudioEngine } from '../audio/audio-engine';
import { EuclideanPopover } from './euclidean-popover';
import { SoundShaper } from './sound-shaper';
import { PianoRoll } from './piano-roll';

export class GridUI {
  private container: HTMLElement;
  private cells: HTMLElement[][] = [];
  private rowElements: HTMLElement[] = [];
  private labelElements: HTMLElement[] = [];
  private pitchDisplays: HTMLElement[] = [];
  private volumeKnobs: Knob[] = [];
  private panKnobs: Knob[] = [];
  private swingKnobs: Knob[] = [];
  private euclideanPopover: EuclideanPopover;
  private soundShaper: SoundShaper;
  private pianoRoll: PianoRoll;

  // Drag paint state
  private isDragging = false;
  private dragMode: 'paint' | 'erase' = 'paint';
  private draggedCells = new Set<string>();

  constructor(parent: HTMLElement, private sequencer: Sequencer, audioEngine: AudioEngine) {
    this.container = document.createElement('div');
    this.container.className = 'grid';
    parent.appendChild(this.container);

    this.euclideanPopover = new EuclideanPopover(sequencer);
    this.soundShaper = new SoundShaper(sequencer);
    this.pianoRoll = new PianoRoll(sequencer, audioEngine);
    this.buildGrid();
    this.bindEvents();
  }

  private buildGrid(): void {
    for (let row = 0; row < NUM_ROWS; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'grid-row';
      rowEl.dataset.instrument = String(row);
      this.cells[row] = [];
      this.rowElements[row] = rowEl;

      const label = document.createElement('span');
      label.className = 'grid-row-label';
      label.textContent = INSTRUMENTS[row].name;
      // Color comes from CSS var so it responds to theme changes
      const varName = `--color-${INSTRUMENTS[row].name.toLowerCase()}`;
      label.style.color = `var(${varName})`;
      label.dataset.row = String(row);
      this.labelElements[row] = label;
      rowEl.appendChild(label);

      // Pitch controls
      const pitchCtrl = document.createElement('div');
      pitchCtrl.className = 'grid-pitch-ctrl';

      const minusBtn = document.createElement('button');
      minusBtn.className = 'pitch-btn';
      minusBtn.textContent = '-';
      minusBtn.addEventListener('click', () => {
        this.sequencer.setPitchOffset(row, this.sequencer.getPitchOffset(row) - 1);
      });

      const pitchDisplay = document.createElement('span');
      pitchDisplay.className = 'pitch-display';
      pitchDisplay.textContent = '0';
      this.pitchDisplays[row] = pitchDisplay;

      // Scroll wheel on display
      pitchDisplay.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1 : -1;
        this.sequencer.setPitchOffset(row, this.sequencer.getPitchOffset(row) + delta);
      });

      const plusBtn = document.createElement('button');
      plusBtn.className = 'pitch-btn';
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', () => {
        this.sequencer.setPitchOffset(row, this.sequencer.getPitchOffset(row) + 1);
      });

      pitchCtrl.appendChild(minusBtn);
      pitchCtrl.appendChild(pitchDisplay);
      pitchCtrl.appendChild(plusBtn);
      rowEl.appendChild(pitchCtrl);

      // Mixer controls (volume + pan)
      const mixerCtrl = document.createElement('div');
      mixerCtrl.className = 'grid-mixer-ctrl';

      const volKnob = new Knob(mixerCtrl, 'V', this.sequencer.getRowVolume(row) / 1.0, (v) => {
        this.sequencer.setRowVolume(row, v);
      });
      this.volumeKnobs[row] = volKnob;

      const panKnob = new Knob(mixerCtrl, 'P', (this.sequencer.getRowPan(row) + 1) / 2, (v) => {
        this.sequencer.setRowPan(row, v * 2 - 1); // map 0-1 → -1 to 1
      });
      this.panKnobs[row] = panKnob;

      const swingKnob = new Knob(mixerCtrl, 'S', this.sequencer.getRowSwing(row) / 0.75, (v) => {
        this.sequencer.setRowSwing(row, v * 0.75);
      });
      this.swingKnobs[row] = swingKnob;

      rowEl.appendChild(mixerCtrl);

      // Euclidean button
      const eucBtn = document.createElement('button');
      eucBtn.className = 'grid-euc-btn';
      eucBtn.textContent = 'E';
      eucBtn.title = 'Euclidean rhythm';
      eucBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.euclideanPopover.show(row, eucBtn);
      });
      rowEl.appendChild(eucBtn);

      // Piano roll button (functional on melodic rows, spacer on others)
      if (MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number])) {
        const pianoBtn = document.createElement('button');
        pianoBtn.className = 'grid-piano-btn';
        pianoBtn.textContent = '\u266a'; // ♪
        pianoBtn.title = 'Piano roll';
        pianoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.pianoRoll.open(row);
        });
        rowEl.appendChild(pianoBtn);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'grid-piano-btn grid-piano-btn--spacer';
        rowEl.appendChild(spacer);
      }

      for (let step = 0; step < NUM_STEPS; step++) {
        const cell = document.createElement('button');
        cell.className = 'grid-cell';
        cell.dataset.row = String(row);
        cell.dataset.step = String(step);
        if (step % 4 === 0 && step > 0) cell.classList.add('grid-cell--beat-start');
        rowEl.appendChild(cell);
        this.cells[row][step] = cell;
      }

      this.container.appendChild(rowEl);
    }
  }

  private bindEvents(): void {
    // Double-click on label: open sound shaper
    this.container.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('grid-row-label')) {
        const row = Number(target.dataset.row);
        this.soundShaper.open(row, target);
      }
    });

    // Drag paint: mousedown on cells
    this.container.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;

      // Label click: mute/solo
      if (target.classList.contains('grid-row-label')) {
        const row = Number(target.dataset.row);
        if (e.shiftKey) {
          this.sequencer.muteState.toggleSolo(row);
        } else {
          this.sequencer.muteState.toggleMute(row);
        }
        return;
      }

      const cell = target.closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;

      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);

      // Alt+Click: toggle slide (melodic rows only, active cells only)
      if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const grid = this.sequencer.getCurrentGrid();
        if (MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number]) && grid[row][step] > 0) {
          const current = this.sequencer.getSlide(row, step);
          this.sequencer.setSlide(row, step, !current);
        }
        return;
      }

      // Shift+click: cycle velocity
      if (e.shiftKey) {
        this.sequencer.cycleVelocity(row, step);
        return;
      }

      // Start drag
      e.preventDefault();
      const grid = this.sequencer.getCurrentGrid();
      this.isDragging = true;
      this.dragMode = grid[row][step] > 0 ? 'erase' : 'paint';
      this.draggedCells.clear();
      this.sequencer.pushHistorySnapshot();

      this.applyDrag(row, step);
    });

    // Right-click: cycle probability, Alt+right-click: cycle gate, Shift+right-click: clear filter lock, Ctrl+right-click: cycle condition
    this.container.addEventListener('contextmenu', (e) => {
      const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;
      e.preventDefault();
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      if (e.altKey) {
        // Cycle gate: 0→1→2→3→0
        const grid = this.sequencer.getCurrentGrid();
        if (grid[row][step] > 0) {
          const current = this.sequencer.getGate(row, step);
          this.sequencer.setGate(row, step, (current + 1) % GATE_LEVELS.length);
        }
      } else if (e.ctrlKey || e.metaKey) {
        // Cycle trig condition
        const current = this.sequencer.getCondition(row, step);
        this.sequencer.setCondition(row, step, (current + 1) % TRIG_CONDITIONS.length);
      } else if (e.shiftKey) {
        this.sequencer.clearFilterLock(row, step);
      } else {
        this.sequencer.cycleProbability(row, step);
      }
    });

    // Ctrl+scroll on active cells: set ratchet count
    this.container.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      const grid = this.sequencer.getCurrentGrid();
      if (grid[row][step] === VELOCITY_OFF) return;
      e.preventDefault();
      const current = this.sequencer.getRatchet(row, step);
      const delta = e.deltaY < 0 ? 1 : -1;
      // Wrap: 1→2→3→4→1
      let next = current + delta;
      if (next > 4) next = 1;
      if (next < 1) next = 4;
      this.sequencer.setRatchet(row, step, next);
    });

    // Shift+scroll on active cells: set filter lock
    this.container.addEventListener('wheel', (e) => {
      if (!e.shiftKey || e.altKey) return;
      const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      const grid = this.sequencer.getCurrentGrid();
      if (grid[row][step] === VELOCITY_OFF) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const current = this.sequencer.getFilterLock(row, step);
      const base = isNaN(current) ? 1.0 : current;
      this.sequencer.setFilterLock(row, step, base + delta);
    });

    // Alt+scroll on active melodic cells: change per-step note (scale-aware)
    this.container.addEventListener('wheel', (e) => {
      if (!e.altKey) return;
      const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      if (!MELODIC_ROWS.includes(row as typeof MELODIC_ROWS[number])) return;
      const grid = this.sequencer.getCurrentGrid();
      if (grid[row][step] === VELOCITY_OFF) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      const current = this.sequencer.getNoteOffset(row, step);
      const scale = SCALES[this.sequencer.selectedScale];
      if (scale.intervals.length === 12) {
        // Chromatic: step by semitones as before
        this.sequencer.setNoteOffset(row, step, current + delta);
      } else {
        // Scale-aware: convert to degree, step, convert back
        const degree = semitonesToScaleDegree(scale, current);
        const newSemitones = scaleDegreesToSemitones(scale, degree + delta);
        this.sequencer.setNoteOffset(row, step, newSemitones);
      }
    });

    // Drag paint: mouseover during drag
    this.container.addEventListener('mouseover', (e) => {
      if (!this.isDragging) return;
      const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      this.applyDrag(row, step);
    });

    // Drag paint: end drag
    document.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.draggedCells.clear();
    });

    // Cell toggled event
    eventBus.on('cell:toggled', ({ row, step, velocity }) => {
      const cell = this.cells[row][step];
      cell.classList.toggle('grid-cell--active', velocity > 0);
      cell.dataset.velocity = String(velocity);
    });

    // Probability changed event
    eventBus.on('cell:probability-changed', ({ row, step, probability }) => {
      const cell = this.cells[row][step];
      const pct = Math.round(probability * 100);
      cell.dataset.prob = String(pct);
    });

    // Full grid refresh events
    eventBus.on('bank:changed', () => this.refreshAll());
    eventBus.on('grid:cleared', () => this.refreshAll());

    // Mute/solo state change
    eventBus.on('mute:changed', ({ muted, soloRow }) => {
      for (let row = 0; row < NUM_ROWS; row++) {
        this.rowElements[row].classList.toggle('grid-row--muted', muted[row]);
        this.rowElements[row].classList.toggle('grid-row--solo', soloRow === row);

        // Update label text with mute/solo indicator
        let name = INSTRUMENTS[row].name;
        if (soloRow === row) name += ' [S]';
        else if (muted[row]) name += ' [M]';
        this.labelElements[row].textContent = name;
      }
    });

    // Pitch changed
    eventBus.on('pitch:changed', ({ row, offset }) => {
      this.updatePitchDisplay(row, offset);
    });

    // Bank changed: also refresh pitch displays and mixer knobs
    eventBus.on('bank:changed', () => {
      this.refreshPitchDisplays();
      this.refreshMixerKnobs();
    });

    // Note changed
    eventBus.on('note:changed', ({ row, step, note }) => {
      this.updateNoteDisplay(row, step, note);
    });

    // Scale changed: refresh all note displays
    eventBus.on('scale:changed', () => this.refreshAll());

    // Filter lock changed
    eventBus.on('filterlock:changed', ({ row, step, value }) => {
      this.updateFilterLockVisual(row, step, value);
    });

    // Ratchet changed
    eventBus.on('ratchet:changed', ({ row, step, count }) => {
      this.updateRatchetVisual(row, step, count);
    });

    // Condition changed
    eventBus.on('condition:changed', ({ row, step, condition }) => {
      this.updateConditionVisual(row, step, condition);
    });

    // Gate changed
    eventBus.on('gate:changed', ({ row, step, gate }) => {
      this.updateGateVisual(row, step, gate);
    });

    // Slide changed
    eventBus.on('slide:changed', ({ row, step, slide }) => {
      this.updateSlideVisual(row, step, slide);
    });

    // Theme change: update INSTRUMENTS color for particle system
    eventBus.on('theme:changed', () => {
      for (let row = 0; row < NUM_ROWS; row++) {
        const color = getComputedStyle(document.documentElement)
          .getPropertyValue(`--color-${INSTRUMENTS[row].name.toLowerCase()}`)
          .trim();
        if (color) {
          INSTRUMENTS[row].color = color;
        }
      }
    });
  }

  private applyDrag(row: number, step: number): void {
    const key = `${row},${step}`;
    if (this.draggedCells.has(key)) return;
    this.draggedCells.add(key);

    const vel: VelocityLevel = this.dragMode === 'paint' ? VELOCITY_LOUD : VELOCITY_OFF;
    this.sequencer.setCell(row, step, vel);
  }

  highlightStep(step: number): void {
    const prev = (step - 1 + NUM_STEPS) % NUM_STEPS;
    for (let row = 0; row < NUM_ROWS; row++) {
      this.cells[row][prev].classList.remove('grid-cell--playing');
      this.cells[row][step].classList.add('grid-cell--playing');

      if (this.cells[row][step].classList.contains('grid-cell--active')) {
        this.cells[row][step].classList.add('grid-cell--triggered');
        const cellRef = this.cells[row][step];
        setTimeout(() => cellRef.classList.remove('grid-cell--triggered'), 200);
      }
    }
  }

  clearPlayhead(): void {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        this.cells[row][step].classList.remove('grid-cell--playing');
      }
    }
  }

  getCellRect(row: number, step: number): DOMRect {
    return this.cells[row][step].getBoundingClientRect();
  }

  private refreshAll(): void {
    const grid = this.sequencer.getCurrentGrid();
    const probs = this.sequencer.getCurrentProbabilities();
    const notes = this.sequencer.getCurrentNoteGrid();
    const locks = this.sequencer.getCurrentFilterLocks();
    const ratchets = this.sequencer.getCurrentRatchets();
    const conditions = this.sequencer.getCurrentConditions();
    const gates = this.sequencer.getCurrentGates();
    const slides = this.sequencer.getCurrentSlides();
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        const vel = grid[row][step];
        this.cells[row][step].classList.toggle('grid-cell--active', vel > 0);
        this.cells[row][step].dataset.velocity = String(vel);
        const pct = Math.round(probs[row][step] * 100);
        this.cells[row][step].dataset.prob = String(pct);
        this.updateNoteDisplay(row, step, notes[row][step]);
        this.updateFilterLockVisual(row, step, locks[row][step]);
        this.updateRatchetVisual(row, step, ratchets[row][step]);
        this.updateConditionVisual(row, step, conditions[row][step]);
        this.updateGateVisual(row, step, gates[row][step]);
        this.updateSlideVisual(row, step, slides[row][step]);
      }
    }
    this.refreshPitchDisplays();
    this.refreshMixerKnobs();
  }

  private updatePitchDisplay(row: number, offset: number): void {
    const display = this.pitchDisplays[row];
    if (!display) return;
    const text = offset > 0 ? `+${offset}` : String(offset);
    display.textContent = text;
    display.classList.toggle('pitch-display--shifted', offset !== 0);
  }

  private refreshPitchDisplays(): void {
    const offsets = this.sequencer.getCurrentPitchOffsets();
    for (let row = 0; row < NUM_ROWS; row++) {
      this.updatePitchDisplay(row, offsets[row]);
    }
  }

  private refreshMixerKnobs(): void {
    const volumes = this.sequencer.getCurrentRowVolumes();
    const pans = this.sequencer.getCurrentRowPans();
    const swings = this.sequencer.getCurrentRowSwings();
    for (let row = 0; row < NUM_ROWS; row++) {
      this.volumeKnobs[row]?.setValueSilent(volumes[row]);
      this.panKnobs[row]?.setValueSilent((pans[row] + 1) / 2); // -1..1 → 0..1
      this.swingKnobs[row]?.setValueSilent(swings[row] / 0.75); // 0..0.75 → 0..1
    }
  }

  private updateNoteDisplay(row: number, step: number, note: number): void {
    const cell = this.cells[row]?.[step];
    if (!cell) return;
    if (note !== 0) {
      const scaleIdx = this.sequencer.selectedScale;
      if (scaleIdx > 0) {
        // Non-chromatic: show note name
        cell.dataset.note = semitoneToNoteName(this.sequencer.rootNote, note);
      } else {
        cell.dataset.note = note > 0 ? `+${note}` : String(note);
      }
    } else {
      delete cell.dataset.note;
    }
  }

  private updateFilterLockVisual(row: number, step: number, value: number): void {
    const cell = this.cells[row]?.[step];
    if (!cell) return;
    let bar = cell.querySelector('.grid-cell-filter') as HTMLElement | null;
    if (isNaN(value)) {
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'grid-cell-filter';
      cell.appendChild(bar);
    }
    bar.style.height = `${Math.round(value * 100)}%`;
  }

  private updateRatchetVisual(row: number, step: number, count: number): void {

    const cell = this.cells[row]?.[step];
    if (!cell) return;
    if (count > 1) {
      cell.dataset.ratchet = String(count);
    } else {
      delete cell.dataset.ratchet;
    }
  }

  private updateConditionVisual(row: number, step: number, condition: number): void {
    const cell = this.cells[row]?.[step];
    if (!cell) return;
    if (condition > 0) {
      cell.dataset.condition = TRIG_CONDITIONS[condition];
    } else {
      delete cell.dataset.condition;
    }
  }

  private updateGateVisual(row: number, step: number, gate: number): void {
    const cell = this.cells[row]?.[step];
    if (!cell) return;
    let bar = cell.querySelector('.grid-cell-gate') as HTMLElement | null;
    if (gate === 1) {
      // Normal (default) — remove visual
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'grid-cell-gate';
      cell.appendChild(bar);
    }
    bar.style.width = `${Math.round(GATE_LEVELS[gate] * 100)}%`;
    bar.dataset.gate = GATE_LABELS[gate];
  }

  private updateSlideVisual(row: number, step: number, slide: boolean): void {
    const cell = this.cells[row]?.[step];
    if (!cell) return;
    let marker = cell.querySelector('.grid-cell-slide') as HTMLElement | null;
    if (!slide) {
      if (marker) marker.remove();
      return;
    }
    if (!marker) {
      marker = document.createElement('div');
      marker.className = 'grid-cell-slide';
      marker.textContent = '/';
      cell.appendChild(marker);
    }
  }
}
