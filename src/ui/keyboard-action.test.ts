import { describe, it, expect } from 'vitest';
import { resolveKeyAction } from './keyboard-action';

describe('resolveKeyAction', () => {
  it('F1-F4 → fx-engage actions', () => {
    expect(resolveKeyAction('F1', 'F1', false, false, false)).toEqual({ type: 'fx-engage', fx: 'tapestop' });
    expect(resolveKeyAction('F2', 'F2', false, false, false)).toEqual({ type: 'fx-engage', fx: 'stutter' });
    expect(resolveKeyAction('F3', 'F3', false, false, false)).toEqual({ type: 'fx-engage', fx: 'bitcrush' });
    expect(resolveKeyAction('F4', 'F4', false, false, false)).toEqual({ type: 'fx-engage', fx: 'reverbwash' });
  });

  it('Ctrl+Z → undo', () => {
    expect(resolveKeyAction('KeyZ', 'z', true, false, false)).toEqual({ type: 'undo' });
  });

  it('Ctrl+Shift+Z → redo', () => {
    expect(resolveKeyAction('KeyZ', 'Z', true, true, false)).toEqual({ type: 'redo' });
  });

  it('Ctrl+C → copy-bank', () => {
    expect(resolveKeyAction('KeyC', 'c', true, false, false)).toEqual({ type: 'copy-bank' });
  });

  it('Ctrl+V → paste-bank', () => {
    expect(resolveKeyAction('KeyV', 'v', true, false, false)).toEqual({ type: 'paste-bank' });
  });

  it('Shift+Slash → help', () => {
    expect(resolveKeyAction('Slash', '?', false, true, false)).toEqual({ type: 'help' });
  });

  it('Alt+Digit1 → mute-scene-recall index 0', () => {
    expect(resolveKeyAction('Digit1', '1', false, false, true)).toEqual({ type: 'mute-scene-recall', index: 0 });
  });

  it('Alt+Digit8 → mute-scene-recall index 7', () => {
    expect(resolveKeyAction('Digit8', '8', false, false, true)).toEqual({ type: 'mute-scene-recall', index: 7 });
  });

  it('Shift+Alt+Digit3 → mute-scene-save index 2', () => {
    expect(resolveKeyAction('Digit3', '3', false, true, true)).toEqual({ type: 'mute-scene-save', index: 2 });
  });

  it('Space → toggle-play', () => {
    expect(resolveKeyAction('Space', ' ', false, false, false)).toEqual({ type: 'toggle-play' });
  });

  it('Digit1-4 → queue-bank with correct index', () => {
    expect(resolveKeyAction('Digit1', '1', false, false, false)).toEqual({ type: 'queue-bank', index: 0 });
    expect(resolveKeyAction('Digit2', '2', false, false, false)).toEqual({ type: 'queue-bank', index: 1 });
    expect(resolveKeyAction('Digit3', '3', false, false, false)).toEqual({ type: 'queue-bank', index: 2 });
    expect(resolveKeyAction('Digit4', '4', false, false, false)).toEqual({ type: 'queue-bank', index: 3 });
  });

  it('KeyC (no mod) → clear-bank', () => {
    expect(resolveKeyAction('KeyC', 'c', false, false, false)).toEqual({ type: 'clear-bank' });
  });

  it('KeyR → randomize', () => {
    expect(resolveKeyAction('KeyR', 'r', false, false, false)).toEqual({ type: 'randomize' });
  });

  it('KeyS → toggle-song-mode', () => {
    expect(resolveKeyAction('KeyS', 's', false, false, false)).toEqual({ type: 'toggle-song-mode' });
  });

  it('KeyT → cycle-theme', () => {
    expect(resolveKeyAction('KeyT', 't', false, false, false)).toEqual({ type: 'cycle-theme' });
  });

  it('BracketLeft/Right → rotate actions', () => {
    expect(resolveKeyAction('BracketLeft', '[', false, false, false)).toEqual({ type: 'rotate-left' });
    expect(resolveKeyAction('BracketRight', ']', false, false, false)).toEqual({ type: 'rotate-right' });
  });

  it('KeyM → toggle-midi-learn', () => {
    expect(resolveKeyAction('KeyM', 'm', false, false, false)).toEqual({ type: 'toggle-midi-learn' });
  });

  it('KeyK → toggle-metronome', () => {
    expect(resolveKeyAction('KeyK', 'k', false, false, false)).toEqual({ type: 'toggle-metronome' });
  });

  it('KeyP → toggle-pattern-library', () => {
    expect(resolveKeyAction('KeyP', 'p', false, false, false)).toEqual({ type: 'toggle-pattern-library' });
  });

  it('unknown key → null', () => {
    expect(resolveKeyAction('KeyQ', 'q', false, false, false)).toBeNull();
    expect(resolveKeyAction('F5', 'F5', false, false, false)).toBeNull();
    expect(resolveKeyAction('Escape', 'Escape', false, false, false)).toBeNull();
  });
});
