import type { MuteState } from '../sequencer/mute-state';
import { MuteScenes, NUM_MUTE_SCENES } from '../sequencer/mute-scenes';
import { eventBus } from '../utils/event-bus';
import { showToast } from './toast';

export class MuteScenesUI {
  private buttons: HTMLButtonElement[] = [];
  private activeScene: number | null = null;

  constructor(parent: HTMLElement, private muteScenes: MuteScenes, private muteState: MuteState) {
    const container = document.createElement('div');
    container.className = 'mute-scenes';

    const label = document.createElement('span');
    label.className = 'mute-scenes-label';
    label.textContent = 'Scenes';
    container.appendChild(label);

    for (let i = 0; i < NUM_MUTE_SCENES; i++) {
      const btn = document.createElement('button');
      btn.className = 'mute-scene-btn';
      btn.textContent = String(i + 1);
      btn.title = `Click: recall scene ${i + 1}\nShift+Click: save to scene ${i + 1}`;
      btn.addEventListener('click', (e) => {
        if (e.shiftKey) {
          this.saveToScene(i);
        } else {
          this.recallScene(i);
        }
      });
      container.appendChild(btn);
      this.buttons.push(btn);
    }

    parent.appendChild(container);

    eventBus.on('mute:changed', () => {
      this.activeScene = null;
      this.updateVisuals();
    });
  }

  saveToScene(index: number): void {
    const state = this.muteState.getState();
    this.muteScenes.saveScene(index, state);
    eventBus.emit('mutescene:saved', index);
    showToast(`Mute scene ${index + 1} saved`, 'success');
    this.updateVisuals();
  }

  recallScene(index: number): void {
    const scene = this.muteScenes.recallScene(index);
    if (!scene) {
      showToast(`Scene ${index + 1} is empty`, 'warning');
      return;
    }
    this.muteState.loadState(scene);
    this.activeScene = index;
    eventBus.emit('mutescene:recalled', index);
    showToast(`Scene ${index + 1} recalled`);
    this.updateVisuals();
  }

  private updateVisuals(): void {
    for (let i = 0; i < NUM_MUTE_SCENES; i++) {
      const btn = this.buttons[i];
      btn.classList.toggle('mute-scene-btn--filled', this.muteScenes.hasScene(i));
      btn.classList.toggle('mute-scene-btn--active', this.activeScene === i);
    }
  }
}
