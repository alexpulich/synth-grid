# Synth Grid — Handoff

## Goal

Synth Grid is a browser-based visual music step sequencer built with vanilla TypeScript + Vite + Web Audio API (zero runtime dependencies). The project has been developed iteratively over 7 rounds, each adding a cohesive set of features. **You are free to do whatever you think is best to develop this project further** — new features, UX improvements, refactoring, performance optimization, visual polish, accessibility, mobile support, or anything else you see fit.

## Current State

- **56 TypeScript files, 15 CSS files, ~18,500 lines of code**
- **Latest commit**: `1f5ca78` — Round 7 complete
- **No test suite** — verification has been manual via browser
- **No lint config** — only `npx tsc --noEmit` for type checking
- **Deployment**: Dockerfile + GitHub Actions CI/CD exist

### What's Built (Rounds 1-7)

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

### Architecture Overview

- **Event-driven**: Typed `EventMap` pub/sub — components never reference each other directly
- **Audio chain**: Per-row gains/panners → dry/effects buses → master → saturation → EQ → perf FX insert → compressor → analyser → filter → destination
- **Scheduling**: Look-ahead scheduler (25ms tick, 100ms schedule-ahead) using `AudioContext.currentTime`
- **State**: Sequencer holds all grid state. 4 pattern banks (A-D). localStorage auto-save with 500ms debounce. URL hash encoding (backward-compatible V1/V2/V3)
- **UI**: Pure DOM manipulation, no framework. Constructor pattern: `(parent, ...deps) → create DOM, append, wire eventBus`
- **Visuals**: Canvas-based particles, waveform display, reactive background

## What Worked

- **Incremental rounds**: Each round was a cohesive batch of 4-6 related features. Building in rounds kept complexity manageable
- **CLAUDE.md as source of truth**: Detailed architecture docs, key patterns, and gotchas in CLAUDE.md dramatically reduced errors in later rounds
- **Event bus architecture**: Adding features without touching existing code was trivial thanks to decoupled pub/sub
- **Plan-then-implement**: Writing detailed plans before coding (stored in `.claude/plans/`) prevented rework
- **Type checking as verification**: `npx tsc --noEmit` catches most issues; browser preview for the rest
- **DOM elements for cell overlays**: Using child elements (`.grid-cell-ratchet`, `.grid-cell-gate`, etc.) instead of CSS pseudo-elements, since `::before` and `::after` are taken by note display and probability stripes

## What Didn't Work / Gotchas

- **Global swing → per-row swing migration**: Required backward compat shim in `loadFullState` and `app.ts` restore logic. Old `sequencer.swing` property kept around just for loading old saves
- **Pseudo-element collisions**: `::before` is used for note display, `::after` for probability stripes. Any new cell overlays must use DOM elements
- **FilterLockGrid NaN/null**: NaN in memory, null in JSON. Easy to forget the conversion
- **Strict TypeScript + Web Audio**: Need `new Float32Array(new ArrayBuffer(n * 4))` and `Uint8Array<ArrayBuffer>` for strict mode compatibility
- **File has not been read yet**: The Edit tool requires reading a file first in the same session. Always `Read` before `Edit`

## Potential Next Directions

These are suggestions, not requirements. Pursue whatever you think would most improve the project:

### Feature Ideas
- **MIDI support**: MIDI clock sync, MIDI note output, MIDI controller mapping
- **Sample loading**: User-uploaded WAV/MP3 samples replacing or layering with synth instruments
- **Effects per row**: Individual delay/reverb/filter sends per instrument (currently master-only)
- **Automation lanes**: Per-step automation of any parameter (filter cutoff, volume, pan)
- **Polyrhythm/polymeter**: Different step counts per row (not just 16)
- **Piano roll view**: Alternative note entry for melodic rows
- **Preset sharing**: Import/export full presets as JSON or URL
- **Collaborative mode**: WebRTC or WebSocket-based real-time jam sessions
- **Audio input**: Sidechain from mic/line-in, sampler from live input

### Technical Improvements
- **Testing**: Add Vitest for unit tests (audio logic, sequencer state, serialization)
- **Accessibility**: Screen reader support, keyboard navigation through grid
- **Mobile/touch**: Touch events for grid painting, responsive layout for small screens
- **Performance**: Profile and optimize hot paths (scheduler, particle system, grid refresh)
- **PWA**: Service worker for offline use, installable app
- **Code splitting**: Lazy-load heavy modules (performance FX, wav exporter)

### UX/Visual Polish
- **Onboarding**: First-time user tutorial or interactive walkthrough
- **Animations**: Smoother transitions, micro-interactions
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
| `src/utils/event-bus.ts` | Event system — `EventMap` interface shows all events |

## Commands

```
npm run dev       # Start dev server (port 5173)
npm run build     # Type-check + build for production
npx tsc --noEmit  # Type-check only
```
