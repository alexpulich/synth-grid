# Synth Grid

Browser-based visual music step sequencer. Zero runtime dependencies — vanilla TypeScript + Vite + Web Audio API.

## Commands

```
npm run dev        # Start dev server (port 5173)
npm run build      # Type-check + build for production
npx tsc --noEmit   # Type-check only
npm test           # Run Vitest test suite (366 tests, ~600ms)
npm run test:watch # Run tests in watch mode
```

## Architecture

```
src/
  main.ts                    # Entry: wires AudioEngine -> Sequencer -> Scheduler -> MidiOutput -> AppUI
  types.ts                   # All type defs + constants (Grid, VelocityLevel, SoundParams, MidiOutputConfig, AutomationData, etc.)
  audio/
    audio-engine.ts          # Audio routing: per-row GainNode+StereoPanner -> dry + reverb/delay sends -> master -> saturation -> EQ -> perf insert -> compressor -> analyser -> filter -> limiter -> destination
    voice-pool.ts            # Polyphony limiter: per-row (max 8) and global (max 48), steal oldest on overflow
    sample-engine.ts         # Per-row AudioBuffer storage, decode, cached trigger functions
    scheduler.ts             # Look-ahead scheduler (25ms tick, 100ms schedule-ahead), MIDI output integration. Exports: checkCondition, applySwing, midiNoteClamp
    audio-sync.ts            # wireAudioSync(): event→audioEngine wiring (volume, pan, sends, soundParams, bank/clear resync)
    sample-manager.ts        # wireSampleManager(): event→IndexedDB+audioEngine wiring for sample load/remove/toggle/meta
    performance-fx.ts        # Hold-to-engage FX: tape stop, stutter, bitcrush, reverb wash
    wav-exporter.ts          # Offline render to WAV (synth + sample modes)
    instruments/*.ts         # 8 synth instruments (kick, snare, hihat, clap, bass, lead, pad, perc)
    effects/*.ts             # Reverb, Delay (tempo-synced), Filter, Saturation, EQ (3-band)
  sequencer/
    sequencer.ts             # Central state: delegates per-bank data to BankStateManager + global state (soundParams, scale, sidechain, MIDI configs, humanize)
    bank-state.ts            # BankStateManager: 16 per-bank data arrays + capture/restore/clear/loadAll
    transport.ts             # Play/stop/tap tempo, All Notes Off on stop
    mute-state.ts            # Per-row mute/solo
    pattern-chain.ts         # Song mode chain (max 32 entries)
  state/
    history.ts               # Undo/redo stack (max 50), snapshots all 17 per-bank data layers
    url-state.ts             # Binary state encoding: backward-compatible V1/V2/V3/V4
    local-storage.ts         # Auto-save/restore via localStorage (debounced 500ms)
    state-restorer.ts        # restoreAppState() + restoreSampleBuffers(): URL hash / localStorage / IndexedDB restore orchestration
    pattern-snapshot.ts      # captureSnapshot() + loadSnapshot(): PatternLibrary save/load with NaN↔null conversion
    sample-storage.ts        # IndexedDB wrapper for sample ArrayBuffers (50MB limit)
  ui/                        # Pure DOM manipulation, no framework. Constructor pattern: (parent, ...deps) -> create DOM, append, wire eventBus
    grid.ts                  # Grid UI: DOM building, visual updates (670 lines)
    grid-event-manager.ts    # Grid DOM event handlers: mouse/touch drag paint, wheel shortcuts, keyboard nav, context menu (377 lines)
    euclidean-popover.ts     # Euclidean rhythm generator + density randomizer popover
    sound-shaper.ts          # Per-instrument sound shaping — dual synth/sample mode
    piano-roll.ts            # Piano roll modal for melodic rows — delegates to piano-state.ts for pure logic
    piano-state.ts           # Pure piano roll functions: computePitchRows, determineCellAction, getDragEffect
    automation-lane.ts       # Per-row collapsible automation strip (Vol/Pan/Flt/Rev/Del)
    cell-context-menu.ts     # Right-click context menu: all 8 cell data layers
    cell-tooltip.ts          # Hover tooltip for active cells — badge-based display
    toast-wiring.ts          # wireNotifications(): eventBus→showToast for bank/grid/MIDI events
    visual-wiring.ts         # wireVisuals(): particle bursts, visualizer wake, playhead clear on transport events
    touch-toolbar.ts         # Floating toolbar for touch — FAB toggle edit mode
    toast.ts                 # Singleton showToast(message, type?) — auto-dismissing (3s, max 3)
    help-overlay.ts          # ? button + searchable shortcut reference
    midi-panel.ts            # MIDI settings popover (device list, CC learn, output config)
    onboarding-tour.ts       # Interactive spotlight tour for first-time users
    shortcut-hints.ts        # Contextual hints on extended hover (800ms), graduated suppression
    scale-selector.ts        # Root note + scale type dropdowns
    waveform-preview.ts      # Canvas waveform with draggable trim handles
  midi/
    midi-manager.ts          # Web MIDI API access, device detection, message routing
    midi-input.ts            # MIDI note -> instrument triggering (GM drum + octave mappings). Exports DEFAULT_NOTE_MAP
    midi-learn.ts            # CC learn mode: arm -> capture -> assign
    midi-output.ts           # Web MIDI output port management
    midi-wiring.ts           # wireMidi(): midiManager→midiInput/midiLearn/midiClock callback wiring + CC router
    midi-clock.ts            # MIDI clock send (24ppqn) and receive (BPM derivation). Exports deriveBpmFromClockTimes
  visuals/                   # Canvas-based: particles, waveform, reactive background
  utils/
    event-bus.ts             # Typed pub/sub singleton — EventMap enforces compile-time safety
    scales.ts                # 7 musical scales, degree/semitone conversion
    euclidean.ts             # Bjorklund's algorithm + pattern rotation
    touch.ts                 # elementAtTouch() for cross-element touch drag
styles/
  variables.css              # CSS custom properties (colors, sizing) — themes override these
  main.css                   # @imports all other CSS files
  *.css                      # One CSS file per feature (help, toast, sample, automation-lane, etc.)
```

## Key Patterns

- **Event bus**: Typed `EventMap` — all `emit()`/`on()` calls get compile-time payload checking. Components never reference each other directly. All cross-component wiring lives in `app.ts`
- **Look-ahead scheduling**: `AudioContext.currentTime` with 100ms lookahead for sample-accurate timing
- **Velocity**: Grid cells are `number` (0=off, 1=soft/0.33, 2=medium/0.66, 3=loud/1.0)
- **Melodic rows**: Bass (4), Lead (5), Pad (6) support per-step note input. Non-melodic rows ignore note/slide
- **Per-bank state**: grids, probabilities, noteGrids, pitchOffsets, rowVolumes, rowPans, filterLocks, ratchets, conditions, gates, slides, rowSwings, reverbSends, delaySends, automationData, rowLengths (17 layers total)
- **Global state** (not per-bank): soundParams, scale, sidechain, humanize, midiOutputConfigs, tempo
- **InstrumentTrigger signature**: `(ctx, dest, time, velocity?, pitchOffset?, params?, gate?, glideFrom?)`
- **History**: `pushHistory()` saves BEFORE mutation. `undoWithLiveState()` saves current state when undoing from top (so redo can restore it). `restoreEntry()` restores all 17 layers atomically
- **Silent setters**: `setNoteOffsetSilent()` / `setCell()` / `setAutomationSilent()` skip history push. Use with `pushHistorySnapshot()` once at drag start for single undo entry per drag
- **Grid UI split**: `GridUI` (grid.ts) handles DOM building + eventBus visual updates. `GridEventManager` (grid-event-manager.ts) handles all DOM event listeners. Created after `buildGrid()` in GridUI constructor
- **Polyrhythm**: `rowStep = currentStep % rowLength[row]` in scheduler. Grid renders 16 columns; beyond-length cells dimmed via `.grid-cell--beyond-length`
- **Filter locks vs automation**: Separate data structures. FilterLocks = `FilterLockGrid` (NaN = no lock). AutomationData = `number[][][]` (4 params: vol, pan, rev, del). UI maps filter button to filterLocks API via `UI_TO_AUTO_PARAM = [0, 1, -1, 2, 3]`
- **NaN/null serialization**: FilterLocks and AutomationData use NaN in memory, null in JSON. Must convert both directions
- **Density randomizer**: `sequencer.randomizeRow(row, density)` — density 0-1. UI in euclidean popover below separator
- **CSS organization**: One CSS file per feature in `styles/`, imported in `styles/main.css`. BEM naming
- **z-index stacking**: tour (2100) > toast (2000) > cell-tooltip (1500) > modals (1000) > touch-toolbar (960) > context-menu (950) > FAB (900) > euclidean (900) > MIDI panel (500)
- **Testing**: Vitest, `environment: 'node'` (no DOM). Tests colocated as `*.test.ts`. CI runs `npm test` before build

## Gotchas

### Grid & UI
- **Grid cell events live in GridEventManager**: `mousedown` (not `click`) for drag-paint; `contextmenu` opens context menu. Modifier+right-click: Ctrl=condition, Shift=filter clear, Alt=gate
- **Cell overlays must use DOM elements**: `::before` taken by note display, `::after` by probability stripes. Use `.grid-cell-ratchet`, `.grid-cell-gate`, `.grid-cell-slide`, `.grid-cell-filter`
- **Label interactions**: click=mute, shift+click=solo, double-click=sound shaper, Ctrl+Scroll=row length. No conflict because dblclick fires after mousedown
- **Piano roll alignment**: Non-melodic rows need `.grid-piano-btn--spacer` (visibility: hidden) for cell alignment
- **Label colors**: Use `var(--color-instrumentname)` CSS vars, not inline colors
- **New CSS files**: Must be `@import`ed in `styles/main.css` or they won't load
- **Knob `setValueSilent(v)`**: Use for programmatic updates (bank switch, state restore) — avoids triggering onChange callbacks
- **Toast reflow trick**: `void el.offsetHeight` before adding visible class. `requestAnimationFrame` unreliable in headless contexts
- **No innerHTML**: Use `clearChildren()` (while loop removeChild) or `textContent` for XSS safety

### State & Persistence
- **History pointer is past-the-end**: `pointer = stack.length` = live state. Undo decrements-then-reads, redo increments-then-reads
- **`grid:cleared` must resync audio**: Many ops emit `grid:cleared` — app.ts handler resyncs audio engine GainNodes. New ops modifying sends/volumes must emit this
- **Adding per-bank state** (9-step checklist): (1) sequencer array + init, (2) getter/setter/getAll/getCurrent, (3) clearCurrentBank + loadFullState, (4) EventMap event, (5) local-storage.ts auto-save, (6) SavedState interface + save/load, (7) app.ts event->audioEngine, (8) bank change sync in app.ts, (9) UI control in grid.ts
- **Sample state split**: `useSample`/`SampleMeta` are global (not per-bank). AudioBuffer in IndexedDB (async restore), metadata in localStorage (sync)
- **URL format detection by byte length**: V4>260 checked before V3>=260. Adding V5 needs >1321 check first
- **Per-row swing vs global swing**: Old `sequencer.swing` kept for backward compat. Transport Swing knob sets all per-row swings. Scheduler only uses per-row swings

### Keyboard Shortcuts
- **Use `e.code` not `e.key`**: `e.code === 'KeyZ'`, not `e.key === 'z'`. Testing via `dispatchEvent` must include `code`
- **Update both files**: `keyboard-shortcuts.ts` AND `help-overlay.ts` sections array must stay in sync
- **Grid keyboard uses `stopPropagation()`**: Prevents document-level shortcuts (Space=play) from conflicting with grid nav (Space=toggle)

### MIDI
- **Web MIDI API**: Only Chromium + HTTPS/localhost. `MidiManager.init()` silently returns false in Firefox
- **MidiOutput init timing**: `init(access)` called AFTER `MidiManager.init()` resolves async in app.ts
- **MidiClock circular dependency**: Solved with `midiClock.setTransport(transport)` late binding
- **MIDI output config is global**: Like soundParams — not per-bank, not cleared by clearCurrentBank

### Build & Dev
- **Vite stale transform errors**: If "Failed to resolve import" for existing file, restart dev server
- **TypeScript strict + Web Audio**: Use `new Float32Array(new ArrayBuffer(n * 4))` and `Uint8Array<ArrayBuffer>`
- **`readonly` for future-use params**: Avoids TS6138 "declared but never read" while keeping param accessible
- **app.ts is the wiring hub**: event->audioEngine, bank sync, state restore, MIDI CC targets, sample handlers. Almost always needs updates for new features
