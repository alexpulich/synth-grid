import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoSave } from './local-storage';

describe('AutoSave.load', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it('returns null when localStorage is empty', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    expect(AutoSave.load()).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not json{{{');
    expect(AutoSave.load()).toBeNull();
  });

  it('returns null when grids is missing', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify({ tempo: 120, swing: 0, activeBank: 0 }),
    );
    expect(AutoSave.load()).toBeNull();
  });

  it('returns null when grids is not an array', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify({ grids: 'not-array', tempo: 120, swing: 0, activeBank: 0 }),
    );
    expect(AutoSave.load()).toBeNull();
  });

  it('returns full state when valid', () => {
    const state = {
      grids: [[[0, 1, 2]]],
      probabilities: [[[100]]],
      pitchOffsets: [[0]],
      tempo: 130,
      swing: 0.5,
      activeBank: 1,
    };
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(state));
    const result = AutoSave.load();
    expect(result).not.toBeNull();
    expect(result!.tempo).toBe(130);
    expect(result!.activeBank).toBe(1);
    expect(result!.grids[0][0]).toEqual([0, 1, 2]);
  });

  it('handles missing optional fields gracefully', () => {
    const state = {
      grids: [[[0]]],
      probabilities: [[[100]]],
      pitchOffsets: [[0]],
      tempo: 120,
      swing: 0,
      activeBank: 0,
    };
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(state));
    const result = AutoSave.load();
    expect(result).not.toBeNull();
    expect(result!.noteGrids).toBeUndefined();
    expect(result!.filterLocks).toBeUndefined();
    expect(result!.soundParams).toBeUndefined();
    expect(result!.automationData).toBeUndefined();
  });

  it('returns null when getItem throws', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(AutoSave.load()).toBeNull();
  });
});

describe('AutoSave NaN serialization contract', () => {
  it('NaN values become null in filterLocks serialization', () => {
    const filterLocks = [[[NaN, 5, NaN]]];
    const serialized = filterLocks.map(bank =>
      bank.map(row => row.map(v => isNaN(v) ? null : v)),
    );
    const json = JSON.stringify(serialized);
    expect(json).toBe('[[[null,5,null]]]');
  });

  it('NaN values become null in automationData serialization', () => {
    const automationData = [[[[NaN, 0.5, NaN]]]];
    const serialized = automationData.map(bank =>
      bank.map(param =>
        param.map(row => row.map(v => isNaN(v) ? null : v)),
      ),
    );
    const json = JSON.stringify(serialized);
    expect(json).toBe('[[[[null,0.5,null]]]]');
  });

  it('JSON.stringify converts NaN to null natively', () => {
    expect(JSON.stringify(NaN)).toBe('null');
    expect(JSON.stringify([NaN, 1, NaN])).toBe('[null,1,null]');
  });
});
