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
import { CellContextMenu } from './cell-context-menu';
import { AutomationLane } from './automation-lane';
import { TouchToolbar } from './touch-toolbar';
import { showToast } from './toast';
import { elementAtTouch } from '../utils/touch';

export class GridUI {
  private container: HTMLElement;
  private cells: HTMLElement[][] = [];
  private rowElements: HTMLElement[] = [];
  private labelElements: HTMLElement[] = [];
  private pitchDisplays: HTMLElement[] = [];
  private volumeKnobs: Knob[] = [];
  private panKnobs: Knob[] = [];
  private swingKnobs: Knob[] = [];
  private reverbKnobs: Knob[] = [];
  private delayKnobs: Knob[] = [];
  private euclideanPopover: EuclideanPopover;
  private soundShaper: SoundShaper;
  private pianoRoll: PianoRoll;
  private cellContextMenu: CellContextMenu;
  private touchToolbar: TouchToolbar;
  private automationLanes: AutomationLane[] = [];
  private _lanesVisible = false;
  private stepLabels: HTMLButtonElement[] = [];
  private playheadBar: HTMLElement | null = null;
  private lengthBadges: HTMLElement[] = [];

  // Drag paint state
  private isDragging = false;
  private dragMode: 'paint' | 'erase' = 'paint';
  private draggedCells = new Set<string>();

  // Touch long-press state
  private longPressTimer: number | null = null;
  private touchStartPos = { x: 0, y: 0 };

  // Keyboard grid navigation state
  private focusedRow = -1;
  private focusedStep = -1;
  private gridFocused = false;

  constructor(parent: HTMLElement, private sequencer: Sequencer, audioEngine: AudioEngine) {
    this.container = document.createElement('div');
    this.container.className = 'grid';
    this.container.setAttribute('role', 'grid');
    this.container.setAttribute('aria-label', 'Step sequencer grid');
    this.container.setAttribute('tabindex', '0');
    parent.appendChild(this.container);

    this.euclideanPopover = new EuclideanPopover(sequencer);
    this.soundShaper = new SoundShaper(sequencer, audioEngine);
    this.pianoRoll = new PianoRoll(sequencer, audioEngine);
    this.cellContextMenu = new CellContextMenu(sequencer);
    this.touchToolbar = new TouchToolbar(sequencer);
    this.buildGrid();
    this.bindEvents();
  }

  private buildGrid(): void {
    // Step header row (step numbers for copy/paste)
    const headerRow = document.createElement('div');
    headerRow.className = 'grid-step-header';

    // Spacer for label column
    const labelSpacer = document.createElement('span');
    labelSpacer.className = 'grid-step-header-spacer grid-step-header-spacer--label';
    headerRow.appendChild(labelSpacer);

    // Spacer for pitch controls
    const pitchSpacer = document.createElement('span');
    pitchSpacer.className = 'grid-step-header-spacer grid-step-header-spacer--pitch';
    headerRow.appendChild(pitchSpacer);

    // Spacer for mixer controls
    const mixerSpacer = document.createElement('span');
    mixerSpacer.className = 'grid-step-header-spacer grid-step-header-spacer--mixer';
    headerRow.appendChild(mixerSpacer);

    // Spacer for euclidean button
    const eucSpacer = document.createElement('span');
    eucSpacer.className = 'grid-step-header-spacer grid-step-header-spacer--euc';
    headerRow.appendChild(eucSpacer);

    // Spacer for piano roll button
    const pianoSpacer = document.createElement('span');
    pianoSpacer.className = 'grid-step-header-spacer grid-step-header-spacer--piano';
    headerRow.appendChild(pianoSpacer);

    for (let step = 0; step < NUM_STEPS; step++) {
      const stepLabel = document.createElement('button');
      stepLabel.className = 'grid-step-label';
      stepLabel.textContent = String(step + 1);
      if (step % 4 === 0 && step > 0) stepLabel.classList.add('grid-step-label--beat-start');
      stepLabel.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) {
          if (e.shiftKey) {
            this.sequencer.pasteStep(step);
          } else {
            this.sequencer.copyStep(step);
          }
        }
      });
      headerRow.appendChild(stepLabel);
      this.stepLabels.push(stepLabel);
    }

    // Playhead indicator bar
    this.playheadBar = document.createElement('div');
    this.playheadBar.className = 'grid-playhead-bar';
    headerRow.appendChild(this.playheadBar);

    this.container.appendChild(headerRow);

    for (let row = 0; row < NUM_ROWS; row++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'grid-row';
      rowEl.dataset.instrument = String(row);
      rowEl.setAttribute('role', 'row');
      this.cells[row] = [];
      this.rowElements[row] = rowEl;

      const label = document.createElement('span');
      label.className = 'grid-row-label';
      label.textContent = INSTRUMENTS[row].name;
      label.setAttribute('role', 'button');
      label.setAttribute('aria-label', `Mute ${INSTRUMENTS[row].name}`);
      // Color comes from CSS var so it responds to theme changes
      const varName = `--color-${INSTRUMENTS[row].name.toLowerCase()}`;
      label.style.color = `var(${varName})`;
      label.dataset.row = String(row);
      this.labelElements[row] = label;

      // Length badge (shows non-default row length)
      const lengthBadge = document.createElement('span');
      lengthBadge.className = 'grid-row-length';
      label.appendChild(lengthBadge);
      this.lengthBadges[row] = lengthBadge;

      rowEl.appendChild(label);

      // Ctrl+Scroll on label: adjust row length
      label.addEventListener('wheel', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1 : -1;
        const current = this.sequencer.getRowLength(row);
        this.sequencer.setRowLength(row, current + delta);
      });

      // Drag-and-drop sample loading on row labels
      label.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        label.classList.add('grid-row-label--drop-target');
      });
      label.addEventListener('dragleave', () => {
        label.classList.remove('grid-row-label--drop-target');
      });
      label.addEventListener('drop', (e) => {
        e.preventDefault();
        label.classList.remove('grid-row-label--drop-target');
        const file = e.dataTransfer?.files[0];
        if (file && /\.(wav|mp3|ogg|m4a)$/i.test(file.name)) {
          eventBus.emit('sample:load-request', { row, file });
        }
      });

      // Pitch controls
      const pitchCtrl = document.createElement('div');
      pitchCtrl.className = 'grid-pitch-ctrl';

      const minusBtn = document.createElement('button');
      minusBtn.className = 'pitch-btn';
      minusBtn.textContent = '-';
      minusBtn.setAttribute('aria-label', `Decrease pitch for ${INSTRUMENTS[row].name}`);
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
      plusBtn.setAttribute('aria-label', `Increase pitch for ${INSTRUMENTS[row].name}`);
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
      }, { formatValue: (v) => `${Math.round(v * 100)}%` });
      this.volumeKnobs[row] = volKnob;

      const panKnob = new Knob(mixerCtrl, 'P', (this.sequencer.getRowPan(row) + 1) / 2, (v) => {
        this.sequencer.setRowPan(row, v * 2 - 1); // map 0-1 → -1 to 1
      }, { formatValue: (v) => {
        const pan = v * 2 - 1;
        if (Math.abs(pan) < 0.05) return 'C';
        return pan < 0 ? `L${Math.round(Math.abs(pan) * 100)}` : `R${Math.round(pan * 100)}`;
      }});
      this.panKnobs[row] = panKnob;

      const swingKnob = new Knob(mixerCtrl, 'S', this.sequencer.getRowSwing(row) / 0.75, (v) => {
        this.sequencer.setRowSwing(row, v * 0.75);
      }, { formatValue: (v) => `${Math.round(v * 75)}%` });
      this.swingKnobs[row] = swingKnob;

      const reverbKnob = new Knob(mixerCtrl, 'R', this.sequencer.getReverbSend(row), (v) => {
        this.sequencer.setReverbSend(row, v);
      }, { formatValue: (v) => `${Math.round(v * 100)}%` });
      this.reverbKnobs[row] = reverbKnob;

      const delayKnob = new Knob(mixerCtrl, 'D', this.sequencer.getDelaySend(row), (v) => {
        this.sequencer.setDelaySend(row, v);
      }, { formatValue: (v) => `${Math.round(v * 100)}%` });
      this.delayKnobs[row] = delayKnob;

      rowEl.appendChild(mixerCtrl);

      // Euclidean button
      const eucBtn = document.createElement('button');
      eucBtn.className = 'grid-euc-btn';
      eucBtn.textContent = 'E';
      eucBtn.title = 'Euclidean rhythm';
      eucBtn.setAttribute('aria-label', `Euclidean rhythm for ${INSTRUMENTS[row].name}`);
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
        pianoBtn.setAttribute('aria-label', `Piano roll for ${INSTRUMENTS[row].name}`);
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
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `${INSTRUMENTS[row].name} Step ${step + 1}`);
        cell.setAttribute('aria-pressed', 'false');
        cell.setAttribute('tabindex', '-1');
        if (step % 4 === 0 && step > 0) cell.classList.add('grid-cell--beat-start');
        rowEl.appendChild(cell);
        this.cells[row][step] = cell;
      }

      this.container.appendChild(rowEl);

      // Automation lane below each row
      const lane = new AutomationLane(row, this.sequencer);
      this.automationLanes[row] = lane;
      this.container.appendChild(lane.container);
    }

    // Touch toolbar FAB (visible only on coarse-pointer devices via CSS)
    const fab = document.createElement('button');
    fab.className = 'touch-fab';
    fab.textContent = '\u270E'; // ✎
    fab.title = 'Toggle cell edit mode';
    fab.addEventListener('click', () => {
      this.touchToolbar.toggleEditMode();
      fab.classList.toggle('touch-fab--active', this.touchToolbar.editMode);
    });
    this.container.appendChild(fab);
  }

  toggleAutomationLanes(): void {
    this._lanesVisible = !this._lanesVisible;
    for (const lane of this.automationLanes) {
      lane.setVisible(this._lanesVisible);
    }
    eventBus.emit('automation:lanes-toggled', this._lanesVisible);
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

    // Right-click: open context menu (plain), modifier+right-click: quick shortcuts for power users
    this.container.addEventListener('contextmenu', (e) => {
      const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;
      e.preventDefault();
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      if (e.altKey) {
        // Quick: cycle gate
        const grid = this.sequencer.getCurrentGrid();
        if (grid[row][step] > 0) {
          const current = this.sequencer.getGate(row, step);
          this.sequencer.setGate(row, step, (current + 1) % GATE_LEVELS.length);
        }
      } else if (e.ctrlKey || e.metaKey) {
        // Quick: cycle trig condition
        const current = this.sequencer.getCondition(row, step);
        this.sequencer.setCondition(row, step, (current + 1) % TRIG_CONDITIONS.length);
      } else if (e.shiftKey) {
        // Quick: clear filter lock
        this.sequencer.clearFilterLock(row, step);
      } else {
        // Plain right-click: open context menu for active cells
        const grid = this.sequencer.getCurrentGrid();
        if (grid[row][step] > 0) {
          const rect = cell.getBoundingClientRect();
          this.cellContextMenu.show(row, step, rect);
        }
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

    // === Touch support ===

    // Touch paint: touchstart on cells
    this.container.addEventListener('touchstart', (e) => {
      const target = e.target as HTMLElement;

      // Labels: let default mousedown handle mute/solo
      if (target.classList.contains('grid-row-label')) return;

      const cell = target.closest('.grid-cell') as HTMLElement | null;
      if (!cell) return;

      e.preventDefault();
      const touch = e.touches[0];
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);

      // Start long-press detection
      this.touchStartPos = { x: touch.clientX, y: touch.clientY };
      if (this.longPressTimer !== null) clearTimeout(this.longPressTimer);
      this.longPressTimer = window.setTimeout(() => {
        this.longPressTimer = null;
        const grid = this.sequencer.getCurrentGrid();
        if (grid[row][step] > 0) {
          this.isDragging = false;
          navigator.vibrate?.(50);
          const rect = cell.getBoundingClientRect();
          this.cellContextMenu.show(row, step, rect);
        }
      }, 500);

      // Touch toolbar edit mode: open toolbar instead of toggling
      if (this.touchToolbar.editMode) {
        const grid = this.sequencer.getCurrentGrid();
        if (grid[row][step] > 0) {
          // Active cell in edit mode → show toolbar
          if (this.longPressTimer !== null) clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
          const rect = cell.getBoundingClientRect();
          this.touchToolbar.show(row, step, rect);
          return;
        }
      }

      // Start drag paint
      const grid = this.sequencer.getCurrentGrid();
      this.isDragging = true;
      this.dragMode = grid[row][step] > 0 ? 'erase' : 'paint';
      this.draggedCells.clear();
      this.sequencer.pushHistorySnapshot();
      this.applyDrag(row, step);
    }, { passive: false });

    // Touch paint: touchmove for drag paint
    this.container.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];

      // Cancel long-press if finger moved > 10px
      if (this.longPressTimer !== null) {
        const dx = touch.clientX - this.touchStartPos.x;
        const dy = touch.clientY - this.touchStartPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      }

      if (!this.isDragging) return;
      e.preventDefault();

      const cell = elementAtTouch(touch, '.grid-cell');
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const step = Number(cell.dataset.step);
      this.applyDrag(row, step);
    }, { passive: false });

    // Touch paint: touchend
    document.addEventListener('touchend', () => {
      if (this.longPressTimer !== null) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      this.isDragging = false;
      this.draggedCells.clear();
    });

    // Cell toggled event
    eventBus.on('cell:toggled', ({ row, step, velocity }) => {
      const cell = this.cells[row][step];
      cell.classList.toggle('grid-cell--active', velocity > 0);
      cell.dataset.velocity = String(velocity);
      cell.setAttribute('aria-pressed', String(velocity > 0));
    });

    // Probability changed event
    eventBus.on('cell:probability-changed', ({ row, step, probability }) => {
      const cell = this.cells[row][step];
      const pct = Math.round(probability * 100);
      cell.dataset.prob = String(pct);
    });

    // Full grid refresh events
    eventBus.on('bank:changed', () => {
      this.refreshAll();
      // Bank switch flash animation
      this.container.classList.add('grid--switching');
      setTimeout(() => this.container.classList.remove('grid--switching'), 200);
    });
    eventBus.on('grid:cleared', () => this.refreshAll());

    // Mute/solo state change
    eventBus.on('mute:changed', ({ muted, soloRow }) => {
      for (let row = 0; row < NUM_ROWS; row++) {
        this.rowElements[row].classList.toggle('grid-row--muted', muted[row]);
        this.rowElements[row].classList.toggle('grid-row--solo', soloRow === row);

        // Update label text with mute/solo indicator
        let name = INSTRUMENTS[row].name;
        if (soloRow === row) {
          name += ' [S]';
          this.labelElements[row].setAttribute('aria-label', `${INSTRUMENTS[row].name} (soloed)`);
        } else if (muted[row]) {
          name += ' [M]';
          this.labelElements[row].setAttribute('aria-label', `${INSTRUMENTS[row].name} (muted)`);
        } else {
          this.labelElements[row].setAttribute('aria-label', `Mute ${INSTRUMENTS[row].name}`);
        }
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

    // Row length changed: update beyond-length dimming and badge
    eventBus.on('rowlength:changed', ({ row, length }) => {
      for (let step = 0; step < NUM_STEPS; step++) {
        this.cells[row][step].classList.toggle('grid-cell--beyond-length', step >= length);
      }
      this.updateLengthBadge(row, length);
      // Refresh automation lane for this row
      this.automationLanes[row]?.refreshAll();
    });

    // Sample loaded/removed: update label visual
    eventBus.on('sample:loaded', ({ row, filename }) => {
      this.labelElements[row].classList.add('grid-row-label--sample');
      this.labelElements[row].title = filename;
    });
    eventBus.on('sample:removed', ({ row }) => {
      this.labelElements[row].classList.remove('grid-row-label--sample');
      this.labelElements[row].title = '';
    });

    // Step copy/paste flash
    eventBus.on('step:copied', (step) => {
      showToast(`Step ${step + 1} copied`, 'success');
      for (let row = 0; row < NUM_ROWS; row++) {
        const cell = this.cells[row][step];
        cell.classList.add('grid-cell--flash');
        setTimeout(() => cell.classList.remove('grid-cell--flash'), 300);
      }
    });
    eventBus.on('step:pasted', (step) => {
      showToast(`Pasted to step ${step + 1}`, 'success');
      for (let row = 0; row < NUM_ROWS; row++) {
        const cell = this.cells[row][step];
        cell.classList.add('grid-cell--flash');
        setTimeout(() => cell.classList.remove('grid-cell--flash'), 300);
      }
    });

    // Keyboard grid navigation
    this.container.addEventListener('focus', () => {
      if (this.focusedRow < 0) {
        this.focusedRow = 0;
        this.focusedStep = 0;
      }
      this.gridFocused = true;
      this.updateFocusVisual();
    });

    this.container.addEventListener('blur', () => {
      this.gridFocused = false;
      this.clearFocusVisual();
    });

    this.container.addEventListener('keydown', (e) => this.handleGridKeydown(e));

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
    // Skip cells beyond row length
    if (step >= this.sequencer.getRowLength(row)) return;
    const key = `${row},${step}`;
    if (this.draggedCells.has(key)) return;
    this.draggedCells.add(key);

    const vel: VelocityLevel = this.dragMode === 'paint' ? VELOCITY_LOUD : VELOCITY_OFF;
    this.sequencer.setCell(row, step, vel);
  }

  highlightStep(step: number): void {
    const prevGlobal = (step - 1 + NUM_STEPS) % NUM_STEPS;
    const rowLengths = this.sequencer.getCurrentRowLengths();

    for (let row = 0; row < NUM_ROWS; row++) {
      const rowLen = rowLengths[row] ?? NUM_STEPS;
      const rowStep = step % rowLen;
      const prevRowStep = prevGlobal % rowLen;

      this.cells[row][prevRowStep].classList.remove('grid-cell--playing');
      this.cells[row][rowStep].classList.add('grid-cell--playing');

      if (this.cells[row][rowStep].classList.contains('grid-cell--active')) {
        this.cells[row][rowStep].classList.add('grid-cell--triggered');
        const cellRef = this.cells[row][rowStep];
        setTimeout(() => cellRef.classList.remove('grid-cell--triggered'), 200);
      }
    }

    // Update step header playhead (global step)
    this.stepLabels[prevGlobal].classList.remove('grid-step-label--playing');
    this.stepLabels[step].classList.add('grid-step-label--playing');
    if (this.playheadBar) {
      const label = this.stepLabels[step];
      this.playheadBar.style.left = `${label.offsetLeft}px`;
      this.playheadBar.style.width = `${label.offsetWidth}px`;
      this.playheadBar.classList.add('grid-playhead-bar--active');
      // Tempo-adaptive transition
      const stepDurationMs = (60000 / this.sequencer.tempo) / 4;
      const transMs = Math.min(stepDurationMs * 0.8, 60);
      this.playheadBar.style.transition = `left ${transMs}ms linear, opacity var(--transition-fast)`;
    }
  }

  clearPlayhead(): void {
    for (let row = 0; row < NUM_ROWS; row++) {
      for (let step = 0; step < NUM_STEPS; step++) {
        this.cells[row][step].classList.remove('grid-cell--playing');
      }
    }
    for (const label of this.stepLabels) {
      label.classList.remove('grid-step-label--playing');
    }
    if (this.playheadBar) {
      this.playheadBar.classList.remove('grid-playhead-bar--active');
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
    const rowLengths = this.sequencer.getCurrentRowLengths();
    for (let row = 0; row < NUM_ROWS; row++) {
      const rowLen = rowLengths[row] ?? NUM_STEPS;
      for (let step = 0; step < NUM_STEPS; step++) {
        const beyond = step >= rowLen;
        this.cells[row][step].classList.toggle('grid-cell--beyond-length', beyond);
        const vel = grid[row][step];
        this.cells[row][step].classList.toggle('grid-cell--active', vel > 0);
        this.cells[row][step].dataset.velocity = String(vel);
        this.cells[row][step].setAttribute('aria-pressed', String(vel > 0));
        const pct = Math.round(probs[row][step] * 100);
        this.cells[row][step].dataset.prob = String(pct);
        this.updateNoteDisplay(row, step, notes[row][step]);
        this.updateFilterLockVisual(row, step, locks[row][step]);
        this.updateRatchetVisual(row, step, ratchets[row][step]);
        this.updateConditionVisual(row, step, conditions[row][step]);
        this.updateGateVisual(row, step, gates[row][step]);
        this.updateSlideVisual(row, step, slides[row][step]);
      }
      this.updateLengthBadge(row, rowLen);
    }
    this.refreshPitchDisplays();
    this.refreshMixerKnobs();
  }

  private updateLengthBadge(row: number, length: number): void {
    const badge = this.lengthBadges[row];
    if (!badge) return;
    if (length < NUM_STEPS) {
      badge.textContent = `\u00d7${length}`;
      badge.style.display = '';
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
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
    const reverbSends = this.sequencer.getCurrentReverbSends();
    const delaySends = this.sequencer.getCurrentDelaySends();
    for (let row = 0; row < NUM_ROWS; row++) {
      this.volumeKnobs[row]?.setValueSilent(volumes[row]);
      this.panKnobs[row]?.setValueSilent((pans[row] + 1) / 2); // -1..1 → 0..1
      this.swingKnobs[row]?.setValueSilent(swings[row] / 0.75); // 0..0.75 → 0..1
      this.reverbKnobs[row]?.setValueSilent(reverbSends[row]);
      this.delayKnobs[row]?.setValueSilent(delaySends[row]);
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

  // === Keyboard grid navigation ===

  private handleGridKeydown(e: KeyboardEvent): void {
    if (!this.gridFocused || this.focusedRow < 0) return;
    const r = this.focusedRow;
    const s = this.focusedStep;

    // Shift+Arrow: cycle velocity on focused cell
    if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      e.stopPropagation();
      this.sequencer.cycleVelocity(r, s);
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        e.stopPropagation();
        this.moveFocus(r, Math.min(s + 1, this.sequencer.getRowLength(r) - 1));
        break;
      case 'ArrowLeft':
        e.preventDefault();
        e.stopPropagation();
        this.moveFocus(r, Math.max(s - 1, 0));
        break;
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        this.moveFocus(Math.min(r + 1, NUM_ROWS - 1), s);
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        this.moveFocus(Math.max(r - 1, 0), s);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        e.stopPropagation();
        this.sequencer.toggleCell(r, s);
        break;
      case 'Escape':
        e.preventDefault();
        this.container.blur();
        break;
      default:
        return; // Don't prevent default for unhandled keys
    }
  }

  private moveFocus(row: number, step: number): void {
    this.clearFocusVisual();
    this.focusedRow = row;
    this.focusedStep = step;
    this.updateFocusVisual();
  }

  private updateFocusVisual(): void {
    if (this.focusedRow < 0 || !this.gridFocused) return;
    const cell = this.cells[this.focusedRow]?.[this.focusedStep];
    if (cell) {
      cell.classList.add('grid-cell--focused');
    }
  }

  private clearFocusVisual(): void {
    if (this.focusedRow >= 0 && this.focusedStep >= 0) {
      const cell = this.cells[this.focusedRow]?.[this.focusedStep];
      cell?.classList.remove('grid-cell--focused');
    }
  }
}
