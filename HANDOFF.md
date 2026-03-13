# Synth Grid — Handoff

## Goal

Synth Grid is a browser-based visual music step sequencer built with vanilla TypeScript + Vite + Web Audio API (zero runtime dependencies). The project has been developed iteratively over 22 rounds, each adding a cohesive set of features. **You are free to do whatever you think is best to develop this project further** — new features, UX improvements, refactoring, performance optimization, visual polish, accessibility, or anything else you see fit.

## Current State

- **90 TypeScript files, 28 CSS files, ~16,800 lines of code**
- **Latest round**: Round 23 — App.ts Extraction + Scheduler Tests
- **Test suite**: Vitest with 225 tests across 16 files (~280ms runtime)
- **CI**: `npm run lint` + `npm test` run before Docker build in GitHub Actions (test -> build-and-push -> deploy)
- **ESLint**: Flat config with TypeScript plugin, zero violations

### What's Built (Rounds 1-22)

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

### Known Gaps

- Theme card swatches are hardcoded — new themes need `swatches` array added manually
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

## Round 24 Plan

### Theme: Pattern Snapshot Extraction + Pure Logic Tests + MIDI Clock Tests

**Goal**: Extract pattern snapshot capture/load from app.ts (~78 lines), add tests for 4 untested pure-logic modules, bring test count from 225 → ~270. app.ts drops from ~403 to ~325 lines.

---

### Step 1: Extract pattern snapshot — `src/state/pattern-snapshot.ts`

Lines 143-220 of app.ts are self-contained capture/load logic used only by PatternLibrary. Extract:

```typescript
export function captureSnapshot(sequencer: Sequencer, audioEngine: AudioEngine, getDelayDivisionIndex: () => number): PatternData
export function loadSnapshot(data: PatternData, sequencer: Sequencer, audioEngine: AudioEngine, effectsPanel?: { setDelayDivisionIndex(i: number): void; refresh(ae: AudioEngine, s: Sequencer): void }): void
```

Handles NaN↔null conversion for filterLocks and automationData. `loadSnapshot` restores all global state (scale, sidechain, soundParams, saturation, EQ, delay division).

**app.ts changes**: Replace lines 143-220 with two import calls. Removes `DELAY_DIVISIONS` import from app.ts.

---

### Step 2: Math utility tests — `src/utils/math.test.ts`

**Target**: `src/utils/math.ts` (17 lines, 3 pure functions, zero deps)

| Test group | Tests | What's tested |
|-----------|-------|---------------|
| `clamp` | 4 | Within range, below min, above max, equal to bounds |
| `lerp` | 4 | t=0, t=1, t=0.5, t beyond 0-1 |
| `scale` | 4 | Identity mapping, reversed range, zero-width input, typical use |

~12 tests.

---

### Step 3: Step clipboard tests — `src/sequencer/step-clipboard.test.ts`

**Target**: `src/sequencer/step-clipboard.ts` (50 lines, pure stateful class)

| Test group | Tests | What's tested |
|-----------|-------|---------------|
| `copy/paste` | 3 | Empty clipboard returns null, copy then paste returns deep clone, paste twice returns independent copies |
| `hasData/sourceStep` | 2 | Initially false/-1, set after copy |
| `deep clone` | 2 | Mutating original doesn't affect clipboard, mutating paste result doesn't affect clipboard |
| `automationData` | 2 | Copy with automation, copy without automation (undefined) |

~9 tests.

---

### Step 4: MIDI clock tests — `src/midi/midi-clock.test.ts`

**Target**: `src/midi/midi-clock.ts` (101 lines). The BPM derivation logic and clock byte handling are testable with mocks.

Extract BPM derivation as a pure helper:
```typescript
export function deriveBpmFromClockTimes(times: number[]): number | null
```

| Test group | Tests | What's tested |
|-----------|-------|---------------|
| `deriveBpmFromClockTimes` | 4 | Too few samples returns null, 120 BPM intervals, 90 BPM intervals, out-of-range BPM returns null |
| `handleClockByte` | 5 | 0xF8 accumulates times, 0xFA starts transport, 0xFC stops transport, ignores when not in receive mode, buffer capped at 48 |
| `setMode` | 2 | Clears received times, stops send timer |

~11 tests.

---

### Step 5: MIDI input tests — `src/midi/midi-input.test.ts`

**Target**: `src/midi/midi-input.ts` (45 lines). Note→row mapping is a pure lookup.

Extract the note map:
```typescript
export const DEFAULT_NOTE_MAP: ReadonlyMap<number, number>
```

| Test group | Tests | What's tested |
|-----------|-------|---------------|
| `DEFAULT_NOTE_MAP` | 4 | GM drum notes (36→0, 38→1, 42→2, 39→3), direct octave (48-55), drum pad alt (24-31), unmapped note returns undefined |
| `handleNote` | 3 | Triggers audio at correct row, normalizes velocity (127→1.0, 64→~0.5), ignores unmapped notes |

~7 tests.

---

### Step 6: Update docs

- **HANDOFF.md**: Add Round 24 row, update line/test counts
- **CLAUDE.md**: Add `pattern-snapshot.ts` to architecture tree, note exported MIDI helpers

---

### Implementation Order

1. `src/state/pattern-snapshot.ts` + app.ts update (extraction)
2. `src/utils/math.test.ts` (quickest, zero deps)
3. `src/sequencer/step-clipboard.test.ts` (pure stateful class)
4. `src/midi/midi-clock.ts` refactor + `src/midi/midi-clock.test.ts`
5. `src/midi/midi-input.ts` refactor + `src/midi/midi-input.test.ts`
6. Docs update

Verify after each step: `npx tsc --noEmit`
Final: `npm run lint && npx tsc --noEmit && npm test && npm run build`

---

### Key Files

| File | Role |
|------|------|
| `src/ui/app.ts` | Pattern snapshot extraction source (~78 lines moving out) |
| `src/utils/math.ts` | 3 pure functions — clamp, lerp, scale |
| `src/sequencer/step-clipboard.ts` | Pure stateful copy/paste clipboard |
| `src/midi/midi-clock.ts` | MIDI clock sync — extract BPM derivation helper |
| `src/midi/midi-input.ts` | MIDI note→instrument mapping — export note map |
| `src/state/pattern-library-storage.ts` | PatternData type definition used by pattern-snapshot |

---

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
npm test           # Run Vitest test suite (225 tests)
npm run test:watch # Run tests in watch mode
```
