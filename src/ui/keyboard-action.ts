export type FxName = 'tapestop' | 'stutter' | 'bitcrush' | 'reverbwash';

export const FX_KEY_MAP: Record<string, FxName> = {
  F1: 'tapestop',
  F2: 'stutter',
  F3: 'bitcrush',
  F4: 'reverbwash',
};

export type KeyAction =
  | { type: 'fx-engage'; fx: FxName }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'copy-bank' }
  | { type: 'paste-bank' }
  | { type: 'help' }
  | { type: 'mute-scene-recall'; index: number }
  | { type: 'mute-scene-save'; index: number }
  | { type: 'toggle-play' }
  | { type: 'queue-bank'; index: number }
  | { type: 'clear-bank' }
  | { type: 'randomize' }
  | { type: 'toggle-song-mode' }
  | { type: 'cycle-theme' }
  | { type: 'rotate-left' }
  | { type: 'rotate-right' }
  | { type: 'toggle-midi-learn' }
  | { type: 'toggle-metronome' }
  | { type: 'toggle-pattern-library' }
  | { type: 'toggle-midi-output' }
  | { type: 'toggle-automation' };

const BANK_CODES: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
};

export function resolveKeyAction(
  code: string,
  key: string,
  modKey: boolean,
  shiftKey: boolean,
  altKey: boolean,
): KeyAction | null {
  // Performance FX: F1-F4
  const fx = FX_KEY_MAP[key];
  if (fx) return { type: 'fx-engage', fx };

  // Undo: Ctrl/Cmd+Z
  if (modKey && !shiftKey && code === 'KeyZ') return { type: 'undo' };

  // Redo: Ctrl/Cmd+Shift+Z
  if (modKey && shiftKey && code === 'KeyZ') return { type: 'redo' };

  // Copy bank: Ctrl/Cmd+C
  if (modKey && code === 'KeyC') return { type: 'copy-bank' };

  // Paste bank: Ctrl/Cmd+V
  if (modKey && code === 'KeyV') return { type: 'paste-bank' };

  // Help: ? (Shift+/)
  if (code === 'Slash' && shiftKey) return { type: 'help' };

  // Mute scenes: Alt+1-8
  if (altKey) {
    const digitMatch = code.match(/^Digit([1-8])$/);
    if (digitMatch) {
      const index = parseInt(digitMatch[1]) - 1;
      if (shiftKey) return { type: 'mute-scene-save', index };
      return { type: 'mute-scene-recall', index };
    }
  }

  switch (code) {
    case 'Space': return { type: 'toggle-play' };
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
      return { type: 'queue-bank', index: BANK_CODES[code] };
    case 'KeyC': return { type: 'clear-bank' };
    case 'KeyR': return { type: 'randomize' };
    case 'KeyS': return { type: 'toggle-song-mode' };
    case 'KeyT': return { type: 'cycle-theme' };
    case 'BracketLeft': return { type: 'rotate-left' };
    case 'BracketRight': return { type: 'rotate-right' };
    case 'KeyM': return { type: 'toggle-midi-learn' };
    case 'KeyK': return { type: 'toggle-metronome' };
    case 'KeyP': return { type: 'toggle-pattern-library' };
    case 'KeyN': return { type: 'toggle-midi-output' };
    case 'KeyA': return { type: 'toggle-automation' };
    default: return null;
  }
}
