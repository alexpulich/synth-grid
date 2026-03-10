# Synth Grid — Handoff

## Goal

Synth Grid is a browser-based visual music step sequencer built with vanilla TypeScript + Vite + Web Audio API (zero runtime dependencies). The project has been developed iteratively over 11 rounds, each adding a cohesive set of features. **You are free to do whatever you think is best to develop this project further** — new features, UX improvements, refactoring, performance optimization, visual polish, accessibility, mobile support, or anything else you see fit.

## Current State

- **71 TypeScript files, 20 CSS files, ~22,000 lines of code**
- **Latest round**: Round 11 — Sample Engine & Per-Row Sends
- **No test suite** — verification has been manual via browser
- **No lint config** — only `npx tsc --noEmit` for type checking
- **Deployment**: Dockerfile + GitHub Actions CI/CD exist

### What's Built (Rounds 1-11)

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

### Architecture Overview

- **Event-driven**: Typed `EventMap` pub/sub — components never reference each other directly
- **Audio chain**: Per-row gains/panners → dry bus + per-row reverb/delay sends → master → saturation → EQ → perf FX insert → compressor → analyser → filter → destination
- **Scheduling**: Look-ahead scheduler (25ms tick, 100ms schedule-ahead) using `AudioContext.currentTime`
- **State**: Sequencer holds all grid state. 4 pattern banks (A-D). localStorage auto-save with 500ms debounce. URL hash encoding (backward-compatible V1/V2/V3)
- **UI**: Pure DOM manipulation, no framework. Constructor pattern: `(parent, ...deps) → create DOM, append, wire eventBus`
- **Visuals**: Canvas-based particles, waveform display, reactive background
- **z-index stacking**: toast (2000) > cell-tooltip (1500) > modals (1000) > context-menu (950) > MIDI panel (500)

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

## Potential Next Directions

These are suggestions, not requirements. Pursue whatever you think would most improve the project:

### Feature Ideas
- **MIDI output**: Send MIDI notes to external synths/DAWs via Web MIDI output ports
- **MIDI clock sync**: Sync to external MIDI clock for hardware integration
- ~~**Sample loading**~~: ✅ Done in Round 11 — drag-and-drop WAV/MP3/OGG/M4A onto row labels, file picker in sound shaper, IndexedDB persistence
- ~~**Effects per row**~~: ✅ Done in Round 11 — per-row reverb/delay sends with R/D mixer knobs
- **Automation lanes**: Per-step automation of any parameter (filter cutoff, volume, pan)
- **Polyrhythm/polymeter**: Different step counts per row (not just 16)
- **Preset sharing**: Import/export full presets as JSON or URL
- **Collaborative mode**: WebRTC or WebSocket-based real-time jam sessions
- **Audio input**: Sidechain from mic/line-in, sampler from live input
- **Piano roll enhancements**: Velocity editing in piano roll, keyboard arrow navigation, row copy/paste

### Technical Improvements
- **Testing**: Add Vitest for unit tests (audio logic, sequencer state, serialization)
- **Accessibility**: Screen reader support, keyboard navigation through grid
- **Mobile/touch**: Touch events for grid painting, responsive layout for small screens
- **Performance**: Profile and optimize hot paths (scheduler, particle system, grid refresh)
- **PWA**: Service worker for offline use, installable app
- **Code splitting**: Lazy-load heavy modules (performance FX, wav exporter)

### UX/Visual Polish
- **Onboarding**: First-time user tutorial or interactive walkthrough
- **More themes**: Community themes, custom theme editor
- **Better mobile layout**: Collapsible panels, touch-optimized controls
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
| `src/midi/midi-manager.ts` | Web MIDI API access, device detection, message routing |
| `src/utils/event-bus.ts` | Event system — `EventMap` interface shows all events |

## Commands

```
npm run dev       # Start dev server (port 5173)
npm run build     # Type-check + build for production
npx tsc --noEmit  # Type-check only
```
