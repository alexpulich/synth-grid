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
  main.ts                    # Entry: wires AudioEngine → Sequencer → Scheduler → MidiOutput → AppUI
  types.ts                   # Grid = number[][], VelocityLevel, InstrumentTrigger, ProbabilityGrid, NoteGrid, FilterLockGrid, RatchetGrid, ConditionGrid, GateGrid, SlideGrid, SwingGrid, SoundParams, MidiCCMapping, MidiDeviceInfo, SampleMeta, MidiOutputConfig, ClockMode, AutoParam, AutomationData
  audio/
    audio-engine.ts          # Audio routing hub: per-row GainNode+StereoPanner → dry + per-row reverb/delay sends → master → saturation → EQ → perf insert → compressor → analyser → filter → limiter → destination
    voice-pool.ts            # Polyphony limiter: per-row (max 8) and global (max 48) voice tracking, steal oldest on overflow
    sample-engine.ts         # Per-row AudioBuffer storage, decode, cached trigger functions for sample playback
    scheduler.ts             # Look-ahead scheduler (25ms lookahead, 100ms schedule-ahead), MIDI output integration
    performance-fx.ts        # Hold-to-engage FX: tape stop, stutter, bitcrush, reverb wash
    wav-exporter.ts          # Offline render to WAV (supports synth + sample modes)
    instruments/*.ts         # 8 synth instruments (kick, snare, hihat, clap, bass, lead, pad, perc)
    effects/*.ts             # Reverb (ConvolverNode), Delay (tempo-synced), Filter (BiquadFilter), Saturation (WaveShaperNode), EQ (3-band BiquadFilter)
  sequencer/
    sequencer.ts             # Central state: grids, probabilities, pitchOffsets, noteGrids, rowVolumes, rowPans, reverbSends, delaySends, filterLocks, ratchets, conditions, gates, slides, rowSwings, soundParams, humanize, scale, sidechain, midiOutputConfigs, automationData, clipboard, history
    transport.ts             # Play/stop/tap tempo, All Notes Off on stop
    mute-state.ts            # Per-row mute/solo
    pattern-chain.ts         # Song mode chain (max 32 entries)
  state/
    history.ts               # Undo/redo stack (max 50), snapshots all 17 per-bank data layers
    url-state.ts             # Binary state encoding: V1 (1-bit), V2 (2-bit velocity), V3 (+probability), V4 (+full state: notes, ratchets, conditions, gates, slides, mixer, scale, sidechain, soundParams)
    local-storage.ts         # Auto-save/restore via localStorage (debounced 500ms)
    sample-storage.ts        # IndexedDB wrapper for persisting raw sample ArrayBuffers (50MB limit)
  ui/                        # Pure DOM manipulation, no framework. Constructor pattern: (parent, ...deps) → create DOM, append, wire eventBus
    help-overlay.ts          # ? button + overlay — `sections[]` array: Playback, Grid, Mixer, Pattern, Performance FX, MIDI, Other
    scale-selector.ts        # Root note + scale type dropdowns
    euclidean-popover.ts     # Euclidean rhythm generator popover (hits, rotation, preview, apply)
    sound-shaper.ts          # Per-instrument sound shaping popover — dual mode: synth (ADTP knobs) / sample (waveform, trim, loop, load/remove)
    waveform-preview.ts      # Canvas waveform display with draggable trim start/end handles
    piano-roll.ts            # Piano roll modal for melodic rows (visual note editor, drag paint, note preview, playhead)
    midi-panel.ts            # MIDI settings popover (device list, CC learn, mapping management, output config)
    toast.ts                 # Singleton showToast(message, type?) — auto-dismissing notifications (3s, max 3)
    cell-context-menu.ts     # Right-click context menu: velocity, probability, ratchet, condition, gate, slide, note, filter lock
    automation-lane.ts       # Per-row collapsible automation strip: 5 param buttons (Vol/Pan/Flt/Rev/Del) + 16 draggable value bars
    cell-tooltip.ts          # Hover tooltip for active cells — badge-based display showing all 8 data layers (V/P/R/G/C/N/S/F), non-defaults highlighted
    shortcut-hints.ts        # Contextual shortcut hints on extended hover (800ms), graduated suppression after 3 uses per hint
    onboarding-tour.ts       # Interactive step-by-step tour for first-time users — spotlight + instruction card, event-driven step advancement
    touch-toolbar.ts         # Floating toolbar for touch — FAB toggle edit mode, cell property cycling (vel/prob/ratch/gate/cond/note/slide/delete)
  midi/
    midi-manager.ts          # Web MIDI API access, device detection, message routing (note/CC)
    midi-input.ts            # MIDI note → instrument triggering (GM drum + octave mappings)
    midi-learn.ts            # CC learn mode: arm → capture CC → assign target → mapping stored
    midi-output.ts           # Web MIDI output port management, sendNoteOn/Off/AllNotesOff/Clock/Start/Stop
    midi-clock.ts            # MIDI clock send (24ppqn) and receive (BPM derivation from tick intervals)
  visuals/                   # Canvas-based: particles, waveform, reactive background
  utils/
    event-bus.ts             # Typed pub/sub singleton — EventMap interface enforces compile-time safety
    scales.ts                # 7 musical scales (chromatic→mixolydian), degree/semitone conversion
    euclidean.ts             # Bjorklund's Euclidean rhythm algorithm + pattern rotation
    touch.ts                 # Touch utilities: elementAtTouch() (document.elementFromPoint + closest), isTouchDevice()
styles/
  variables.css              # CSS custom properties (colors, sizing) — themes override these
  help.css                   # Help overlay styles
  toast.css                  # Toast notification styles (fixed bottom-center, z-index 2000)
  cell-context-menu.css      # Cell context menu popover styles (z-index 950)
  sample.css                 # Sample indicator, drop zone, waveform preview, sample controls styling
  automation-lane.css        # Automation lane styling: collapsible strip, param buttons, value bars, pan center-origin display
  touch-toolbar.css          # Touch toolbar FAB + popover styles (pointer: coarse only)
  accessibility.css          # Focus-visible styles + prefers-reduced-motion overrides
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
- **URL state**: Binary serialization (base64url), backward-compatible V1/V2/V3/V4 formats detected by byte length. V4 (1321 bytes, ~1762 URL chars) encodes all sequencer state except filterLocks
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
- **MIDI output engine**: `MidiOutput` class manages Web MIDI output ports. Created in `main.ts`, passed to `Scheduler` (4th param) and `AppUI` (5th param). Initialized with `MIDIAccess` from `MidiManager.init()` in `app.ts`. `resolvePort()` falls back from per-row `portId` to global port
- **MIDI output in scheduler**: `scheduleMidiNote()` helper called after each `audioEngine.trigger()`. Gated behind `midiOutput && sequencer.midiOutputGlobalEnabled && config.enabled`. Uses `setTimeout` matched to audio schedule time for note-on, note-off after gate duration
- **MIDI output config**: Global state (not per-bank), same as `soundParams`. `MidiOutputConfig` per row: `{ enabled, portId, channel, baseNote }`. Default base notes match GM drum map (36=kick, 38=snare, 42=hihat, 39=clap) and C region for melodic (33/48/60/56)
- **MIDI clock**: `MidiClock` class handles send mode (24ppqn `setInterval` synced to tempo) and receive mode (BPM derivation from rolling average of tick intervals). Late-binds `Transport` via `setTransport()` to avoid circular dependency
- **All Notes Off safety**: Transport sends CC123 (All Notes Off) on all active port/channel combos on stop. Also wired to `beforeunload` for stuck note prevention on page close
- **MIDI panel output section**: Added after "Active Mappings" section. Global enable checkbox, output port dropdown, clock mode radios (Off/Send/Receive), per-row config table (channel dropdown, note button with scroll-to-change, enable checkbox), per-row activity dots
- **Automation lanes**: Per-step parameter automation for volume, pan, reverb send, delay send. `AutomationData = number[][][]` — `[paramIndex][row][step]`, NaN = no lock (use row default). UI param indices: 0=Vol, 1=Pan, 2=Flt(filterLocks), 3=Rev, 4=Del. Mapping to data: `UI_TO_AUTO_PARAM = [0, 1, -1, 2, 3]` where -1 means filterLocks. Collapsible via `A` key. Per-bank state, persisted to localStorage and pattern library
- **Automation scheduler**: Applied after filter locks in `scheduler.ts`. For each row/step: checks automation value, applies via `audioEngine.scheduleRowVolume/Pan/ReverbSend/DelaySend()` using `setValueAtTime()`. Non-automated steps restore to row defaults. Pan automation maps 0-1 → -1..1 via `val * 2 - 1`
- **Automation lane UI**: Click/drag to draw values (bottom=0, top=1). Right-click to clear. Pan uses center-origin display (bar offset from center). `pushHistorySnapshot()` on mousedown, `setAutomationSilent()` on mousemove (single undo entry per drag). Filter param reads/writes existing filterLocks via `sequencer.getFilterLock()`/`setFilterLock()`
- **Touch grid painting**: `touchstart`/`touchmove`/`touchend` on grid container with `{ passive: false }` + `e.preventDefault()` to suppress scroll. Uses `elementAtTouch()` (`document.elementFromPoint` + `.closest()`) since touch events fire on original target. Same paint/erase drag mode logic as mouse
- **Long-press context menu**: 500ms timer on `touchstart`, cleared if finger moves >10px or `touchend` fires. On fire: `isDragging = false` + `navigator.vibrate?.(50)` + `cellContextMenu.show()`. Only fires on active cells
- **Touch toolbar (FAB)**: Floating action button visible on `@media (pointer: coarse)`. `editMode` flag: when on, tapping active cells shows toolbar instead of erasing. Toolbar buttons cycle velocity, probability, ratchet, gate, condition, note ±, slide, delete via existing sequencer methods. z-index: FAB=900, toolbar=960
- **Responsive breakpoints**: `≤768px` (tablet): hide pitch/mixer/euclidean/piano controls. `≤480px` (phone): hide header, pattern chain, mute scenes; larger cells (32px). `@media (pointer: coarse)`: `touch-action: none`, disable sticky hover, min-height on piano roll cells
- **PWA**: Service worker (`public/sw.js`) with cache-first for `/assets/` (Vite hashed), network-first for HTML. Manifest at `public/manifest.json`. SVG icon at `public/icons/icon-192.svg`. SW registered in `main.ts` with silent failure fallback
- **Brick-wall limiter**: `DynamicsCompressorNode` (threshold -1dB, ratio 20, attack 0.001s) after filter, before destination. Always on, no UI — pure safety net that catches peaks escaping the main compressor
- **Voice pool**: `VoicePool` in `audio-engine.ts` wraps each `trigger()` call with an intermediary `GainNode`. Per-row limit 8, global limit 48. Oldest voice stolen via instant gain cutoff + disconnect. Lazy cleanup on each `acquire()` — removes voices past their `endTime`. Duration estimated from gate param or defaults (0.5s drums, 1.0s melodic)
- **Cell tooltip badges**: `CellTooltip` shows all 8 data layers as labeled badges (V/P/R/G/C/N/S/F) for every active cell. Non-default values highlighted via `.cell-tooltip__badge--custom`. Melodic-only badges (N, S) hidden on drum rows. Badge elements built once in constructor, values updated on each `show()`. Hidden on touch devices via CSS `@media (pointer: coarse)`
- **Shortcut hints**: `ShortcutHints` shows contextual modifier-key combos on 800ms hover (longer than tooltip's 400ms). Suppressed if cell tooltip is visible, during playback, and on touch devices. Usage tracking in localStorage (`synth-grid-hint-counts`) — after 3 uses of a feature, its hint stops appearing. Tracks usage via EventBus events
- **Onboarding tour**: `OnboardingTour` with 8 steps using spotlight overlay (box-shadow cutout) + instruction card. Steps can `waitForEvent` to auto-advance when user performs the action. Tour state persisted in `localStorage('synth-grid-tour-completed')`. Auto-starts on first visit (no saved state + no URL hash). Re-triggerable from "Take the Tour" button in help overlay. z-index 2100 (above toast)
- **Help overlay tour button**: `HelpOverlay` constructor accepts optional `onTakeTour` callback. When provided, adds a "Take the Tour" button between the title and search input

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
- **History pointer is past-the-end**: `pointer = stack.length` means "live state" (nothing to redo). `push()` sets pointer after appending. Undo decrements-then-reads, redo increments-then-reads. Using `stack.length - 1` breaks redo
- **`grid:cleared` doesn't auto-resync audio**: Many ops (clear, paste, undo, redo, euclidean, presets) emit `grid:cleared` but only `bank:changed` handler originally resynced audio engine GainNodes. A `grid:cleared` handler in app.ts now covers this. New ops modifying sends/volumes must emit one of these events
- **Keyboard shortcuts use `e.code` not `e.key`**: Handler checks `e.code === 'KeyZ'`, not `e.key === 'z'`. Testing via `dispatchEvent` must include `code` property
- **URL format detection is by byte length**: V1(68)/V2(132)/V3(260)/V4(1321). Larger formats must be checked first in `decodeState` (V4 > 260 before V3 ≥ 260). Adding V5 would need > 1321 check first
- **V4 URL float quantization**: 8-bit encoding gives ~0.4% error (e.g., 0.3 → 0.302, 0.5 → 0.502). Acceptable for audio params. Pan uses midpoint encoding: `((pan+1)/2)*255`
- **Pattern chain drag-to-reorder**: HTML5 drag-and-drop on `.chain-item` elements. `moveItem()` in pattern-chain.ts adjusts `_chainPosition` if playback is active. Click-to-remove checks `draggedIndex` to avoid accidental removal after drag
- **MIDI output config is global**: Like `soundParams`, MIDI output configs are not per-bank. Physical hardware routing should not change when switching pattern banks. Not cleared by `clearCurrentBank()`
- **MidiOutput init timing**: `MidiOutput.init(access)` must be called AFTER `MidiManager.init()` resolves, since it needs the `MIDIAccess` object. Done in `app.ts` via `.then()` callback
- **MidiClock circular dependency**: `MidiClock` needs `Transport` for receive mode (Start/Stop → play/stop), but `Transport` needs `MidiClock` for send mode. Solved with late binding: `midiClock.setTransport(transport)` after both are created
- **MidiManager onstatechange chaining**: `MidiOutput.init()` wraps the existing `access.onstatechange` to chain both input and output device updates. When modifying further, preserve the chain
- **MIDI note calculation**: `baseNote + pitchOffset + noteOffset`, clamped 0-127 and rounded. Scheduler uses `Math.round()` since pitch offsets can be fractional semitones
- **MIDI timing via setTimeout**: ~4ms jitter. At 120 BPM a 16th note is 125ms, so ~3% jitter — acceptable. Future enhancement: `MIDIOutput.send(data, timestamp)` for DOMHighResTimeStamp precision
- **Clock send interval recreation**: When tempo changes during send mode, the `setInterval` timer must be destroyed and recreated. `MidiClock` listens to `tempo:changed` event for this
- **N shortcut for MIDI output**: `KeyN` toggles `sequencer.midiOutputGlobalEnabled` + toast. Added to `keyboard-shortcuts.ts` and help overlay
- **Automation data separate from filterLocks**: FilterLocks kept as-is (no migration). AutomationData has 4 params (vol, pan, rev, del). The automation lane UI shows 5 buttons by mapping filter to the existing filterLocks API. Index -1 in `UI_TO_AUTO_PARAM` means "use filterLocks"
- **Automation NaN/null serialization**: Same pattern as filterLocks — NaN in memory, null in JSON. Must convert both directions in localStorage, pattern library, and step clipboard
- **Automation lane alignment**: Uses same `--cell-size` and `--cell-gap` as grid cells. Header spacers match label(56px) + pitch(66px) + mixer(134px) widths. Beat grouping `margin-left: 4px` on steps 0,4,8,12 matches grid
- **A shortcut for automation**: `KeyA` toggles all 8 automation lanes via `grid.toggleAutomationLanes()`. Passed as `onToggleAutomation` callback (last constructor param in `KeyboardShortcuts`)
- **Touch events fire on original target**: Unlike mouse events, `touchmove` fires on the element that received `touchstart`, not the element under the finger. Must use `document.elementFromPoint(touch.clientX, touch.clientY).closest(selector)` for drag-across behavior. The `elementAtTouch()` utility in `src/utils/touch.ts` encapsulates this
- **Touch dismiss on all popovers**: Cell context menu, euclidean popover, sound shaper, and touch toolbar all need `touchstart` listeners for outside-touch dismiss alongside existing `mousedown` listeners. Use `{ passive: true }` for dismiss listeners
- **Touch toolbar z-index stacking**: FAB (z-index 900) < context-menu (950) < touch-toolbar popover (960) < modals (1000). Toolbar must be above context menu since both can be open simultaneously
- **Responsive CSS hides grid controls**: At ≤768px, pitch controls, mixer knobs, euclidean buttons, and piano roll buttons are hidden via CSS `display: none`. The underlying JS still works — only visual hiding. At ≤480px, header, pattern chain, and mute scenes also hide
- **PWA service worker in public/**: `sw.js` lives in `public/` (copied as-is by Vite). Manifest at `public/manifest.json`. SW registration in `main.ts` uses silent `.catch()` — PWA is optional
- **Help overlay touch section**: `.help-section--touch` class shown only on `@media (pointer: coarse)` via CSS in `help.css`. Added as separate DOM section after the main sections loop in `help-overlay.ts`
- **Help overlay search**: Search input at top of help panel filters rows by key+description text. `rowRefs[]` stores {el, text, sectionEl} for each row. Sections with no visible rows get `.help-section--hidden`. Search input is focused and cleared on `show()`. Sticky-positioned search wrap stays visible while scrolling
- **Knob value always visible**: `.knob-value` span already existed (created when `formatValue` is provided). CSS `opacity: 0.5` by default, `1.0` on `.knob-wrapper:hover`. No TS changes needed
- **Perf FX per-color LEDs**: Each button has `data-fx` attribute + `.perf-fx-led` span. CSS uses `[data-fx="tapestop"]` etc. to set `--perf-fx-color` custom property. Active state uses `color-mix()` for box-shadow/background. `@keyframes perf-fx-pulse` animates LED opacity
- **Playhead bar on step header**: `grid-playhead-bar` is absolutely positioned in `.grid-step-header` (position: relative). `highlightStep()` positions it via `stepLabels[step].offsetLeft/offsetWidth`. `transition: left 60ms linear` for smooth sliding. Step labels also get `.grid-step-label--playing` class. Both cleared in `clearPlayhead()`
- **Theme switcher cards**: Replaced `<select>` with clickable `<button class="theme-card">` cards. Each theme definition includes `swatches: string[]` (4 representative colors). Neon Night has `vars: {}` but explicit swatch colors from variables.css defaults. `cycle()` still works via T key
- **Mute scene tooltip**: Lazy-created singleton `.mute-scene-tooltip` div appended to `document.body`. Positioned via `getBoundingClientRect()` on mouseenter. Shows muted instrument names from `INSTRUMENTS` array, "All unmuted" if none muted, "Empty" if scene not saved. Uses reflow trick for CSS transition. Live-updates on `mute:changed` event if tooltip is visible (tracks `hoveredSceneIndex`/`hoveredBtn`)
- **Per-row step length (polyrhythm)**: `rowLengths: number[][]` per-bank state (like rowVolumes/rowPans). Default 16. Scheduler computes `rowStep = currentStep % rowLength[row]` — all grid lookups use `rowStep`. Slide backward search wraps at `rowLen`. Grid still renders 16 columns; steps >= rowLen get `.grid-cell--beyond-length` (dimmed, non-interactive). Per-row playheads via `step % rowLen`. Ctrl+Scroll on label adjusts length (1-16). Length badge `×N` on label when non-default
- **Polyrhythm in dependent features**: Automation lanes dim beyond-length steps. Piano roll uses row length for step count + dynamic `gridTemplateColumns`. Euclidean uses row length for pattern generation + slider max. Step rotation wraps within row length. Step clipboard paste is no-op beyond target length
- **Touch toolbar state feedback**: `updateLabels()` reads current cell attributes and updates button text (e.g., "V:Soft", "P:75%", "R:×2", "G:S", "C:1:2"). Called after `show()` and after each cycle action. Slide button gets `--active` class
- **Help search highlighting**: `filterRows()` wraps matching substrings in `<mark>` elements via DOM manipulation (no innerHTML). `RowRef` stores `keyEl`, `descEl`, `keyText`, `descText` for highlight/restore. Highlights cleared when search is empty
- **Voice pool wrapper approach**: Rather than modifying instrument trigger functions, `VoicePool.acquire()` returns a `GainNode` that connects to the row's channel strip. Instrument triggers connect to this intermediary node. To steal a voice: `cancelScheduledValues` + `setValueAtTime(0)` + `disconnect()`. Works identically for synth and sample triggers since both follow the `(ctx, dest, time, ...)` signature
- **Voice pool duration estimation**: Gate param gives actual note length, but instruments also have inherent decay tails. Defaults (0.5s drums, 1.0s melodic) are conservative — voices may linger slightly past their estimated end, cleaned up on next `acquire()`. Not critical since stolen voices are already masked by newer triggers
- **Limiter chain position**: Limiter goes after filter (last user-controllable effect) so filter resonance peaks are caught. Chain: `filter.output → limiter → ctx.destination`. The existing compressor at -6dB handles most dynamics; the limiter at -1dB is purely a safety backstop
- **Cell tooltip badge DOM reuse**: Badge elements are created once in the constructor and stored in `badgeEls[]`. Each `show()` call updates `textContent` and class toggles — no DOM creation/destruction per hover. More efficient than the old approach of rebuilding content each time
- **Cell tooltip `isVisible()` method**: Public method exposed for `ShortcutHints` to check before showing its own hint. Prevents both tooltip and hint from appearing simultaneously
- **Shortcut hint graduated suppression**: `synth-grid-hint-counts` localStorage key stores `{ [trackKey]: number }`. Each EventBus event (e.g., `ratchet:changed`) increments the relevant counter. Once all `trackKeys` for a hint reach threshold (3), that hint is permanently suppressed for the user
- **Tour spotlight box-shadow technique**: A small `position: fixed` div with `box-shadow: 0 0 0 9999px rgba(0,0,0,0.75)` creates a full-screen dark overlay with a cutout hole. The `border-radius: 6px` rounds the cutout. CSS transitions animate position/size changes between steps
- **Tour event-driven advancement**: Steps with `waitForEvent` subscribe to the EventBus via `eventBus.on()` which returns an unsub function stored in `eventUnsub`. On event fire, unsub is called and step advances after 400ms delay. `clearEventListener()` called on every step change and on finish
- **Tour auto-start conditions**: Only auto-starts when: (1) no URL hash (not loading shared pattern), (2) `localStorage('synth-grid-tour-completed')` is not 'true'. The `!hash` check runs first in app.ts. Static `OnboardingTour.isCompleted()` reads localStorage without instantiating the tour
- **Help overlay `onTakeTour` callback**: Optional 2nd constructor param. When provided, creates "Take the Tour" button between title and search. Callback hides help overlay then starts tour. Does not break existing usage — param is optional with no default
- **Comprehensive undo/redo**: `HistoryEntry` captures all 17 per-bank data layers (grid, probabilities, noteGrid, filterLocks, ratchets, conditions, gates, slides, rowVolumes, rowPans, rowSwings, reverbSends, delaySends, automationData, rowLengths, pitchOffsets). `restoreEntry()` in sequencer restores all layers and emits `grid:cleared`. Deep clone uses spread (preserves NaN), automationData uses nested `.map()` for 3D array
- **ARIA grid pattern**: Grid container: `role="grid"`, rows: `role="row"`, cells: `role="gridcell"` + `aria-label="{instrument} Step {n}"` + `aria-pressed`. Toast container: `role="status"` + `aria-live="polite"`. Help/piano-roll overlays: `role="dialog"` + `aria-modal="true"`. Knobs: `aria-valuetext` via `formatValue`. Transport play button: `aria-label` toggles "Play"/"Stop"
- **Keyboard grid navigation**: Grid container `tabindex="0"`. Focus listener sets `gridFocused=true` and shows `.grid-cell--focused` highlight. Arrow keys move focus, Enter/Space toggles cell, Escape blurs grid, Shift+Up/Down cycles velocity. `e.stopPropagation()` on handled keys prevents document-level shortcut conflicts (e.g., Space=play). Focus respects `rowLengths` for horizontal bounds
- **Focus-visible styles**: `styles/accessibility.css` with `:focus-visible` rules for all interactive elements. `outline: 2px solid var(--color-text); outline-offset: 2px`. Grid cells use `outline-offset: -2px` (inset). `.grid-cell--focused` class for keyboard navigation highlight (distinct from `:focus-visible`)
- **prefers-reduced-motion**: CSS `@media (prefers-reduced-motion: reduce)` disables all decorative animations (cell-trigger, bank-switch-flash, modal-slide-in, toast transitions, playhead sliding, etc.). JS checks `window.matchMedia('(prefers-reduced-motion: reduce)')` in `ParticleSystem` and `ReactiveBackground` — skips `burst()`, cancels animation frames, clears canvas. Listens for live changes
