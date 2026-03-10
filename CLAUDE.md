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
  types.ts                   # Grid = number[][], VelocityLevel, InstrumentTrigger, ProbabilityGrid, NoteGrid, FilterLockGrid
  audio/
    audio-engine.ts          # Audio routing hub: per-row GainNode+StereoPanner → dry/effects → master → perf insert → compressor → analyser → filter → destination
    scheduler.ts             # Look-ahead scheduler (25ms lookahead, 100ms schedule-ahead)
    performance-fx.ts        # Hold-to-engage FX: tape stop, stutter, bitcrush, reverb wash
    wav-exporter.ts          # Offline render to WAV
    instruments/*.ts         # 8 synth instruments (kick, snare, hihat, clap, bass, lead, pad, perc)
    effects/*.ts             # Reverb (ConvolverNode), Delay, Filter (BiquadFilter)
  sequencer/
    sequencer.ts             # Central state: grids, probabilities, pitchOffsets, noteGrids, rowVolumes, rowPans, filterLocks, scale, sidechain, clipboard, history
    transport.ts             # Play/stop/tap tempo
    mute-state.ts            # Per-row mute/solo
    pattern-chain.ts         # Song mode chain (max 32 entries)
  state/
    history.ts               # Undo/redo stack (max 50)
    url-state.ts             # Binary state encoding: V1 (1-bit), V2 (2-bit velocity), V3 (+probability)
    local-storage.ts         # Auto-save/restore via localStorage (debounced 500ms)
  ui/                        # Pure DOM manipulation, no framework. Constructor pattern: (parent, ...deps) → create DOM, append, wire eventBus
    help-overlay.ts          # ? button + overlay showing all controls/shortcuts
    scale-selector.ts        # Root note + scale type dropdowns
    euclidean-popover.ts     # Euclidean rhythm generator popover (hits, rotation, preview, apply)
  visuals/                   # Canvas-based: particles, waveform, reactive background
  utils/
    event-bus.ts             # Typed pub/sub singleton — EventMap interface enforces compile-time safety
    scales.ts                # 7 musical scales (chromatic→mixolydian), degree/semitone conversion
    euclidean.ts             # Bjorklund's Euclidean rhythm algorithm + pattern rotation
styles/
  variables.css              # CSS custom properties (colors, sizing) — themes override these
  help.css                   # Help overlay styles
```

## Key Patterns

- **Event bus**: Typed `EventMap` interface — all `emit()`/`on()` calls get compile-time payload checking. Never direct references between components
- **Look-ahead scheduling**: Scheduler uses `AudioContext.currentTime` with 100ms lookahead for sample-accurate timing
- **Velocity**: Grid cells are `number` (0=off, 1=soft/0.33, 2=medium/0.66, 3=loud/1.0)
- **Pitch offset**: `Math.pow(2, semitones / 12)` multiplier on all oscillator frequencies. Per-step note offset (±12 semitones) is additive with row pitch offset
- **Melodic rows**: Bass (4), Lead (5), Pad (6) support per-step note input via Alt+scroll. Non-melodic rows ignore it
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

## Gotchas

- **TypeScript strict typed arrays**: Use `new Float32Array(new ArrayBuffer(n * 4))` and `Uint8Array<ArrayBuffer>` to satisfy strict mode with Web Audio API
- **Label colors**: Use `var(--color-instrumentname)` CSS vars, not inline hardcoded colors, so themes apply correctly
- **Grid cell events**: Use `mousedown` (not `click`) for drag-paint; `contextmenu` for probability cycling
- **InstrumentConfig.color**: Mutable — updated on theme change for particle system colors
- **History snapshots**: Always include probabilities and noteGrid when pushing to history stack
- **Note display**: CSS `::before` with `content: attr(data-note)` — set `data-note` attribute on cell, delete attribute when note is 0
- **Adding shortcuts**: Update both `keyboard-shortcuts.ts` AND `help-overlay.ts` sections to keep them in sync
- **New CSS files**: Must be `@import`ed in `styles/main.css` or they won't load
- **FilterLockGrid NaN/null**: NaN means "no lock" in memory; must convert NaN→null for JSON serialization and null→NaN on restore
- **Knob `setValueSilent(v)`**: Use for programmatic updates (e.g., bank switch) — avoids triggering onChange callbacks
