import { describe, it, expect } from 'vitest';
import { deriveSwatches } from './theme-utils';

describe('deriveSwatches', () => {
  it('empty vars returns CSS defaults', () => {
    expect(deriveSwatches({})).toEqual(['#0a0a0f', '#ff3366', '#6633ff', '#ffcc00']);
  });

  it('full var override returns overridden values', () => {
    const vars = {
      '--color-bg': '#111',
      '--color-kick': '#222',
      '--color-lead': '#333',
      '--color-hihat': '#444',
    };
    expect(deriveSwatches(vars)).toEqual(['#111', '#222', '#333', '#444']);
  });

  it('partial override: only some keys overridden', () => {
    const vars = { '--color-bg': '#1a0a14', '--color-kick': '#ff4444' };
    expect(deriveSwatches(vars)).toEqual(['#1a0a14', '#ff4444', '#6633ff', '#ffcc00']);
  });

  it('Sunset theme vars produce correct swatches', () => {
    const vars = {
      '--color-bg': '#1a0a14',
      '--color-kick': '#ff4444',
      '--color-lead': '#ff5577',
      '--color-hihat': '#ffaa22',
    };
    expect(deriveSwatches(vars)).toEqual(['#1a0a14', '#ff4444', '#ff5577', '#ffaa22']);
  });

  it('Deep Ocean theme vars produce correct swatches', () => {
    const vars = {
      '--color-bg': '#050a14',
      '--color-kick': '#2288cc',
      '--color-lead': '#3399ee',
      '--color-hihat': '#44ccaa',
    };
    expect(deriveSwatches(vars)).toEqual(['#050a14', '#2288cc', '#3399ee', '#44ccaa']);
  });

  it('Phantom theme vars produce correct swatches', () => {
    const vars = {
      '--color-bg': '#0c0c0c',
      '--color-kick': '#ffffff',
      '--color-lead': '#bbbbbb',
      '--color-hihat': '#aaaaaa',
    };
    expect(deriveSwatches(vars)).toEqual(['#0c0c0c', '#ffffff', '#bbbbbb', '#aaaaaa']);
  });

  it('returns exactly 4 elements', () => {
    expect(deriveSwatches({})).toHaveLength(4);
    expect(deriveSwatches({ '--color-bg': '#000' })).toHaveLength(4);
  });

  it('extra var keys are ignored', () => {
    const vars = {
      '--color-bg': '#111',
      '--color-kick': '#222',
      '--color-lead': '#333',
      '--color-hihat': '#444',
      '--color-snare': '#555',
      '--cell-inactive': '#666',
    };
    expect(deriveSwatches(vars)).toEqual(['#111', '#222', '#333', '#444']);
  });
});
