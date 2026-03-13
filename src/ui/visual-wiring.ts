import type { GridUI } from './grid';
import type { ParticleSystem } from '../visuals/particle-system';
import type { WaveformVisualizer } from '../visuals/waveform-visualizer';
import type { Sequencer } from '../sequencer/sequencer';
import { INSTRUMENTS } from '../audio/instruments';
import { eventBus } from '../utils/event-bus';
import { NUM_ROWS } from '../types';

export function wireVisuals(
  gridUI: GridUI,
  particles: ParticleSystem,
  visualizer: WaveformVisualizer,
  sequencer: Sequencer,
): void {
  // Wire particle bursts to cell triggers (per-row step for polyrhythm)
  eventBus.on('step:advance', (step) => {
    const grid = sequencer.getCurrentGrid();
    const rowLengths = sequencer.getCurrentRowLengths();
    for (let row = 0; row < NUM_ROWS; row++) {
      const rowLen = rowLengths[row] ?? 16;
      const rowStep = step % rowLen;
      if (grid[row][rowStep] > 0 && sequencer.muteState.isRowAudible(row)) {
        const rect = gridUI.getCellRect(row, rowStep);
        particles.burst(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          INSTRUMENTS[row].color,
        );
      }
    }
  });

  // Wake visualizer on play
  eventBus.on('transport:play', () => {
    visualizer.wake();
  });

  // Wire transport stop to clear playhead
  eventBus.on('transport:stop', () => {
    gridUI.clearPlayhead();
  });
}
