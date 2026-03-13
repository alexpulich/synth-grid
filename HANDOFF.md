# Synth Grid — Handoff

## Goal

Synth Grid is a browser-based visual music step sequencer built with vanilla TypeScript + Vite + Web Audio API (zero runtime dependencies). The project has been developed iteratively over 21 rounds, each adding a cohesive set of features. **You are free to do whatever you think is best to develop this project further** — new features, UX improvements, refactoring, performance optimization, visual polish, accessibility, or anything else you see fit.

## Current State

- **86 TypeScript files, 28 CSS files, ~16,500 lines of code**
- **Latest round**: Round 21 — Lint CI + MIDI CC Extraction + Tests
- **Test suite**: Vitest with 162 tests across 11 files (~230ms runtime)
- **CI**: `npm run lint` + `npm test` run before Docker build in GitHub Actions (test -> build-and-push -> deploy)
- **ESLint**: Flat config with TypeScript plugin, zero violations

### What's Built (Rounds 1-21)

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

### Known Gaps

- Theme card swatches are hardcoded — new themes need `swatches` array added manually
- Toast `role="status"` container created lazily — screen readers won't see it until first toast
- Test coverage limited to pure logic — no DOM/UI tests (would need jsdom)
- Random preview in euclidean popover is truly random — preview doesn't match what gets applied

## Architecture Quick Reference

- **Event-driven**: Typed `EventMap` pub/sub — components never reference each other directly. `app.ts` is the wiring hub
- **Audio chain**: Per-row gains/panners -> dry bus + reverb/delay sends -> master -> saturation -> EQ -> perf FX -> compressor -> analyser -> filter -> limiter -> destination
- **State**: Sequencer holds all grid state. 4 banks (A-D). 17 per-bank data layers + global state. localStorage auto-save (500ms debounce). URL hash encoding (V1-V4)
- **UI**: Pure DOM manipulation, no framework. Grid split: `GridUI` (DOM/visuals) + `GridEventManager` (events)
- **Testing**: Vitest, node environment, colocated `*.test.ts` files. CI gate (lint + test) before deploy
- **MIDI CC routing**: Extracted to `src/midi/midi-cc-router.ts` — standalone function, testable with mocks

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

## What To Watch Out For

- **NaN/null serialization**: FilterLocks and AutomationData use NaN in memory, null in JSON — easy to forget conversion
- **Pseudo-element collisions**: `::before`=notes, `::after`=probability stripes. New cell overlays must use DOM elements
- **Web MIDI**: Chromium-only + HTTPS/localhost. Firefox silently fails
- **Adding per-bank state is a 9-step checklist**: See CLAUDE.md gotchas
- **`grid:cleared` must resync audio**: App.ts handler covers this — new ops modifying mixer state must emit this event
- **Keyboard shortcuts**: Must update both `keyboard-shortcuts.ts` AND `help-overlay.ts` sections array
- **QA Bug #1 (undo off-by-one)**: QA reported this but 22 unit tests confirm undo/redo is correct. The QA test may have been run on an older code version. Cross-bank undo test added in Round 21 as regression guard.

## Round 22 Plan

### Theme: Test Coverage + Sequencer Refactor + Euclidean Preview Fix

Rounds 19-21 focused on testing infrastructure, linting, and extraction. Round 22 continues the technical health push by closing the biggest test gaps, tackling the largest file in the codebase (`sequencer.ts` at 1,002 lines), and fixing one of the remaining known UX bugs.

### Step 1: Extract MIDI module tests

Add tests for `midi-learn.ts` — the only MIDI module with pure logic that's testable without Web MIDI API mocks.

**New file**: `src/midi/midi-learn.test.ts`
- `armLearn()` sets armed state
- `handleCC()` in armed mode stores pending CC
- `assignTarget()` creates mapping and disarms
- `handleCC()` with mapping calls `onApply` callback with normalized value
- Duplicate CC or target replaces previous mapping
- `removeMapping()` removes by target
- `loadMappings()` restores mappings

Estimated: ~10 tests.

### Step 2: Add mute-scenes tests

**New file**: `src/sequencer/mute-scenes.test.ts`

Test `MuteScenes` class (pure state, no DOM):
- Save/recall scenes
- Empty scene recall behavior
- `loadScenes()` restores state
- Scene independence (modifying one doesn't affect another)

Estimated: ~6 tests.

### Step 3: Extract sequencer bank-state accessors

**File**: `src/sequencer/sequencer.ts` (1,002 lines)

The sequencer has ~400 lines of repetitive per-bank getters/setters (get/set/getAll/getCurrent for each of 17 layers). Extract these into a `BankStateManager` class that the sequencer delegates to.

**New file**: `src/sequencer/bank-state.ts`
- `BankStateManager` — manages all 17 per-bank data layers
- Typed getters: `getGrid(bank)`, `getCurrentGrid()`, `getAllGrids()`
- Typed setters with event emission
- `captureEntry(bank)` / `restoreEntry(entry)` for history integration

**Modify**: `src/sequencer/sequencer.ts`
- Replace inline array management with `this.bankState.getGrid(bank)` etc.
- Keep sequencer as the public API; bank-state is an internal implementation detail
- Target: sequencer.ts drops from ~1,002 to ~600 lines

### Step 4: Fix euclidean preview randomness (Known Gap)

Currently the euclidean popover preview generates a random pattern, but applying generates a different one. Fix by using seeded PRNG (already available via `mulberry32`).

**File**: `src/ui/euclidean-popover.ts`
- Generate a seed when preview is requested
- Use `mulberry32(seed)` for both preview and apply
- Preview now matches the applied pattern exactly

### Step 5: Add bank-state tests

**New file**: `src/sequencer/bank-state.test.ts`

Test the extracted `BankStateManager`:
- Initialize with correct dimensions
- Get/set per-bank layers
- `captureEntry()` returns deep clone
- `restoreEntry()` applies atomically
- Bank isolation (modifying bank 0 doesn't affect bank 1)

Estimated: ~8 tests.

### Step 6: Update CLAUDE.md and HANDOFF.md

- Add `bank-state.ts` to architecture tree in CLAUDE.md
- Document the new sequencer/bank-state split pattern
- Update test counts and file counts

### Verification

1. `npm run lint` — zero violations
2. `npx tsc --noEmit` — compiles clean
3. `npm test` — all tests pass (~190 expected)
4. `npm run build` — production build succeeds
5. Manual: verify euclidean preview matches applied pattern

### Files to modify
- `src/midi/midi-learn.test.ts` — new tests
- `src/sequencer/mute-scenes.test.ts` — new tests
- `src/sequencer/bank-state.ts` — new, extracted from sequencer.ts
- `src/sequencer/bank-state.test.ts` — new tests
- `src/sequencer/sequencer.ts` — delegate to bank-state
- `src/ui/euclidean-popover.ts` — seeded preview
- `CLAUDE.md` — update architecture tree
- `HANDOFF.md` — update for Round 22

### Risk assessment
- **Bank-state extraction** (medium risk): Large refactor but purely mechanical — move arrays + accessors. Existing 41 sequencer tests serve as regression guard. Run tests after each method migration.
- **Euclidean preview fix** (low risk): Isolated to one popover. Seeded PRNG already used by density randomizer.
- **New tests** (no risk): Additive only.

## Key Files to Start With

| File | Why |
|------|-----|
| `CLAUDE.md` | Full architecture, patterns, and gotchas — read this first |
| `src/main.ts` | Entry point — shows how everything wires together |
| `src/types.ts` | All type definitions and constants |
| `src/sequencer/sequencer.ts` | Central state management (17 per-bank layers + global state) |
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
npm test           # Run Vitest test suite (162 tests)
npm run test:watch # Run tests in watch mode
```
