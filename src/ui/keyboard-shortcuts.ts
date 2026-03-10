import type { Transport } from '../sequencer/transport';
import type { Sequencer } from '../sequencer/sequencer';
import type { ThemeSwitcher } from './theme-switcher';
import type { PerformanceFX } from '../audio/performance-fx';
import type { HelpOverlay } from './help-overlay';
import type { MidiLearn } from '../midi/midi-learn';
import type { MetronomeUI } from './metronome-ui';
import type { PatternLibrary } from './pattern-library';
import type { MuteScenes } from '../sequencer/mute-scenes';
import type { MuteScenesUI } from './mute-scenes-ui';

type FxName = 'tapestop' | 'stutter' | 'bitcrush' | 'reverbwash';

const FX_KEY_MAP: Record<string, FxName> = {
  F1: 'tapestop',
  F2: 'stutter',
  F3: 'bitcrush',
  F4: 'reverbwash',
};

export class KeyboardShortcuts {
  constructor(
    private transport: Transport,
    private sequencer: Sequencer,
    private onRandomize?: () => void,
    private themeSwitcher?: ThemeSwitcher,
    private performanceFX?: PerformanceFX,
    private helpOverlay?: HelpOverlay,
    private midiLearn?: MidiLearn,
    private readonly metronomeUI?: MetronomeUI,
    private readonly patternLibrary?: PatternLibrary,
    private readonly muteScenes?: MuteScenes,
    private readonly muteScenesUI?: MuteScenesUI,
  ) {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    // Performance FX: F1-F4 engage on keydown
    const fx = FX_KEY_MAP[e.key];
    if (fx && this.performanceFX) {
      e.preventDefault();
      this.performanceFX.engage(fx);
      return;
    }

    const modKey = e.metaKey || e.ctrlKey;

    // Undo: Ctrl/Cmd+Z
    if (modKey && !e.shiftKey && e.code === 'KeyZ') {
      e.preventDefault();
      this.sequencer.undo();
      return;
    }

    // Redo: Ctrl/Cmd+Shift+Z
    if (modKey && e.shiftKey && e.code === 'KeyZ') {
      e.preventDefault();
      this.sequencer.redo();
      return;
    }

    // Copy bank: Ctrl/Cmd+C
    if (modKey && e.code === 'KeyC') {
      e.preventDefault();
      this.sequencer.copyBank();
      return;
    }

    // Paste bank: Ctrl/Cmd+V
    if (modKey && e.code === 'KeyV') {
      e.preventDefault();
      this.sequencer.pasteBank();
      return;
    }

    // Help: ? (Shift+/)
    if (e.code === 'Slash' && e.shiftKey && this.helpOverlay) {
      e.preventDefault();
      this.helpOverlay.toggle();
      return;
    }

    // Mute scenes: Alt+1-8 recall, Shift+Alt+1-8 save
    if (e.altKey && this.muteScenes && this.muteScenesUI) {
      const digitMatch = e.code.match(/^Digit([1-8])$/);
      if (digitMatch) {
        e.preventDefault();
        const sceneIndex = parseInt(digitMatch[1]) - 1;
        if (e.shiftKey) {
          this.muteScenesUI.saveToScene(sceneIndex);
        } else {
          this.muteScenesUI.recallScene(sceneIndex);
        }
        return;
      }
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.transport.toggle();
        break;
      case 'Digit1': this.sequencer.queueBank(0); break;
      case 'Digit2': this.sequencer.queueBank(1); break;
      case 'Digit3': this.sequencer.queueBank(2); break;
      case 'Digit4': this.sequencer.queueBank(3); break;
      case 'KeyC':
        this.sequencer.clearCurrentBank();
        break;
      case 'KeyR':
        if (this.onRandomize) this.onRandomize();
        break;
      case 'KeyS':
        this.sequencer.patternChain.toggleSongMode();
        break;
      case 'KeyT':
        if (this.themeSwitcher) this.themeSwitcher.cycle();
        break;
      case 'BracketLeft':
        this.sequencer.rotateLeft();
        break;
      case 'BracketRight':
        this.sequencer.rotateRight();
        break;
      case 'KeyM':
        if (this.midiLearn) {
          if (this.midiLearn.armed) this.midiLearn.cancelLearn();
          else this.midiLearn.armLearn();
        }
        break;
      case 'KeyK':
        if (this.metronomeUI) this.metronomeUI.toggle();
        break;
      case 'KeyP':
        if (this.patternLibrary) this.patternLibrary.toggle();
        break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    // Performance FX: disengage on keyup
    const fx = FX_KEY_MAP[e.key];
    if (fx && this.performanceFX) {
      this.performanceFX.disengage(fx);
    }
  };
}
