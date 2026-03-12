# Synth Grid — Handoff

## Goal

Synth Grid is a browser-based visual music step sequencer built with vanilla TypeScript + Vite + Web Audio API (zero runtime dependencies). The project has been developed iteratively over 18 rounds, each adding a cohesive set of features. **You are free to do whatever you think is best to develop this project further** — new features, UX improvements, refactoring, performance optimization, visual polish, accessibility, or anything else you see fit.

## Current State

- **83 TypeScript files, 28 CSS files, ~16,000 lines of code**
- **Latest round**: Round 19 — Bug Fixes + Testing Foundation
- **Test suite**: Vitest with 65 tests (history, euclidean, scales, URL serialization)
- **No lint config** — only `npx tsc --noEmit` for type checking
- **Deployment**: Dockerfile + GitHub Actions CI/CD exist

### What's Built (Rounds 1-18)

| Round | Features |
|-------|----------|
| 1 | 8-instrument grid, 16-step sequencer, Web Audio synthesis, basic transport |
| 2 | Keyboard shortcuts, presets, randomize, URL sharing, waveform visualizer, WAV export |
| 3 | Per-step velocity (3 levels), undo/redo, drag paint, mute/solo, pattern chain (song mode) |
| 4 | Copy/paste banks, step probability, 4 themes, pitch offset, performance FX (tape stop/stutter/bitcrush/reverb wash), reactive background |
| 5 | Per-row mixer (volume/pan), scale quantization (7 scales), euclidean rhythms, sidechain ducking, filter locks |
| 6 | Ratchets (1-4x), trig conditions (1:2, 2:2, etc.), sound shaper (ADSR per instrument), tape saturation, tempo-synced delay |
| 7 | Master 3-band EQ, humanize (timing/velocity jitter), per-row swing, note gate (4 lengths), slide/glide (melodic rows) |
| 8 | Piano roll modal for melodic rows (visual 2D note editor, scale-aware pitch rows, click/drag paint, audible note preview, playhead tracking) |
| 9 | MIDI integration: device detection, note input (GM drum + octave mappings), CC learn mode (arm → capture → assign), MIDI panel UI, mapping persistence |
| 10 | Toast notifications, knob drag tooltips, cell hover tooltips, right-click cell context menu (all 8 cell data layers), CSS transitions (page fade-in, bank switch flash, modal slide-in, button active states) |
| 11 | Per-row sample loading (drag-and-drop WAV/MP3/OGG), sample playback engine (pitch/velocity/gate/glide), waveform preview with trim handles, per-row reverb/delay sends (R/D knobs), IndexedDB sample persistence, sound shaper dual synth/sample mode, WAV export with sample support |
| 12 | Metronome (K toggle, beat dots, volume), mute scenes (8 slots, Shift+click save, click recall), step copy/paste (Ctrl+click header), pattern queue (bank switch on loop boundary), pattern library (save/load/import/export named patterns, 4 factory presets, IndexedDB) |
| 13 | MIDI output (send notes to external synths/DAWs), per-row MIDI output config (channel, base note, enable), MIDI clock sync (send/receive 24ppqn), All Notes Off safety (CC123 on stop + beforeunload), MIDI panel output UI (port select, clock mode, per-row config, activity dots) |
| 14 | Automation lanes: per-step volume/pan/reverb-send/delay-send automation with collapsible visual editor per row. Click/drag to draw values, right-click to clear. Filter cutoff lane reads existing filterLocks. Per-bank state, persisted to localStorage and pattern library. Toggle with A key |
| 15 | Mobile & touch: touch grid painting (tap/drag), long-press context menu, floating touch toolbar (FAB toggle for edit mode), piano roll + automation lane touch support, responsive CSS (tablet ≤768px, phone ≤480px), touch dismiss on all popovers, PWA setup (manifest, service worker, meta tags), help overlay touch section |
| 16 | Visual polish & UX: always-visible knob value labels, per-FX color-coded LED indicators with pulse animation, playhead indicator bar on step header, mute scene hover tooltips with instrument names, theme preview cards with color swatches (replaces dropdown), help overlay search/filter |
| 17 | Per-row step length (polyrhythm): each row loops independently (1-16 steps), Ctrl+Scroll on label to set, steps beyond length dimmed. Per-row playheads, automation/piano-roll/euclidean respect row lengths. Touch toolbar state feedback, help search highlighting, mute tooltip live update, tempo-adaptive playhead |
| 18 | Reliability & Accessibility: comprehensive undo/redo (all 17 per-bank data layers), ARIA labels/roles on all interactive elements, keyboard grid navigation (arrow keys + Enter/Space), focus-visible styles, `prefers-reduced-motion` CSS + JS support |
| 19 | Bug Fixes + Testing Foundation: fix redo bug (live state not saved for redo), Vitest setup with 65 tests covering history undo/redo, euclidean algorithm, scale utilities, URL serialization |

### Current Progress (Round 19 — just completed)

Round 19 establishes automated testing and fixes a critical redo bug.

**Bug fixes:**
- **Redo from top broken (P0)**: `History.redo()` returned null after a single undo from the top of the stack. Root cause: "push before mutation" model never saved the post-last-action live state, so redo had no target. Fix: added `undoWithLiveState()` to History — when undoing from the top, appends the current live state to the stack so redo can reach it. `Sequencer.undo()` now calls this instead of plain `undo()`.
- **Bug #2 (cross-bank corruption)**: Was a consequence of the redo issue — resolved.
- **Bug #3 (scale selector desync)**: Already fixed in Round 18 (line 48 of `scale-selector.ts` has the `eventBus.on('scale:changed')` listener).

**Testing foundation:**
- Added Vitest (65 tests, 4 test files, ~130ms runtime)
- `src/state/history.test.ts` — 21 tests: undo/redo correctness, undoWithLiveState, cloning, NaN preservation, MAX_SIZE
- `src/utils/euclidean.test.ts` — 15 tests: Bjorklund's algorithm, rotation, edge cases
- `src/utils/scales.test.ts` — 15 tests: degree↔semitone conversion, round-trips, note naming
- `src/state/url-state.test.ts` — 14 tests: V2/V3/V4 round-trips, edge cases, error handling

**Modified files** (4): `src/state/history.ts`, `src/sequencer/sequencer.ts`, `CLAUDE.md`, `HANDOFF.md`
**New files** (5): `vitest.config.ts`, `src/state/history.test.ts`, `src/utils/euclidean.test.ts`, `src/utils/scales.test.ts`, `src/state/url-state.test.ts`

**Modified files** (13): `src/state/history.ts`, `src/sequencer/sequencer.ts`, `src/ui/grid.ts`, `src/ui/toast.ts`, `src/ui/knob.ts`, `src/ui/help-overlay.ts`, `src/ui/piano-roll.ts`, `src/ui/transport-controls.ts`, `src/visuals/particle-system.ts`, `src/visuals/reactive-background.ts`, `styles/main.css`, `styles/accessibility.css` (NEW)

**Known gaps**:
- Theme card swatches are hardcoded colors per theme — if someone adds a new theme, they must also add `swatches` array
- Toast `role="status"` container is created lazily on first toast — screen readers won't see it until a toast fires
- Test coverage is limited to pure logic modules — no DOM/UI tests yet (would need jsdom)
- No CI integration for tests — `npm test` is not yet in the deploy workflow

### Architecture Overview

- **Event-driven**: Typed `EventMap` pub/sub — components never reference each other directly
- **Audio chain**: Per-row gains/panners → dry bus + per-row reverb/delay sends → master → saturation → EQ → perf FX insert → compressor → analyser → filter → destination
- **Scheduling**: Look-ahead scheduler (25ms tick, 100ms schedule-ahead) using `AudioContext.currentTime`
- **State**: Sequencer holds all grid state. 4 pattern banks (A-D). localStorage auto-save with 500ms debounce. URL hash encoding (backward-compatible V1/V2/V3)
- **UI**: Pure DOM manipulation, no framework. Constructor pattern: `(parent, ...deps) → create DOM, append, wire eventBus`
- **Visuals**: Canvas-based particles, waveform display, reactive background
- **z-index stacking**: toast (2000) > cell-tooltip (1500) > modals/pattern-library (1000) > touch-toolbar (960) > context-menu (950) > FAB (900) > MIDI panel (500)
- **Touch support**: Touch grid painting (tap/drag with `elementFromPoint`), long-press context menu (500ms, >10px cancels), FAB-toggled touch toolbar for cell property editing, piano roll + automation lane touch painting. CSS `touch-action: none` on interactive elements, `@media (pointer: coarse)` for touch-specific styles
- **PWA**: Service worker (cache-first for hashed assets, network-first for HTML), manifest (standalone, landscape), SVG icon. SW registered in main.ts with silent failure
- **Responsive layout**: Tablet (≤768px): hide pitch/mixer/euclidean/piano controls, narrower labels. Phone (≤480px): larger cells, hide header/pattern-chain/mute-scenes
- **Pattern library**: IndexedDB storage for named patterns. Save/load full sequencer + effects state. Import/export as JSON files. 4 factory presets seeded on first run
- **Mute scenes**: 8 scene slots store mute/solo states. Save with Shift+click, recall with click. Persisted in localStorage
- **Pattern queue**: Bank switches during playback are queued and applied at loop boundary (step 0). Immediate switch when stopped. Blinking indicator on queued bank button
- **Metronome**: Independent audio path (bypasses master chain). Sine clicks at 1200Hz (beat 1) / 800Hz (beats 2-4). Toggle with K key
- **MIDI output**: Per-row output config (channel, base note, enable) → scheduler sends MIDI notes alongside audio triggers via `setTimeout`. Global enable toggle (N key). All Notes Off (CC123) on transport stop + `beforeunload`
- **MIDI clock sync**: Send mode: 24ppqn `setInterval` synced to tempo. Receive mode: BPM derived from rolling average of incoming clock tick intervals. Start/Stop messages control transport
- **Automation lanes**: Per-step parameter automation (volume, pan, reverb send, delay send) + filter cutoff display via existing filterLocks. `AutomationData = number[][][]` ([param][row][step], NaN = no lock). Scheduler applies values via `setValueAtTime()`, restores row defaults for non-automated steps. Collapsible UI per row with 5 param buttons + 16 draggable bars
- **Polyrhythm**: `rowLengths: number[][]` per-bank (like rowVolumes). Each row loops independently (1-16 steps) via `rowStep = currentStep % rowLength[row]` in scheduler. Grid renders 16 columns; beyond-length cells dimmed. Per-row playheads, automation/piano-roll/euclidean respect row lengths. Ctrl+Scroll on row label to adjust
- **Accessibility**: ARIA grid pattern (`role="grid"`/`"row"`/`"gridcell"`, `aria-pressed`, `aria-label`). Keyboard grid navigation (arrow keys, Enter/Space, Escape). Focus-visible styles via `styles/accessibility.css`. `prefers-reduced-motion` CSS + JS (particles, reactive background). Toast live region (`aria-live="polite"`). Dialog roles on help/piano-roll overlays. Knob `aria-valuetext`
- **Undo/redo**: History captures all 17 per-bank data layers per entry (~12KB × 50 max = 600KB). `restoreEntry()` in sequencer restores all layers atomically

## What Worked

- **Incremental rounds**: Each round was a cohesive batch of 4-6 related features. Building in rounds kept complexity manageable
- **CLAUDE.md as source of truth**: Detailed architecture docs, key patterns, and gotchas in CLAUDE.md dramatically reduced errors in later rounds
- **Event bus architecture**: Adding features without touching existing code was trivial thanks to decoupled pub/sub
- **Plan-then-implement**: Writing detailed plans before coding (stored in `.claude/plans/`) prevented rework
- **Type checking as verification**: `npx tsc --noEmit` catches most issues; browser preview for the rest
- **DOM elements for cell overlays**: Using child elements (`.grid-cell-ratchet`, `.grid-cell-gate`, etc.) instead of CSS pseudo-elements, since `::before` and `::after` are taken by note display and probability stripes
- **Silent setter pattern**: `setNoteOffsetSilent()` / `setCell()` skip history push for batch drag operations — call `pushHistorySnapshot()` once at drag start. Keeps undo clean
- **Modal pattern for complex editors**: Piano roll uses a full-screen overlay (like help overlay) rather than a positioned popover — gives enough space for 2D grids. `position: fixed; z-index: 1000` with backdrop blur
- **Scale-aware pitch computation**: Piano roll dynamically rebuilds pitch rows when scale changes — chromatic shows 25 rows, non-chromatic shows only in-scale notes. Uses `scaleDegreesToSemitones()` to enumerate valid pitches
- **MIDI as separate module**: `src/midi/` directory with 3 focused files (manager, input, learn) keeps MIDI logic decoupled from audio and UI
- **Toast wired to events**: Toast notifications fire via EventBus events (`grid:cleared`, `bank:copied`, etc.) in `app.ts`, not in individual button handlers — keeps triggers centralized
- **Reflow trick for CSS transitions**: `void el.offsetHeight` before adding visible classes ensures CSS transitions trigger reliably. `requestAnimationFrame` was unreliable in headless/background contexts
- **Singleton pattern for shared UI**: Toast container and cell context menu are singletons — created once, reused across the app. Avoids duplicate DOM elements
- **Popover pattern for context menus**: Cell context menu uses same pattern as euclidean popover (position: fixed, smart viewport edge detection, click-outside-to-close)
- **Dual storage for samples**: IndexedDB for large binary data (ArrayBuffers), localStorage for small metadata (filenames, trim points, flags). Clean separation — IndexedDB restored async, localStorage sync
- **Cached trigger functions**: `SampleEngine.createTrigger()` builds a closure per row, cached in `triggers[]` array. Avoids allocation in scheduler hot path
- **Per-bank vs global state**: Following existing patterns (volume/pan = per-bank, soundParams = global) made the sends/samples state design obvious
- **Effects panel `refresh()` method**: Storing all knob references as class fields and adding getters to effect classes enabled programmatic knob updates on pattern load via `setValueSilent()`
- **Pattern queue at loop boundary**: Integrating queue processing into `scheduler.advanceStep()` at step 0 was cleaner than a separate timer. Queue overrides song mode for one loop, then song mode resumes
- **Factory presets as lazy functions**: Using function references instead of pre-computed data objects avoids shared mutable state between preset instances
- **Step clipboard captures all layers**: 8 data layers × 8 rows per step column — grid, probability, pitchOffset, noteGrid, filterLock, ratchet, condition, gate, slide, rowVolume, rowPan, reverbSend, delaySend, rowSwing. One undo entry per paste
- **Global state pattern for MIDI output**: MIDI output configs follow the same global (not per-bank) pattern as `soundParams`. Physical hardware routing shouldn't change on bank switch — this was immediately obvious from the existing pattern
- **Late binding for circular deps**: `MidiClock` needs Transport (for receive Start/Stop → play/stop) and Transport needs MidiClock (for send mode). Solved with `setTransport()` setter after both are created, avoiding constructor cycle
- **Scheduler helper method for MIDI**: Extracting `scheduleMidiNote()` as a separate method called after each `audioEngine.trigger()` kept the integration clean — no duplication between ratchet and single-hit code paths
- **onstatechange chaining**: MidiOutput needs to hook `access.onstatechange` to update output ports, but MidiManager already uses it for input devices. Wrapping the previous handler preserves both without conflict
- **Automation alongside filterLocks**: Rather than migrating filterLocks into the new automation system (which would risk breaking 12+ files and existing saves), kept filterLocks as-is and added `AutomationData` for 4 new params. The UI displays 5 buttons by mapping filter to existing `getFilterLock()`/`setFilterLock()`. Zero migration risk
- **UI_TO_AUTO_PARAM index mapping**: Using `-1` to mean "use filterLocks" let the automation lane component handle 5 params in a unified way without special-casing in the main render loop
- **`elementFromPoint` for touch drag**: Touch events fire on the original target, not the element under the finger. The `elementAtTouch()` utility uses `document.elementFromPoint()` + `.closest()` to find the cell under the finger during drag — same pattern for grid, piano roll, and automation lane
- **Long-press vs drag conflict resolution**: Start 500ms timer on touchstart, clear if finger moves >10px or touchend fires. When timer fires, set `isDragging = false` to stop any drag paint. Simple, no extra state
- **FAB toggle for touch toolbar**: Rather than changing tap semantics (which would break single-tap toggle), added a floating action button visible only on `pointer: coarse`. Edit mode makes tapping active cells open the toolbar instead of erasing them — separate concern from normal tap behavior
- **CSS-only touch detection**: `@media (pointer: coarse)` for showing FAB and touch help section, `touch-action: none` to prevent browser gestures. No JavaScript feature detection needed for styling
- **Polyrhythm via modulo**: Keeping a single global `currentStep` (0-15) and computing `rowStep = step % rowLength[row]` per row in the scheduler was much simpler than variable-width rows. Grid still renders 16 columns — beyond-length cells are just dimmed CSS
- **Per-bank state checklist**: Following the established 9-step checklist (sequencer → EventMap → localStorage → app.ts → UI) made adding `rowLengths` as per-bank state predictable and error-free
- **Touch toolbar `updateLabels()` after each action**: Calling a single refresh method after every cycle action avoids duplicating display logic per button. Stores `btnEls[]` references from `build()` for O(1) updates
- **`restoreEntry()` centralizes undo/redo**: Single method restores all 17 data layers + emits `grid:cleared`. Both `undo()` and `redo()` call it — no duplication, no forgotten layers
- **Spread clone preserves NaN**: `cloneEntry()` uses spread operator for all arrays (including FilterLockGrid with NaN values). JSON round-trip would convert NaN to null — spread avoids this
- **`e.stopPropagation()` for grid keyboard**: Grid's keyboard handler calls `stopPropagation()` on handled keys, preventing document-level shortcuts (Space=play, A=automation) from conflicting with grid navigation (Space=toggle, ArrowDown=move)
- **CSS + JS reduced motion**: CSS handles DOM animations (`@media (prefers-reduced-motion: reduce)`), JS handles canvas systems (`window.matchMedia` in ParticleSystem and ReactiveBackground). Both listen for live changes so toggling the OS setting works immediately
- **Tests found the real bug**: QA reported "undo off-by-one" but tests showed undo was correct — the real bug was redo returning null after a single undo from the top. Root cause: "push before mutation" model never saves the live state. `undoWithLiveState()` fixes this by appending the live state to the stack when undoing from the top
- **Vitest + node environment**: Pure logic tests (no DOM) with `environment: 'node'` — fast (65 tests in 130ms), no jsdom overhead. Test files colocated as `*.test.ts` next to source

## What Didn't Work / Gotchas

- **Global swing → per-row swing migration**: Required backward compat shim in `loadFullState` and `app.ts` restore logic. Old `sequencer.swing` property kept around just for loading old saves
- **Pseudo-element collisions**: `::before` is used for note display, `::after` for probability stripes. Any new cell overlays must use DOM elements
- **FilterLockGrid NaN/null**: NaN in memory, null in JSON. Easy to forget the conversion
- **Strict TypeScript + Web Audio**: Need `new Float32Array(new ArrayBuffer(n * 4))` and `Uint8Array<ArrayBuffer>` for strict mode compatibility
- **File has not been read yet**: The Edit tool requires reading a file first in the same session. Always `Read` before `Edit`
- **Grid alignment with conditional buttons**: Piano roll ♪ button only shows on melodic rows — non-melodic rows need invisible spacer elements (`.grid-piano-btn--spacer` with `visibility: hidden`) to keep step cells aligned
- **Web MIDI API browser support**: Only available in Chromium browsers over HTTPS or localhost. Firefox doesn't support it. `MidiManager.init()` silently returns false
- **No innerHTML for security**: The security hook blocks `innerHTML` usage. Use `clearChildren()` pattern (while loop with removeChild) or `textContent` instead
- **Cell tooltip shows nothing for defaults**: Active cells with all-default attributes (vel=Loud, prob=100%, ratchet=1x, etc.) intentionally show no tooltip — only non-default attributes are displayed
- **Toast positioning**: Toast container is at `position: fixed; bottom: 2rem` — may not be visible in some preview/screenshot tools that crop the viewport bottom
- **Vite stale errors after new files**: If Vite reports "Failed to resolve import" for a file that exists on disk, restart the dev server — Vite caches transform errors from previous sessions
- **Adding per-bank state is a 9-step checklist**: See CLAUDE.md "Adding per-bank state" gotcha — sequencer, EventMap, local-storage, app.ts wiring, grid.ts UI all need coordinated updates
- **Pattern data NaN/null conversion**: FilterLock grids use NaN in memory but must serialize to null for JSON (IndexedDB and file export). Convert back on load
- **Pattern library excludes samples and mute scenes**: Samples are too large for pattern snapshots. Mute scenes are performance/preference state, not pattern data
- **Step header alignment**: Step header row (1-16) needs spacer elements matching widths of label, pitch, mixer, euclidean, and piano roll button columns to align with grid cells
- **MIDI output unused imports**: `DEFAULT_ROW_BASE_NOTES` is only used in `sequencer.ts` for defaults — the MIDI panel reads from sequencer, so don't import it in UI files
- **MidiOutput needs late init**: Created in `main.ts` but `init(access)` called later in `app.ts` after `MidiManager.init()` resolves async. Don't call `sendNoteOn()` before init
- **Automation vs filterLocks**: These are separate data structures. `AutomationData` holds 4 params (vol=0, pan=1, rev=2, del=3). FilterLocks are the existing `FilterLockGrid`. The automation lane UI maps param button index 2 (Flt) to filterLocks, not automationData. `UI_TO_AUTO_PARAM = [0, 1, -1, 2, 3]` where -1 means use filterLocks API

## Potential Next Directions

These are suggestions, not requirements. Pursue whatever you think would most improve the project:

### Feature Ideas
- ~~**MIDI output**~~: ✅ Done in Round 13 — per-row output config (channel, base note, enable), global toggle (N key)
- ~~**MIDI clock sync**~~: ✅ Done in Round 13 — send/receive 24ppqn, BPM derivation, Start/Stop transport
- ~~**Sample loading**~~: ✅ Done in Round 11
- ~~**Effects per row**~~: ✅ Done in Round 11
- ~~**Pattern library**~~: ✅ Done in Round 12 — save/load/import/export named patterns with factory presets
- ~~**Metronome**~~: ✅ Done in Round 12
- ~~**Automation lanes**~~: ✅ Done in Round 14 — per-step volume/pan/reverb-send/delay-send/filter automation with visual editor
- ~~**Polyrhythm/polymeter**~~: ✅ Done in Round 17 — per-row step length (1-16), independent looping
- **Collaborative mode**: WebRTC or WebSocket-based real-time jam sessions
- **Audio input**: Sidechain from mic/line-in, sampler from live input
- **Piano roll enhancements**: Velocity editing in piano roll, keyboard arrow navigation, row copy/paste
- **Pattern chaining improvements**: Visual timeline editor for song mode, drag-and-drop reorder
- **Undo across patterns**: Global undo that spans bank/pattern switches

### Technical Improvements
- ~~**Testing**~~: ✅ Foundation added in Round 19 — Vitest with 65 tests. Expand to cover: scheduler logic, sequencer state mutations, audio engine (needs Web Audio mocks), DOM/UI tests (needs jsdom)
- ~~**Accessibility**~~: ✅ Done in Round 18 — ARIA grid pattern, keyboard navigation, focus-visible styles, `prefers-reduced-motion`, screen reader support
- ~~**Mobile/touch**~~: ✅ Done in Round 15 — touch grid painting, responsive layout, long-press context menu, touch toolbar
- **Performance**: Profile and optimize hot paths (scheduler, particle system, grid refresh)
- ~~**PWA**~~: ✅ Done in Round 15 — service worker, manifest, installable app
- **Code splitting**: Lazy-load heavy modules (performance FX, wav exporter)

### UX/Visual Polish
- ~~**Onboarding**~~: ✅ Done in Round 16 — interactive step-by-step tour with spotlight overlay
- **More themes**: Community themes, custom theme editor
- ~~**Better mobile layout**~~: ✅ Done in Round 15 — responsive breakpoints, touch targets, hidden controls on small screens
- **Keyboard shortcut customization**: User-configurable keybindings

## Key Files to Start With

| File | Why |
|------|-----|
| `CLAUDE.md` | Full architecture, patterns, and gotchas — read this first |
| `src/main.ts` | Entry point — shows how everything wires together |
| `src/types.ts` | All type definitions and constants |
| `src/sequencer/sequencer.ts` | Central state management |
| `src/audio/scheduler.ts` | Core scheduling loop |
| `src/audio/audio-engine.ts` | Audio routing graph |
| `src/ui/grid.ts` | Main grid UI (largest UI file) |
| `src/ui/cell-context-menu.ts` | Right-click cell context menu — all 8 data layers |
| `src/ui/toast.ts` | Toast notification singleton |
| `src/ui/knob.ts` | Knob component with drag tooltip |
| `src/ui/piano-roll.ts` | Piano roll modal — good example of modal pattern + scale-aware UI |
| `src/audio/sample-engine.ts` | Sample playback engine — per-row AudioBuffer + trigger functions |
| `src/state/sample-storage.ts` | IndexedDB wrapper for sample ArrayBuffer persistence |
| `src/ui/sound-shaper.ts` | Dual synth/sample mode popover — good example of mode-switching UI |
| `src/ui/waveform-preview.ts` | Canvas waveform with draggable trim handles |
| `src/midi/midi-manager.ts` | Web MIDI API access, device detection, message routing |
| `src/audio/metronome.ts` | Metronome click scheduling — independent audio path |
| `src/sequencer/mute-scenes.ts` | 8 mute scene slots — save/recall mute+solo states |
| `src/sequencer/step-clipboard.ts` | Step copy/paste — full vertical slice of all data layers |
| `src/state/pattern-library-storage.ts` | IndexedDB storage for named patterns |
| `src/ui/pattern-library.ts` | Pattern library modal — save/load/import/export UI |
| `src/data/factory-presets.ts` | 4 built-in presets (Four on the Floor, Funky Breaks, Ambient Drift, Techno Minimal) |
| `src/utils/event-bus.ts` | Event system — `EventMap` interface shows all events |
| `src/ui/automation-lane.ts` | Per-row automation lane — 5 param buttons + 16 draggable value bars |
| `src/midi/midi-output.ts` | Web MIDI output port management — sendNoteOn/Off/Clock/Start/Stop |
| `src/midi/midi-clock.ts` | MIDI clock send (24ppqn) and receive (BPM derivation from tick intervals) |
| `src/utils/touch.ts` | Touch utilities — `elementAtTouch()` helper for drag-across touch events |
| `src/ui/touch-toolbar.ts` | Floating toolbar for touch — cell property editing (velocity, probability, ratchet, gate, condition, note, slide) |

## Commands

```
npm run dev        # Start dev server (port 5173)
npm run build      # Type-check + build for production
npx tsc --noEmit   # Type-check only
npm test           # Run Vitest test suite (65 tests)
npm run test:watch # Run tests in watch mode
```
