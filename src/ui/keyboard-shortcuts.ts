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
import { showToast } from './toast';
import { resolveKeyAction, FX_KEY_MAP } from './keyboard-action';

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
    private readonly onToggleAutomation?: () => void,
  ) {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    const modKey = e.metaKey || e.ctrlKey;
    const action = resolveKeyAction(e.code, e.key, modKey, e.shiftKey, e.altKey);
    if (!action) return;

    switch (action.type) {
      case 'fx-engage':
        if (this.performanceFX) {
          e.preventDefault();
          this.performanceFX.engage(action.fx);
        }
        break;
      case 'undo':
        e.preventDefault();
        this.sequencer.undo();
        break;
      case 'redo':
        e.preventDefault();
        this.sequencer.redo();
        break;
      case 'copy-bank':
        e.preventDefault();
        this.sequencer.copyBank();
        break;
      case 'paste-bank':
        e.preventDefault();
        this.sequencer.pasteBank();
        break;
      case 'help':
        if (this.helpOverlay) {
          e.preventDefault();
          this.helpOverlay.toggle();
        }
        break;
      case 'mute-scene-recall':
        if (this.muteScenes && this.muteScenesUI) {
          e.preventDefault();
          this.muteScenesUI.recallScene(action.index);
        }
        break;
      case 'mute-scene-save':
        if (this.muteScenes && this.muteScenesUI) {
          e.preventDefault();
          this.muteScenesUI.saveToScene(action.index);
        }
        break;
      case 'toggle-play':
        e.preventDefault();
        this.transport.toggle();
        break;
      case 'queue-bank':
        this.sequencer.queueBank(action.index);
        break;
      case 'clear-bank':
        this.sequencer.clearCurrentBank();
        break;
      case 'randomize':
        if (this.onRandomize) this.onRandomize();
        break;
      case 'toggle-song-mode':
        this.sequencer.patternChain.toggleSongMode();
        break;
      case 'cycle-theme':
        if (this.themeSwitcher) this.themeSwitcher.cycle();
        break;
      case 'rotate-left':
        this.sequencer.rotateLeft();
        break;
      case 'rotate-right':
        this.sequencer.rotateRight();
        break;
      case 'toggle-midi-learn':
        if (this.midiLearn) {
          if (this.midiLearn.armed) this.midiLearn.cancelLearn();
          else this.midiLearn.armLearn();
        }
        break;
      case 'toggle-metronome':
        if (this.metronomeUI) this.metronomeUI.toggle();
        break;
      case 'toggle-pattern-library':
        if (this.patternLibrary) this.patternLibrary.toggle();
        break;
      case 'toggle-midi-output':
        this.sequencer.midiOutputGlobalEnabled = !this.sequencer.midiOutputGlobalEnabled;
        showToast(this.sequencer.midiOutputGlobalEnabled ? 'MIDI output enabled' : 'MIDI output disabled');
        break;
      case 'toggle-automation':
        if (this.onToggleAutomation) this.onToggleAutomation();
        break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const fx = FX_KEY_MAP[e.key];
    if (fx && this.performanceFX) {
      this.performanceFX.disengage(fx);
    }
  };
}
