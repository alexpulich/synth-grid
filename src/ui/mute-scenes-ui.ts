import type { MuteState } from '../sequencer/mute-state';
import { MuteScenes, NUM_MUTE_SCENES } from '../sequencer/mute-scenes';
import { INSTRUMENTS } from '../audio/instruments';
import { eventBus } from '../utils/event-bus';
import { showToast } from './toast';

export class MuteScenesUI {
  private buttons: HTMLButtonElement[] = [];
  private activeScene: number | null = null;
  private tooltip: HTMLElement | null = null;
  private hoveredSceneIndex: number | null = null;
  private hoveredBtn: HTMLElement | null = null;

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
      btn.addEventListener('click', (e) => {
        if (e.shiftKey) {
          this.saveToScene(i);
        } else {
          this.recallScene(i);
        }
      });
      btn.addEventListener('mouseenter', () => {
        this.hoveredSceneIndex = i;
        this.hoveredBtn = btn;
        this.showTooltip(i, btn);
      });
      btn.addEventListener('mouseleave', () => {
        this.hoveredSceneIndex = null;
        this.hoveredBtn = null;
        this.hideTooltip();
      });
      container.appendChild(btn);
      this.buttons.push(btn);
    }

    parent.appendChild(container);

    eventBus.on('mute:changed', () => {
      this.activeScene = null;
      this.updateVisuals();
      // Live-update tooltip if hovering a scene button
      if (this.hoveredSceneIndex !== null && this.hoveredBtn) {
        this.showTooltip(this.hoveredSceneIndex, this.hoveredBtn);
      }
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

  private showTooltip(index: number, btn: HTMLElement): void {
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.className = 'mute-scene-tooltip';
      document.body.appendChild(this.tooltip);
    }

    const scene = this.muteScenes.recallScene(index);
    if (!scene) {
      this.tooltip.textContent = '';
      const dim = document.createElement('span');
      dim.className = 'mute-scene-tooltip-dim';
      dim.textContent = 'Empty';
      this.tooltip.appendChild(dim);
    } else {
      // Clear previous content
      while (this.tooltip.firstChild) this.tooltip.removeChild(this.tooltip.firstChild);

      const mutedNames = scene.muted
        .map((m, i) => m ? INSTRUMENTS[i].name : null)
        .filter(Boolean);
      const soloName = scene.soloRow !== null ? INSTRUMENTS[scene.soloRow].name : null;

      const parts: string[] = [];
      if (soloName) parts.push(`Solo: ${soloName}`);
      if (mutedNames.length > 0) parts.push(`Muted: ${mutedNames.join(', ')}`);
      if (parts.length === 0) parts.push('All unmuted');

      this.tooltip.textContent = parts.join(' · ');
    }

    const rect = btn.getBoundingClientRect();
    this.tooltip.style.left = `${rect.left + rect.width / 2}px`;
    this.tooltip.style.top = `${rect.top - 4}px`;
    this.tooltip.style.transform = 'translate(-50%, -100%)';

    void this.tooltip.offsetHeight;
    this.tooltip.classList.add('mute-scene-tooltip--visible');
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.classList.remove('mute-scene-tooltip--visible');
    }
  }

  private updateVisuals(): void {
    for (let i = 0; i < NUM_MUTE_SCENES; i++) {
      const btn = this.buttons[i];
      btn.classList.toggle('mute-scene-btn--filled', this.muteScenes.hasScene(i));
      btn.classList.toggle('mute-scene-btn--active', this.activeScene === i);
    }
  }
}
