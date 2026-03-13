import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { eventBus } from '../utils/event-bus';

vi.mock('../audio/instruments', () => ({
  INSTRUMENTS: [
    { name: 'Kick', color: '#ff3366' },
    { name: 'Snare', color: '#ff6633' },
    { name: 'HiHat', color: '#ffcc00' },
    { name: 'Clap', color: '#33ff66' },
    { name: 'Bass', color: '#00ccff' },
    { name: 'Lead', color: '#6633ff' },
    { name: 'Pad', color: '#ff33cc' },
    { name: 'Perc', color: '#33ccff' },
  ],
}));

import { wireVisuals } from './visual-wiring';

function makeGrid(rows: number, steps: number, fill = 0): number[][] {
  return Array.from({ length: rows }, () => Array(steps).fill(fill));
}

describe('wireVisuals', () => {
  const gridUI = {
    getCellRect: vi.fn(() => ({ left: 100, top: 50, width: 40, height: 30 })),
    clearPlayhead: vi.fn(),
  };
  const particles = { burst: vi.fn() };
  const visualizer = { wake: vi.fn() };
  const sequencer = {
    getCurrentGrid: vi.fn(() => makeGrid(8, 16)),
    getCurrentRowLengths: vi.fn(() => new Array(8).fill(16)),
    muteState: { isRowAudible: vi.fn(() => true) },
  };

  beforeAll(() => {
    wireVisuals(
      gridUI as never,
      particles as never,
      visualizer as never,
      sequencer as never,
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
    sequencer.getCurrentGrid.mockReturnValue(makeGrid(8, 16));
    sequencer.getCurrentRowLengths.mockReturnValue(new Array(8).fill(16));
    sequencer.muteState.isRowAudible.mockReturnValue(true);
  });

  it('step:advance calls particles.burst for active audible cells', () => {
    const grid = makeGrid(8, 16);
    grid[0][3] = 2; // active cell at row 0, step 3
    grid[2][3] = 1; // active cell at row 2, step 3
    sequencer.getCurrentGrid.mockReturnValue(grid);

    eventBus.emit('step:advance', 3);

    expect(particles.burst).toHaveBeenCalledTimes(2);
  });

  it('step:advance skips muted rows', () => {
    const grid = makeGrid(8, 16);
    grid[0][0] = 3;
    grid[1][0] = 3;
    sequencer.getCurrentGrid.mockReturnValue(grid);
    sequencer.muteState.isRowAudible.mockImplementation(((row: number) => row !== 1) as () => boolean);

    eventBus.emit('step:advance', 0);

    expect(particles.burst).toHaveBeenCalledTimes(1);
  });

  it('step:advance skips cells with velocity 0', () => {
    const grid = makeGrid(8, 16); // all zeros
    sequencer.getCurrentGrid.mockReturnValue(grid);

    eventBus.emit('step:advance', 0);

    expect(particles.burst).not.toHaveBeenCalled();
  });

  it('step:advance uses polyrhythm: step % rowLength', () => {
    const grid = makeGrid(8, 16);
    grid[0][1] = 2; // step 1 active
    grid[0][5] = 0; // step 5 inactive
    sequencer.getCurrentGrid.mockReturnValue(grid);
    sequencer.getCurrentRowLengths.mockReturnValue([4, 16, 16, 16, 16, 16, 16, 16]);

    // step 5 % rowLength 4 = 1 → should hit grid[0][1] which is active
    eventBus.emit('step:advance', 5);

    expect(particles.burst).toHaveBeenCalledTimes(1);
  });

  it('step:advance passes center of getCellRect and instrument color', () => {
    const grid = makeGrid(8, 16);
    grid[0][2] = 1;
    sequencer.getCurrentGrid.mockReturnValue(grid);
    gridUI.getCellRect.mockReturnValue({ left: 100, top: 50, width: 40, height: 30 });

    eventBus.emit('step:advance', 2);

    expect(gridUI.getCellRect).toHaveBeenCalledWith(0, 2);
    expect(particles.burst).toHaveBeenCalledWith(120, 65, '#ff3366');
  });

  it('transport:play calls visualizer.wake()', () => {
    eventBus.emit('transport:play');
    expect(visualizer.wake).toHaveBeenCalledTimes(1);
  });

  it('transport:stop calls gridUI.clearPlayhead()', () => {
    eventBus.emit('transport:stop');
    expect(gridUI.clearPlayhead).toHaveBeenCalledTimes(1);
  });

  it('step:advance defaults to rowLength 16 when undefined', () => {
    const grid = makeGrid(8, 16);
    grid[0][3] = 1;
    sequencer.getCurrentGrid.mockReturnValue(grid);
    sequencer.getCurrentRowLengths.mockReturnValue([undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]);

    // step 19 % 16 = 3 → should hit grid[0][3]
    eventBus.emit('step:advance', 19);

    expect(particles.burst).toHaveBeenCalledTimes(1);
  });
});
