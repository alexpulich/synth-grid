# Synth Grid

Browser-based visual music step sequencer. Zero runtime dependencies — vanilla TypeScript + Vite + Web Audio API.

## Commands

```
npm run dev       # Start dev server (port 5173)
npm run build     # Type-check + build for production
npx tsc --noEmit  # Type-check only
```

## Architecture

```
src/
  main.ts                    # Entry: wires AudioEngine → Sequencer → Scheduler → AppUI
  types.ts                   # Grid = number[][], VelocityLevel, InstrumentTrigger, ProbabilityGrid, NoteGrid, FilterLockGrid, RatchetGrid, ConditionGrid, GateGrid, SlideGrid, SwingGrid, SoundParams, MidiCCMapping, MidiDeviceInfo, SampleMeta
  audio/
    audio-engine.ts          # Audio routing hub: per-row GainNode+StereoPanner → dry + per-row reverb/delay sends → master → saturation → EQ → perf insert → compressor → analyser → filter → destination
    sample-engine.ts         # Per-row AudioBuffer storage, decode, cached trigger functions for sample playback
    scheduler.ts             # Look-ahead scheduler (25ms lookahead, 100ms schedule-ahead)
    performance-fx.ts        # Hold-to-engage FX: tape stop, stutter, bitcrush, reverb wash
    wav-exporter.ts          # Offline render to WAV (supports synth + sample modes)
    instruments/*.ts         # 8 synth instruments (kick, snare, hihat, clap, bass, lead, pad, perc)
    effects/*.ts             # Reverb (ConvolverNode), Delay (tempo-synced), Filter (BiquadFilter), Saturation (WaveShaperNode), EQ (3-band BiquadFilter)
  sequencer/
    sequencer.ts             # Central state: grids, probabilities, pitchOffsets, noteGrids, rowVolumes, rowPans, reverbSends, delaySends, filterLocks, ratchets, conditions, gates, slides, rowSwings, soundParams, humanize, scale, sidechain, clipboard, history
    transport.ts             # Play/stop/tap tempo
    mute-state.ts            # Per-row mute/solo
    pattern-chain.ts         # Song mode chain (max 32 entries)
  state/
    history.ts               # Undo/redo stack (max 50)
    url-state.ts             # Binary state encoding: V1 (1-bit), V2 (2-bit velocity), V3 (+probability)
    local-storage.ts         # Auto-save/restore via localStorage (debounced 500ms)
    sample-storage.ts        # IndexedDB wrapper for persisting raw sample ArrayBuffers (50MB limit)
  ui/                        # Pure DOM manipulation, no framework. Constructor pattern: (parent, ...deps) → create DOM, append, wire eventBus
    help-overlay.ts          # ? button + overlay — `sections[]` array: Playback, Grid, Mixer, Pattern, Performance FX, MIDI, Other
    scale-selector.ts        # Root note + scale type dropdowns
    euclidean-popover.ts     # Euclidean rhythm generator popover (hits, rotation, preview, apply)
    sound-shaper.ts          # Per-instrument sound shaping popover — dual mode: synth (ADTP knobs) / sample (waveform, trim, loop, load/remove)
    waveform-preview.ts      # Canvas waveform display with draggable trim start/end handles
    piano-roll.ts            # Piano roll modal for melodic rows (visual note editor, drag paint, note preview, playhead)
    midi-panel.ts            # MIDI settings popover (device list, CC learn, mapping management)
    toast.ts                 # Singleton showToast(message, type?) — auto-dismissing notifications (3s, max 3)
    cell-context-menu.ts     # Right-click context menu: velocity, probability, ratchet, condition, gate, slide, note, filter lock
    cell-tooltip.ts          # Hover tooltip for active cells — shows non-default attributes after 400ms delay
  midi/
    midi-manager.ts          # Web MIDI API access, device detection, message routing (note/CC)
    midi-input.ts            # MIDI note → instrument triggering (GM drum + octave mappings)
    midi-learn.ts            # CC learn mode: arm → capture CC → assign target → mapping stored
  visuals/                   # Canvas-based: particles, waveform, reactive background
  utils/
    event-bus.ts             # Typed pub/sub singleton — EventMap interface enforces compile-time safety
    scales.ts                # 7 musical scales (chromatic→mixolydian), degree/semitone conversion
    euclidean.ts             # Bjorklund's Euclidean rhythm algorithm + pattern rotation
styles/
  variables.css              # CSS custom properties (colors, sizing) — themes override these
  help.css                   # Help overlay styles
  toast.css                  # Toast notification styles (fixed bottom-center, z-index 2000)
  cell-context-menu.css      # Cell context menu popover styles (z-index 950)
  sample.css                 # Sample indicator, drop zone, waveform preview, sample controls styling
```

## Key Patterns

- **Event bus**: Typed `EventMap` interface — all `emit()`/`on()` calls get compile-time payload checking. Never direct references between components
- **Look-ahead scheduling**: Scheduler uses `AudioContext.currentTime` with 100ms lookahead for sample-accurate timing
- **Velocity**: Grid cells are `number` (0=off, 1=soft/0.33, 2=medium/0.66, 3=loud/1.0)
- **Pitch offset**: `Math.pow(2, semitones / 12)` multiplier on all oscillator frequencies. Per-step note offset (±12 semitones) is additive with row pitch offset
- **Melodic rows**: Bass (4), Lead (5), Pad (6) support per-step note input via Alt+scroll or piano roll. Non-melodic rows ignore it
- **Piano roll**: Modal overlay for melodic rows (♪ button). Shows 2D grid: steps × pitches. Scale-aware: chromatic=25 rows, non-chromatic=only in-scale notes. Click/drag to place/erase notes. Audible preview via `audioEngine.trigger()` with 150ms gate, throttled 50ms. Playhead tracks `step:advance`. Uses `setNoteOffsetSilent()` + `pushHistorySnapshot()` for drag paint (single undo entry per drag). `GridUI` receives `audioEngine` param to pass to `PianoRoll`
- **Master compressor**: `DynamicsCompressorNode` (threshold -6dB, ratio 12) prevents clipping — transparent to user
- **Auto-save**: localStorage persistence with 500ms debounce. URL hash takes priority on load
- **Step rotation**: `[`/`]` keys shift entire pattern left/right by one step (wraps around)
- **Theme system**: CSS custom properties on `:root`, 4 themes defined in `theme-switcher.ts`, persisted in localStorage
- **URL state**: Binary serialization (base64url), backward-compatible V1/V2/V3 formats detected by byte length
- **CSS organization**: One CSS file per feature in `styles/`, imported in `styles/main.css`. BEM naming: `.component-name`, `.component-name--modifier`
- **Per-row mixer**: Persistent `GainNode[]` + `StereoPannerNode[]` channel strips in audio-engine. Volume/pan are per-bank state
- **Scale quantization**: Global scale + root note (not per-bank). Alt+scroll converts to scale degrees for non-chromatic scales
- **Euclidean rhythms**: Bjorklund's algorithm generates evenly-distributed patterns. Applied via `sequencer.applyEuclidean()` (pushes history)
- **Sidechain ducking**: Kick (row 0) triggers gain envelope on rows 1-7. 5ms attack, configurable depth/release
- **Filter locks**: `FilterLockGrid` uses NaN for "no lock", 0-1 for normalized frequency. Serialized as null in JSON (localStorage)
- **Ratchets**: `RatchetGrid` values 1-4 (1 = normal single hit). Ctrl+scroll cycles count. Scheduler subdivides step duration evenly
- **Trig conditions**: `ConditionGrid` indexes into `TRIG_CONDITIONS` (0=always, 1=1:2, 2=2:2, 3=1:4, 4=3:4, 5=!1). Loop counter increments when step wraps to 0
- **Sound params**: Per-instrument `SoundParams` (attack, decay, tone, punch) — global, not per-bank. 0.5 = factory default. Double-click label opens shaper popover
- **Tape saturation**: `WaveShaperNode` with `tanh(drive*x)/tanh(drive)` curve. Drive 0=clean, 1=heavy. Inserted between masterGain and compressor
- **Tempo-synced delay**: Musical divisions (1/2, 1/4, 1/8, etc.) × (60/bpm). Auto-updates when BPM changes via `syncToBpm()`
- **Master EQ**: 3-band (lowshelf 200Hz, peaking 1kHz Q=1, highshelf 8kHz). Knob 0-1 maps to -12 to +12 dB: `(v - 0.5) * 24`. Chain: saturation → EQ → compressor
- **Humanize**: Global knob 0-1. Timing jitter `±8% * stepDuration`, velocity variance `±20%`. Applied per-trigger including ratchet subdivisions. Clamp `triggerTime >= ctx.currentTime`
- **Per-row swing**: `SwingGrid = number[]` per bank (0-0.75). Applied as trigger time offset on odd steps in `scheduleStep()`, NOT in `advanceStep()`. Global Swing knob sets all rows
- **Gate (note length)**: `GateGrid` values 0-3 indexing `GATE_LEVELS = [0.25, 0.5, 0.75, 1.0]`. `gateDuration = stepDuration * GATE_LEVELS[gate]`. Alt+Right-click cycles. Visual: `.grid-cell-gate` bar at bottom
- **Slide/Glide**: `SlideGrid = boolean[][]` per bank. Only melodic rows (4,5,6). Scheduler searches backward for previous active note pitch. Instruments ramp frequency over 60ms via `exponentialRampToValueAtTime`
- **InstrumentTrigger signature**: `(ctx, dest, time, velocity?, pitchOffset?, params?, gate?, glideFrom?)` — gate is 7th param, glideFrom is 8th
- **MIDI manager**: `MidiManager.init()` async, non-blocking. Requests `navigator.requestMIDIAccess()`. Auto-reconnects on device plug/unplug via `onstatechange`. Routes note-on (0x90) to `MidiInput`, CC (0xB0) to `MidiLearn`
- **MIDI note mapping**: GM drum notes 36-43 and direct octave 48-55 and alt octave 24-31 all map to instrument rows 0-7. Velocity (1-127) normalized to 0-1. Triggers `audioEngine.trigger()` at `ctx.currentTime` for lowest latency
- **MIDI CC learn**: Flow: `armLearn()` → move MIDI knob → CC captured → user selects target from dropdown → `assignTarget()` creates mapping. One mapping per CC, one mapping per target. `handleCC()` applies mapped value (0-127 → 0-1 normalized) via `onApply` callback
- **MIDI CC targets**: String identifiers like `'tempo'`, `'volume:0'`, `'pan:3'`, `'reverb-mix'`, `'eq-low'`. Target application wired in `app.ts`. Pan maps 0-1 → -1..1, tempo maps 0-1 → 30-300 BPM
- **MIDI persistence**: CC mappings stored in localStorage via `SavedState.midiMappings`. `MidiLearn.loadMappings()` restores on page load
- **Toast notifications**: Singleton `showToast(message, type?)` in `toast.ts`. Auto-dismissing (3s), max 3 visible, slide-in animation. Types: info, success, warning. Container: `position: fixed; bottom: 2rem; z-index: 2000`
- **Cell context menu**: Right-click opens popover with all cell ops (velocity, probability, ratchet, condition, gate, slide, note, filter lock). Singleton pattern. Smart viewport positioning to avoid overflow
- **Cell hover tooltip**: Shows non-default attributes after 400ms hover delay. Only for active cells. Hides when context menu opens. Uses `sequencer` getters for all 8 cell data layers
- **Knob drag tooltip**: Lazy-created on first drag. Uses existing `KnobOptions.formatValue` callback. Shows formatted value above knob during drag, hides 500ms after release
- **CSS transitions**: `app-fade-in` (400ms page load), `bank-switch-flash` (200ms grid cells), `modal-slide-in` (300ms help/piano-roll), button `:active` scale(0.95)
- **Per-row effect sends**: Each row has independent `rowReverbSends[i]` and `rowDelaySends[i]` GainNodes. Routing: `pan → dryBus(1.0) + rowReverbSend(0.3) + rowDelaySend(0.25)`. Sends are per-bank state (like volume/pan). R/D knobs in mixer strip
- **Sample engine**: `SampleEngine` stores per-row `AudioBuffer`, `SampleMeta` (filename, trimStart, trimEnd, loop), and cached `InstrumentTrigger` functions. `audio-engine.trigger()` checks `useSample[row]` and delegates to sample or synth trigger. Pitch via `playbackRate`, velocity via gain, gate via duration, glide via ramp
- **Sample loading**: Drag WAV/MP3/OGG/M4A onto row label → `sample:load-request` event → decode → store in `SampleEngine` + IndexedDB. File picker also available in sound shaper sample mode
- **Sample persistence**: Raw `ArrayBuffer` stored in IndexedDB (`sample-storage.ts`, 50MB limit). Metadata (`useSample`, `sampleMetas`) in localStorage. Both restored on page load — IndexedDB async, localStorage sync
- **Sound shaper dual mode**: Synth mode shows ADTP knobs. Sample mode shows waveform preview + trim handles + loop toggle + load/remove buttons. Mode toggle button in title bar. `useSample` flag per row (global, not per-bank)
- **Waveform preview**: Canvas 200x60px drawing with min/max envelope. Draggable trim start/end handles (2px cyan lines with triangle grips). Active region highlighted. `onChange` callback emits `sample:meta-changed`

## Gotchas

- **TypeScript strict typed arrays**: Use `new Float32Array(new ArrayBuffer(n * 4))` and `Uint8Array<ArrayBuffer>` to satisfy strict mode with Web Audio API
- **Label colors**: Use `var(--color-instrumentname)` CSS vars, not inline hardcoded colors, so themes apply correctly
- **Grid cell events**: Use `mousedown` (not `click`) for drag-paint; `contextmenu` opens cell context menu (plain right-click). Modifier+right-click shortcuts preserved: Ctrl = condition, Shift = filter clear, Alt = gate
- **InstrumentConfig.color**: Mutable — updated on theme change for particle system colors
- **History snapshots**: Always include probabilities and noteGrid when pushing to history stack
- **Note display**: CSS `::before` with `content: attr(data-note)` — set `data-note` attribute on cell, delete attribute when note is 0
- **Adding shortcuts**: Update both `keyboard-shortcuts.ts` AND `help-overlay.ts` to keep in sync. Help overlay uses a `sections` array — add rows to the matching section (Grid, Mixer, etc.)
- **New CSS files**: Must be `@import`ed in `styles/main.css` or they won't load
- **FilterLockGrid NaN/null**: NaN means "no lock" in memory; must convert NaN→null for JSON serialization and null→NaN on restore
- **Knob `setValueSilent(v)`**: Use for programmatic updates (e.g., bank switch) — avoids triggering onChange callbacks
- **Ratchet/condition visuals**: Use DOM elements (`.grid-cell-ratchet`, `.grid-cell-condition`), NOT CSS pseudo-elements — `::before` is taken by note display, `::after` by probability stripes
- **Label double-click vs click**: Plain click = mute, shift+click = solo, double-click = open sound shaper. No conflict because dblclick fires after mousedown
- **SoundParams global**: Sound params are global (not per-bank), like scale. Not cleared on clearBank. Persisted in localStorage
- **Gate/slide visuals**: Use DOM elements (`.grid-cell-gate`, `.grid-cell-slide`), same pattern as ratchet/condition visuals
- **Grid cell modifier keys**: Alt+Click = slide toggle, Alt+Right-click = gate cycle. Check `e.altKey` before other branches in handlers
- **AutoSave accepts audioEngine**: `new AutoSave(sequencer, audioEngine)` — needed for EQ persistence. audioEngine is optional param
- **Per-row swing vs global swing**: Old `sequencer.swing` kept for backward compat in `loadFullState`. Transport Swing knob sets all per-row swings. Scheduler only uses per-row swings
- **Humanize global**: `sequencer.humanize` is global (not per-bank), like soundParams. 0 = no effect, 1 = maximum wobble
- **Piano roll alignment**: Non-melodic rows use `.grid-piano-btn--spacer` (visibility: hidden) to maintain grid cell alignment with melodic rows that have the ♪ button
- **setNoteOffsetSilent**: Like `setCell` vs `toggleCell` — skips history push, emits `note:changed`. Use with `pushHistorySnapshot()` for batch operations (drag paint)
- **AutoSave accepts midiLearn**: `new AutoSave(sequencer, audioEngine, midiLearn)` — 3rd param for MIDI CC mapping persistence
- **MIDI learn keyboard shortcut**: `M` key toggles learn mode. Added to `keyboard-shortcuts.ts` as `MidiLearn` param (7th constructor arg)
- **MIDI panel**: Popover pattern (not modal). `position: fixed; z-index: 500`. Toggle via MIDI button in controls row. Activity dot flashes green on any MIDI message (100ms timeout)
- **Web MIDI API availability**: `MidiManager.init()` silently returns `false` if `navigator.requestMIDIAccess` is undefined (e.g., Firefox, HTTP). The MIDI button still appears but panel shows "No MIDI devices connected"
- **No innerHTML**: MIDI panel uses `clearChildren()` helper (while loop removeChild) instead of `innerHTML = ''` for XSS safety
- **Toast reflow trick**: `void el.offsetHeight` forces reflow before adding `toast--visible` class to trigger CSS transition. `requestAnimationFrame` is unreliable in headless/background contexts
- **Cell context menu z-index 950**: Below modals (1000) but above grid. Cell tooltip z-index 1500 hides when context menu opens via `hidden` flag
- **Cell tooltip only shows non-defaults**: Active cells with all defaults (vel=Loud, prob=100%, ratchet=1x, etc.) show no tooltip. Uses middle dot separator for attributes
- **Toast wired to events not buttons**: Toast for "Bank cleared" fires via `grid:cleared` event in `app.ts`, not in button click handlers. All toast triggers go through events for consistency
- **Knob tooltip lazy creation**: Tooltip div created on first mousedown/touchstart, not in constructor. Reused for subsequent drags
- **Sample state split**: `useSample` and `SampleMeta` are global (not per-bank), like soundParams. `reverbSends`/`delaySends` are per-bank (like volume/pan). AudioBuffer data lives in IndexedDB, metadata in localStorage
- **IndexedDB async restore**: Sample buffers are restored from IndexedDB asynchronously after page load. The `sampleStorage.loadAll().then(...)` runs in background — UI updates via `sample:loaded` events as each buffer decodes
- **WAV exporter accepts audioEngine**: `exportToWav(sequencer, audioEngine?)` — audioEngine is optional for backward compat. When provided, checks `useSample[row]` to render samples in export
- **Drag-and-drop file filter**: Row label drop handler filters by file extension (`/\.(wav|mp3|ogg|m4a)$/i`). Non-audio files are silently ignored
- **Label drop visual**: `.grid-row-label--drop-target` class adds dashed outline during dragover. `.grid-row-label--sample` adds dotted underline when sample is loaded
- **Adding per-bank state**: Follow reverbSends/delaySends pattern: (1) add array + init in sequencer constructor, (2) add getter/setter/getAll/getCurrent methods, (3) update `clearCurrentBank()` and `loadFullState()`, (4) add event to EventMap, (5) add `eventBus.on(...)` in local-storage.ts for auto-save, (6) add to SavedState interface + save() + load(), (7) wire event → audioEngine in app.ts, (8) sync on bank change in app.ts, (9) add UI control in grid.ts
- **app.ts wiring hub**: All cross-component wiring lives in app.ts: event → audio engine, bank change sync, state restore from localStorage/IndexedDB, MIDI CC target application, sample load/remove handlers. When adding a new feature, app.ts almost always needs updates
- **`readonly` for future-use constructor params**: Use `readonly` instead of `private` for constructor params not yet read (e.g., passed through for Phase N+1). Avoids TS6138 "declared but value never read" while keeping the param accessible
- **Vite stale transform errors**: If Vite reports "Failed to resolve import" for a file that exists, restart the dev server. Vite caches transform errors from previous sessions and doesn't re-check until restart
