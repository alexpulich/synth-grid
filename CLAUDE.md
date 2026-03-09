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
  types.ts                   # Grid = number[][], VelocityLevel, InstrumentTrigger, ProbabilityGrid
  audio/
    audio-engine.ts          # Audio routing hub: instruments → splitGain → dry/effects → master → perf insert → analyser → filter → destination
    scheduler.ts             # Look-ahead scheduler (25ms lookahead, 100ms schedule-ahead)
    performance-fx.ts        # Hold-to-engage FX: tape stop, stutter, bitcrush, reverb wash
    wav-exporter.ts          # Offline render to WAV
    instruments/*.ts         # 8 synth instruments (kick, snare, hihat, clap, bass, lead, pad, perc)
    effects/*.ts             # Reverb (ConvolverNode), Delay, Filter (BiquadFilter)
  sequencer/
    sequencer.ts             # Central state: grids, probabilities, pitchOffsets, clipboard, history
    transport.ts             # Play/stop/tap tempo
    mute-state.ts            # Per-row mute/solo
    pattern-chain.ts         # Song mode chain (max 32 entries)
  state/
    history.ts               # Undo/redo stack (max 50)
    url-state.ts             # Binary state encoding: V1 (1-bit), V2 (2-bit velocity), V3 (+probability)
  ui/                        # Pure DOM manipulation, no framework
  visuals/                   # Canvas-based: particles, waveform, reactive background
  utils/
    event-bus.ts             # Pub/sub singleton for decoupled components
styles/
  variables.css              # CSS custom properties (colors, sizing) — themes override these
```

## Key Patterns

- **Event bus**: Components communicate via `eventBus.emit()`/`eventBus.on()`, never direct references
- **Look-ahead scheduling**: Scheduler uses `AudioContext.currentTime` with 100ms lookahead for sample-accurate timing
- **Velocity**: Grid cells are `number` (0=off, 1=soft/0.33, 2=medium/0.66, 3=loud/1.0)
- **Pitch offset**: `Math.pow(2, semitones / 12)` multiplier on all oscillator frequencies
- **Theme system**: CSS custom properties on `:root`, 4 themes defined in `theme-switcher.ts`, persisted in localStorage
- **URL state**: Binary serialization (base64url), backward-compatible V1/V2/V3 formats detected by byte length

## Gotchas

- **TypeScript strict typed arrays**: Use `new Float32Array(new ArrayBuffer(n * 4))` and `Uint8Array<ArrayBuffer>` to satisfy strict mode with Web Audio API
- **Label colors**: Use `var(--color-instrumentname)` CSS vars, not inline hardcoded colors, so themes apply correctly
- **Grid cell events**: Use `mousedown` (not `click`) for drag-paint; `contextmenu` for probability cycling
- **InstrumentConfig.color**: Mutable — updated on theme change for particle system colors
- **History snapshots**: Always include probabilities when pushing to history stack
