# Synth Grid

A browser-based visual music step sequencer. Paint beats on an 8x16 grid — each row is a synthesized instrument, each column is a 16th note. Hit play and watch your pattern come to life with glowing cells, particle effects, and music made entirely from Web Audio API oscillators.

**Zero samples. Zero runtime dependencies. Pure synthesis.**

![Synth Grid Screenshot](assets/screenshot.jpeg)

## About This Project

This project was conceived and built entirely by [Claude](https://claude.ai) (Anthropic's AI assistant, model Claude Opus 4.6). Given complete creative freedom and an empty directory, Claude chose to build a visual music sequencer, designed the full architecture, and wrote every line of code from scratch — including all audio synthesis, the scheduling engine, UI components, and visual effects.

The human's only input was: *"You are the creative creator. You are free to build whatever you want. Do it."*

## Features

- **8 synthesized instruments** — Kick, Snare, Hi-Hat, Clap, Bass, Lead, Pad, Perc — all generated from scratch using oscillators, noise buffers, filters, and envelopes
- **Sample-accurate scheduling** — look-ahead scheduler pattern using `AudioContext.currentTime` for glitch-free playback
- **4 pattern banks** (A/B/C/D) — store different beat patterns and switch between them
- **Effects chain** — Reverb (convolver), Delay (feedback with lowpass), Filter (LP/HP/BP) with rotary knob controls
- **Tempo & Swing** — adjustable BPM (30-300) with tap tempo and swing control for groove
- **Visual feedback** — playhead column highlight, cell glow animations on trigger, canvas particle bursts
- **Dark neon aesthetic** — each instrument has its own color, cells glow when active

## How It Works

### Audio Engine
Each instrument is a pure function that creates disposable Web Audio API nodes on every trigger:
- **Kick**: Sine oscillator with pitch sweep 150 → 30 Hz
- **Snare**: White noise through bandpass filter + triangle oscillator body
- **Hi-Hat**: 6 detuned square waves at inharmonic ratios, highpass filtered
- **Bass**: Sawtooth through resonant lowpass with filter sweep
- **Lead**: Two detuned sawtooths with ADSR envelope
- **Pad**: Four detuned sine oscillators with slow attack

### Scheduler
Based on Chris Wilson's "A Tale of Two Clocks" pattern — a `setTimeout` loop running every ~25ms schedules notes within a 100ms look-ahead window using `AudioContext.currentTime` for sub-millisecond precision.

## Tech Stack

- **TypeScript** — vanilla, no frameworks
- **Vite** — build tool (the only dependency)
- **Web Audio API** — all sound synthesis and effects
- **Canvas API** — particle effects overlay
- **CSS** — custom properties for theming, keyframe animations

## Getting Started

```bash
git clone https://github.com/alexpulich/synth-grid.git
cd synth-grid
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Click cells to toggle them, hit play, and make music.

## Controls

| Control | Action |
|---------|--------|
| Grid cells | Click to toggle on/off |
| Play/Stop | Start or stop the sequencer |
| Tempo knob | Drag up/down to change BPM (30-300) |
| Swing knob | Add groove feel (0 = straight, max = heavy swing) |
| TAP button | Tap rhythmically to set tempo |
| A/B/C/D | Switch between 4 pattern banks |
| Clear | Erase the current pattern bank |
| Effect knobs | Drag up/down to adjust reverb, delay, and filter |
| LP/HP/BP | Switch filter type |

## License

MIT
