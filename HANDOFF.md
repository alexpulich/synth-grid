# Synth Grid — Handoff

## Goal

Synth Grid is a browser-based visual music step sequencer built with vanilla TypeScript + Vite + Web Audio API (zero runtime dependencies). The project has been developed iteratively over 22 rounds, each adding a cohesive set of features. **You are free to do whatever you think is best to develop this project further** — new features, UX improvements, refactoring, performance optimization, visual polish, accessibility, or anything else you see fit.

## Current State

- **98 TypeScript source files (+30 test files), 28 CSS files, ~16,500 lines of code**
- **Latest round**: Round 29 — MIDI Message Parsing + Factory Preset Validation
- **Test suite**: Vitest with 430 tests across 35 files (~760ms runtime)
- **CI**: `npm run lint` + `npm test` run before Docker build in GitHub Actions (test -> build-and-push -> deploy)
- **ESLint**: Flat config with TypeScript plugin, zero violations

### What's Built (Rounds 1-26)

| Round | Features |
|-------|----------|
| 1 | 8-instrument grid, 16-step sequencer, Web Audio synthesis, basic transport |
| 2 | Keyboard shortcuts, presets, randomize, URL sharing, waveform visualizer, WAV export |
| 3 | Per-step velocity (3 levels), undo/redo, drag paint, mute/solo, pattern chain (song mode) |
| 4 | Copy/paste banks, step probability, 4 themes, pitch offset, performance FX, reactive background |
| 5 | Per-row mixer (volume/pan), scale quantization (7 scales), euclidean rhythms, sidechain ducking, filter locks |
| 6 | Ratchets (1-4x), trig conditions, sound shaper (ADSR), tape saturation, tempo-synced delay |
| 7 | Master 3-band EQ, humanize, per-row swing, note gate (4 lengths), slide/glide (melodic rows) |
| 8 | Piano roll modal for melodic rows (scale-aware, click/drag paint, audible preview, playhead) |
| 9 | MIDI input: device detection, note triggering (GM drum + octave), CC learn mode, MIDI panel UI |
| 10 | Toast notifications, knob/cell tooltips, right-click context menu, CSS transitions |
| 11 | Per-row sample loading (drag-and-drop), sample engine, waveform preview, per-row effect sends, IndexedDB persistence |
| 12 | Metronome, mute scenes (8 slots), step copy/paste, pattern queue, pattern library (IndexedDB, 4 factory presets) |
| 13 | MIDI output (per-row config), MIDI clock sync (send/receive 24ppqn), All Notes Off safety |
| 14 | Automation lanes: per-step vol/pan/rev/del automation, collapsible visual editor, per-bank state |
| 15 | Mobile & touch: touch painting, long-press context menu, FAB touch toolbar, responsive CSS, PWA |
| 16 | Visual polish: knob values, per-FX LED indicators, playhead bar, mute scene tooltips, theme cards, help search |
| 17 | Per-row step length (polyrhythm, 1-16 steps), touch toolbar feedback, help highlighting, tempo-adaptive playhead |
| 18 | Accessibility: comprehensive undo/redo (17 layers), ARIA, keyboard grid nav, focus-visible, prefers-reduced-motion |
| 19 | Bug fixes + testing foundation: fix redo bug, Vitest setup with 65 tests |
| 20 | Refactor: extract GridEventManager from grid.ts, density randomizer, 41 sequencer tests (106 total), CI test integration |
| 21 | Lint CI, MIDI CC router extraction from app.ts, cross-bank undo tests, PRNG tests (162 total) |
| 22 | Extract BankStateManager from sequencer.ts, MIDI learn tests (12), mute scenes tests (7), bank-state tests (10) — 191 total |
| 23 | Extract audio-sync.ts + state-restorer.ts from app.ts (~180 lines out), scheduler tests (20), piano-state extraction + tests (14) — 225 total |
| 24 | Extract pattern-snapshot.ts from app.ts (~75 lines out), math tests (12), step-clipboard tests (9), MIDI clock refactor + tests (11), MIDI input tests (7) — 264 total |
| 25 | Extract sample-manager.ts + createBitcrushCurve from app.ts/performance-fx.ts, pattern-snapshot tests (16), local-storage tests (10), bitcrush tests (7) — 297 total |
| 26 | Extract midi-wiring.ts + toast-wiring.ts from app.ts, state-restorer tests (16), audio-sync tests (8), voice-pool tests (8) — 329 total |
| 27 | Randomizer tests (13), toast-wiring tests (7), midi-wiring tests (9), sample-manager tests (8), extract visual-wiring.ts from app.ts — 366 total |
| 28 | Visual-wiring tests (8), theme-utils extraction + tests (8), keyboard-action extraction + tests (20), theme swatch gap resolved — 402 total |
| 29 | MIDI message parsing extraction + tests (16), factory preset validation tests (12), midi-manager/midi-output refactored to use shared builders — 430 total |

### Known Gaps

- Toast `role="status"` container created lazily — screen readers won't see it until first toast
- Test coverage limited to pure logic — no DOM/UI tests (would need jsdom)

## Architecture Quick Reference

- **Event-driven**: Typed `EventMap` pub/sub — components never reference each other directly. `app.ts` is the wiring hub
- **Audio chain**: Per-row gains/panners -> dry bus + reverb/delay sends -> master -> saturation -> EQ -> perf FX -> compressor -> analyser -> filter -> limiter -> destination
- **State**: Sequencer holds all grid state. 4 banks (A-D). 16 per-bank data layers managed by `BankStateManager` + global state. localStorage auto-save (500ms debounce). URL hash encoding (V1-V4)
- **UI**: Pure DOM manipulation, no framework. Grid split: `GridUI` (DOM/visuals) + `GridEventManager` (events)
- **Testing**: Vitest, node environment, colocated `*.test.ts` files. CI gate (lint + test) before deploy
- **MIDI CC routing**: Extracted to `src/midi/midi-cc-router.ts` — standalone function, testable with mocks
- **Bank state**: Extracted to `src/sequencer/bank-state.ts` — `BankStateManager` owns all 16 per-bank arrays. Sequencer delegates storage to it, retains public API + event emission
- **Audio sync**: Extracted to `src/audio/audio-sync.ts` — event→audioEngine wiring for volume, pan, sends, soundParams, bank/clear resync
- **State restoration**: Extracted to `src/state/state-restorer.ts` — URL hash + localStorage + IndexedDB sample buffer restore
- **Piano roll state**: Pure logic extracted to `src/ui/piano-state.ts` — pitch row computation, cell action determination, drag effects
- **Pattern snapshot**: Extracted to `src/state/pattern-snapshot.ts` — captureSnapshot/loadSnapshot with NaN↔null conversion for PatternLibrary
- **Sample manager**: Extracted to `src/audio/sample-manager.ts` — event→IndexedDB+audioEngine wiring for sample load/remove/toggle/meta
- **Bitcrush curve**: `createBitcrushCurve()` exported from `performance-fx.ts` — standalone pure function for WaveShaperNode staircase curve
- **MIDI wiring**: Extracted to `src/midi/midi-wiring.ts` — wireMidi() connects midiManager callbacks to midiInput/midiLearn/midiClock + CC router
- **Toast wiring**: Extracted to `src/ui/toast-wiring.ts` — wireNotifications() connects eventBus bank/grid/MIDI events to showToast
- **Visual wiring**: Extracted to `src/ui/visual-wiring.ts` — wireVisuals() connects particle bursts, visualizer wake, playhead clear to transport events
- **Theme utils**: `deriveSwatches()` in `src/ui/theme-utils.ts` — derives 4 preview swatches from theme CSS vars, replacing hardcoded arrays
- **Keyboard action**: `resolveKeyAction()` in `src/ui/keyboard-action.ts` — pure key→action mapping extracted from keyboard-shortcuts.ts
- **MIDI helpers**: `deriveBpmFromClockTimes` exported from midi-clock.ts, `DEFAULT_NOTE_MAP` exported from midi-input.ts
- **MIDI message**: `parseMidiMessage()` + `buildNoteOn/Off/CC/AllNotesOff` + `MIDI_CLOCK/START/STOP` in `src/midi/midi-message.ts` — pure parsing/building extracted from midi-manager.ts and midi-output.ts

See `CLAUDE.md` for detailed patterns, gotchas, and the full architecture tree.

## What Worked Well

- **Incremental rounds**: Cohesive batches of 4-6 related features kept complexity manageable
- **CLAUDE.md as source of truth**: Architecture docs + gotchas dramatically reduced errors in later rounds
- **Event bus architecture**: Adding features without touching existing code was trivial
- **Plan-then-implement**: Detailed plans before coding prevented rework
- **Silent setter pattern**: `setCell()`/`setNoteOffsetSilent()` skip history for drag ops — call `pushHistorySnapshot()` once at start
- **Per-bank vs global state patterns**: Established conventions (volume=per-bank, soundParams=global) made new state additions predictable
- **GridEventManager extraction** (Round 20): Clean split of 1031-line grid.ts into visual updates (670) + event handlers (377). Low risk because handlers already called sequencer through clean API
- **Tests found the real bug**: QA reported "undo off-by-one" but tests showed the real issue was redo returning null from top of stack
- **MIDI CC extraction** (Round 21): Removed ~70 lines from app.ts by extracting self-contained switch block into testable module
- **BankStateManager extraction** (Round 22): Moved 16 per-bank arrays + capture/restore/clear/loadAll into dedicated class. Sequencer dropped from 1,002 to ~540 lines. All 41 sequencer tests passed without modification

## What To Watch Out For

- **NaN/null serialization**: FilterLocks and AutomationData use NaN in memory, null in JSON — easy to forget conversion
- **Pseudo-element collisions**: `::before`=notes, `::after`=probability stripes. New cell overlays must use DOM elements
- **Web MIDI**: Chromium-only + HTTPS/localhost. Firefox silently fails
- **Adding per-bank state is a 9-step checklist**: See CLAUDE.md gotchas
- **`grid:cleared` must resync audio**: App.ts handler covers this — new ops modifying mixer state must emit this event
- **Keyboard shortcuts**: Must update both `keyboard-shortcuts.ts` AND `help-overlay.ts` sections array
- **BankStateManager fields are `readonly` arrays**: The arrays themselves can be mutated (elements reassigned), but the array references are stable — sequencer accesses them via `this.bs.grids[bank]` etc.

## Round 23 Summary

### Theme: App.ts Extraction + Scheduler Tests

**Completed:**
1. **audio-sync.ts** (44 lines) — Extracted event→audioEngine wiring from app.ts. Deduplicates bank:changed / grid:cleared resync into `resyncAllRows` helper
2. **state-restorer.ts** (193 lines) — Extracted URL hash + localStorage restore from app.ts. `restoreAppState()` + `restoreSampleBuffers()` with dependency injection via `StateRestorerDeps` interface
3. **scheduler.test.ts** (20 tests) — Tests for `checkCondition` (8), `applySwing` (4), `midiNoteClamp` (5), scheduling math (3). Exported 3 pure helpers from scheduler.ts
4. **piano-state.ts** (78 lines) + **piano-state.test.ts** (14 tests) — Extracted `computePitchRows`, `determineCellAction`, `getDragEffect` from piano-roll.ts

**app.ts**: 583 → 403 lines (-180)

## Round 24 Summary

### Theme: Pattern Snapshot Extraction + Pure Logic Tests + MIDI Clock Tests

**Completed:**
1. **pattern-snapshot.ts** (93 lines) — Extracted `captureSnapshot`/`loadSnapshot` from app.ts. Handles NaN↔null conversion for filterLocks and automationData. Restores all global state (scale, sidechain, soundParams, saturation, EQ, delay division)
2. **math.test.ts** (12 tests) — Tests for `clamp` (4), `lerp` (4), `scale` (4)
3. **step-clipboard.test.ts** (9 tests) — Tests for copy/paste (3), hasData/sourceStep (2), deep clone integrity (2), automationData handling (2)
4. **midi-clock.ts** refactor + **midi-clock.test.ts** (11 tests) — Extracted `deriveBpmFromClockTimes` pure helper. Tests for BPM derivation (4), handleClockByte (5), setMode (2)
5. **midi-input.ts** export + **midi-input.test.ts** (7 tests) — Exported `DEFAULT_NOTE_MAP` as `ReadonlyMap`. Tests for note mapping (4), handleNote (3)

**app.ts**: 403 → 328 lines (-75)

## Round 25 Summary

### Theme: Sample Manager Extraction + Pattern Snapshot & Local Storage Tests + Bitcrush Curve Extraction

**Completed:**
1. **createBitcrushCurve** extracted from `PerformanceFX` class to standalone exported function in `performance-fx.ts` + **performance-fx.test.ts** (7 tests) — Float32Array length, quantization levels, endpoints, midpoint, monotonicity
2. **sample-manager.ts** (57 lines) — Extracted `wireSampleManager()` from app.ts. Handles 4 sample events: load-request (size check + decode + IndexedDB), removed, mode-toggled, meta-changed
3. **pattern-snapshot.test.ts** (16 tests) — Tests for `captureSnapshot` (6): NaN→null conversion, deep copy, field presence. Tests for `loadSnapshot` (10): null→NaN conversion, loadFullState args, setScale/setSidechain, humanize, saturation/EQ setters, effectsPanel edge cases
4. **local-storage.test.ts** (10 tests) — Tests for `AutoSave.load()` (7): null/invalid/missing/valid states. NaN serialization contract tests (3)

**app.ts**: 328 → 280 lines (-48)

## Round 26 Summary

### Theme: MIDI Wiring Extraction + Toast Wiring + State Restorer & Audio Sync & Voice Pool Tests

**Completed:**
1. **midi-wiring.ts** (31 lines) — Extracted `wireMidi()` from app.ts. Wires midiManager callbacks (onNote→midiInput, onCC→midiLearn, onClock→midiClock) + midiLearn.onApply(createMidiCCRouter)
2. **toast-wiring.ts** (18 lines) — Extracted `wireNotifications()` from app.ts. Wires eventBus toast notifications for bank:queued/copied/pasted, grid:cleared, midi:devices-changed
3. **state-restorer.test.ts** (16 tests) — Tests for restoreAppState URL/localStorage routing (4), null→NaN conversion (2), backward compat swing distribution (2), saturation/EQ/delay restore (3), MIDI mappings (1), sample meta (1), mute scenes (1), MIDI output config (2)
4. **audio-sync.test.ts** (8 tests) — Tests for wireAudioSync event→audioEngine wiring: volume/pan/reverb/delay sends, soundparam assignment, bank:changed/grid:cleared resync
5. **voice-pool.test.ts** (8 tests) — Tests for VoicePool: acquire/connect, expiry cleanup, per-row limit (8), global limit (48), steal behavior, independent row tracking

**app.ts**: 280 → 255 lines (-25)

## Round 27 Summary

### Theme: Extracted Module Tests + Visual Wiring Extraction

**Completed:**
1. **randomizer.test.ts** (13 tests) — Exported `euclidean` for direct testing. Tests for euclidean algorithm (hit count, edge cases, distribution), randomizeGrid (dimensions, velocity levels, density profiles, determinism)
2. **toast-wiring.test.ts** (7 tests) — Tests for wireNotifications: bank queued/copied/pasted toasts, grid:cleared toast, MIDI device change toasts, null/empty guard paths
3. **midi-wiring.test.ts** (9 tests) — Tests for wireMidi: onNote→midiInput, onCC→midiLearn, onClock→midiClock delegation, undefined midiClock path, createMidiCCRouter integration, argument forwarding
4. **sample-manager.test.ts** (8 tests) — Tests for wireSampleManager: load-request (success/full/decode-error), sample:removed, sample:mode-toggled, sample:meta-changed (with/without buffer/record)
5. **visual-wiring.ts** (40 lines) — Extracted `wireVisuals()` from app.ts: particle bursts on step:advance, visualizer wake on transport:play, playhead clear on transport:stop

**app.ts**: 255 → 228 lines (-27)

## Round 28 Summary

### Theme: Visual Wiring Tests + Theme Swatch Derivation + Keyboard Action Extraction

**Completed:**
1. **visual-wiring.test.ts** (8 tests) — Tests for wireVisuals: particle bursts for active/audible cells, muted row skipping, polyrhythm step wrapping, cell rect centering, visualizer wake, playhead clear, undefined rowLength default
2. **theme-utils.ts** (13 lines) + **theme-utils.test.ts** (8 tests) — `deriveSwatches()` pure function replaces hardcoded `swatches` arrays in theme definitions. Tests for defaults, full/partial overrides, all 3 non-default themes, length, extra key ignoring
3. **theme-switcher.ts** modification — Removed `swatches` from `ThemeDefinition` interface and all hardcoded swatch arrays. Now calls `deriveSwatches(theme.vars)` for preview colors
4. **keyboard-action.ts** (80 lines) + **keyboard-action.test.ts** (20 tests) — `resolveKeyAction()` pure key→action mapping extracted from keyboard-shortcuts.ts. Tests for all 20 action types including FX, undo/redo, copy/paste, mute scenes, bank queue, and null for unknown keys
5. **keyboard-shortcuts.ts** modification — Delegates to `resolveKeyAction()` for key mapping, switches on `action.type` for side effects

**Test count**: 366 → 402 (+36 tests across 3 new test files)

## Round 29 Summary

### Theme: MIDI Message Parsing + Factory Preset Validation

**Completed:**
1. **midi-message.ts** (53 lines) — Extracted `parseMidiMessage()` parser (byte→struct) and `buildNoteOn/Off/CC/AllNotesOff` builders (struct→bytes) + `MIDI_CLOCK/START/STOP` constants from midi-manager.ts and midi-output.ts
2. **midi-message.test.ts** (16 tests) — Parser tests (note-on, velocity-0-as-note-off, explicit note-off, CC, system real-time, channel extraction, null guards). Builder tests (correct bytes, channel/note clamping, velocity float→int mapping, AllNotesOff, constants)
3. **midi-manager.ts** refactor — `handleMessage()` now calls `parseMidiMessage()` and switches on `msg.type`
4. **midi-output.ts** refactor — All 6 send methods now use shared builders/constants instead of inline byte arrays
5. **factory-presets.ts** — Exported `defaultData()` for direct testing
6. **factory-presets.test.ts** (12 tests) — defaultData dimensions/defaults (4), per-preset characteristic validation (4), cross-preset invariants: unique IDs, valid velocities, dimensions, probability bounds (4)

**Test count**: 402 → 430 (+28 tests across 2 new test files)

## Suggestions for Round 30

### Codebase Status

- **app.ts** (228 lines, stable) — Mostly DOM construction + initialization wiring. Only extractable block: factory preset seeding (~15 lines, diminishing returns)
- **All extracted modules tested** — audio-sync, state-restorer, pattern-snapshot, sample-manager, midi-wiring, toast-wiring, visual-wiring all have test coverage
- **Pure logic extraction complete** — keyboard-action, piano-state, theme-utils, all scheduler/clock helpers extracted and tested
- **Test coverage**: 33/97 source files (34%) have tests. Remaining untested files are mostly DOM/Web Audio/Canvas-dependent

### Viable Directions

**Option A: MIDI Message Parsing Extraction (~15 tests)**
- Extract `parseMidiMessage(data: Uint8Array)` from `MidiManager.handleMessage()` — pure function returning `{type, channel, note?, velocity?, cc?, value?}`
- Extract MIDI message encoding helpers from `MidiOutput` (`buildNoteOn`, `buildNoteOff`, `buildCC`, `buildClock`) — pure byte-array builders
- Tests: note-on/off parsing, CC parsing, system real-time detection, velocity-0-as-note-off, encoding bit masking, channel clamping
- Low risk, self-contained pure logic

**Option B: Factory Preset Validation Tests (~12 tests)**
- Test `FACTORY_PRESETS` data generators in `data/factory-presets.ts` — verify grid dimensions, velocity ranges, tempo bounds, required fields
- Test `defaultData()` helper (correct array dimensions, default values)
- No extraction needed — functions are already exported/exportable
- Tests ensure presets don't silently break when types change

**Option C: New User-Facing Feature**
- Pattern export/import via JSON file (download + drag-and-drop load)
- Undo toast (brief notification showing what was undone, with redo shortcut hint)
- Swing visualization (subtle per-row offset indicators in the grid)
- A/B comparison mode (quick-switch between two banks with visual diff)

**Option D: Accessibility Improvements**
- ARIA live regions for toast (fix known gap: `role="status"` container created lazily)
- Screen reader announcements for transport state changes
- Keyboard-navigable theme switcher and effects panel

## Key Files to Start With

| File | Why |
|------|-----|
| `CLAUDE.md` | Full architecture, patterns, and gotchas — read this first |
| `src/main.ts` | Entry point — shows how everything wires together |
| `src/types.ts` | All type definitions and constants |
| `src/sequencer/sequencer.ts` | Central state management (delegates to BankStateManager + global state) |
| `src/sequencer/bank-state.ts` | Per-bank data layer storage (16 arrays, capture/restore/clear) |
| `src/audio/scheduler.ts` | Core scheduling loop |
| `src/audio/audio-engine.ts` | Audio routing graph |
| `src/ui/grid.ts` | Grid UI — DOM building + visual updates |
| `src/ui/grid-event-manager.ts` | Grid DOM event handlers (mouse, touch, keyboard, wheel) |
| `src/utils/event-bus.ts` | Event system — `EventMap` interface shows all events |
| `src/midi/midi-cc-router.ts` | MIDI CC target routing (extracted from app.ts) |

## Commands

```
npm run dev        # Start dev server (port 5173)
npm run build      # Type-check + build for production
npx tsc --noEmit   # Type-check only
npm run lint       # ESLint (zero violations)
npm test           # Run Vitest test suite (430 tests)
npm run test:watch # Run tests in watch mode
```
