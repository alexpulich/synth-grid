import { eventBus } from '../utils/event-bus';
import type { EventMap } from '../utils/event-bus';

const STORAGE_KEY = 'synth-grid-tour-completed';

interface TourStep {
  selector: string;
  text: string;
  position: 'top' | 'bottom';
  waitForEvent?: keyof EventMap;
}

const STEPS: TourStep[] = [
  {
    selector: '.grid-cell[data-row="0"][data-step="0"]',
    text: 'Click cells to paint a beat. Try clicking a few cells in this row!',
    position: 'bottom',
    waitForEvent: 'cell:toggled',
  },
  {
    selector: '.transport-play-btn',
    text: 'Press Space or click Play to hear your beat.',
    position: 'bottom',
    waitForEvent: 'transport:play',
  },
  {
    selector: '.grid-cell[data-row="0"]',
    text: 'Shift+Click an active cell to cycle velocity: Soft \u2192 Medium \u2192 Loud.',
    position: 'bottom',
  },
  {
    selector: '.grid-cell[data-row="0"]',
    text: 'Right-click any active cell for all options: ratchets, conditions, gate, note, and more.',
    position: 'bottom',
  },
  {
    selector: '.grid-row-label',
    text: 'Click row labels to mute/unmute. Double-click to open the sound shaper.',
    position: 'bottom',
  },
  {
    selector: '.perf-fx-btn',
    text: 'Hold F1\u2013F4 (or these buttons) for live performance effects: tape stop, stutter, bitcrush, reverb wash.',
    position: 'top',
  },
  {
    selector: '.pattern-bank-btn',
    text: 'Switch between 4 pattern banks (A\u2013D) to build song sections.',
    position: 'bottom',
  },
  {
    selector: '.help-btn',
    text: 'Press ? anytime to see all shortcuts. Happy beat-making!',
    position: 'bottom',
  },
];

export class OnboardingTour {
  private overlay: HTMLElement;
  private spotlight: HTMLElement;
  private card: HTMLElement;
  private cardText: HTMLElement;
  private stepLabel: HTMLElement;
  private nextBtn: HTMLElement;
  private skipBtn: HTMLElement;
  private currentStep = 0;
  private active = false;
  private eventUnsub: (() => void) | null = null;
  private resizeHandler: (() => void) | null = null;

  constructor() {
    // Overlay (full-screen dim)
    this.overlay = document.createElement('div');
    this.overlay.className = 'tour-overlay';

    // Spotlight cutout
    this.spotlight = document.createElement('div');
    this.spotlight.className = 'tour-spotlight';
    this.overlay.appendChild(this.spotlight);

    // Instruction card
    this.card = document.createElement('div');
    this.card.className = 'tour-card';

    this.cardText = document.createElement('div');
    this.cardText.className = 'tour-card__text';
    this.card.appendChild(this.cardText);

    const nav = document.createElement('div');
    nav.className = 'tour-card__nav';

    this.stepLabel = document.createElement('span');
    this.stepLabel.className = 'tour-card__step';
    nav.appendChild(this.stepLabel);

    const spacer = document.createElement('span');
    spacer.style.flex = '1';
    nav.appendChild(spacer);

    this.skipBtn = document.createElement('button');
    this.skipBtn.className = 'tour-card__skip';
    this.skipBtn.textContent = 'Skip';
    this.skipBtn.addEventListener('click', () => this.finish());
    nav.appendChild(this.skipBtn);

    this.nextBtn = document.createElement('button');
    this.nextBtn.className = 'tour-card__next';
    this.nextBtn.textContent = 'Next';
    this.nextBtn.addEventListener('click', () => this.advance());
    nav.appendChild(this.nextBtn);

    this.card.appendChild(nav);
    this.overlay.appendChild(this.card);

    // Escape to dismiss
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.active) this.finish();
    });
  }

  static isCompleted(): boolean {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }

  start(): void {
    this.currentStep = 0;
    this.active = true;
    document.body.appendChild(this.overlay);

    // Reposition on resize
    this.resizeHandler = () => { if (this.active) this.showStep(); };
    window.addEventListener('resize', this.resizeHandler);

    void this.overlay.offsetHeight; // reflow trick
    this.overlay.classList.add('tour-overlay--visible');
    this.showStep();
  }

  private showStep(): void {
    const step = STEPS[this.currentStep];
    if (!step) { this.finish(); return; }

    // Find the first matching target element
    const target = document.querySelector(step.selector) as HTMLElement | null;
    if (!target) {
      // Skip to next step if element not found
      this.currentStep++;
      this.showStep();
      return;
    }

    // Position spotlight over target
    const rect = target.getBoundingClientRect();
    const pad = 6;
    this.spotlight.style.left = `${rect.left - pad}px`;
    this.spotlight.style.top = `${rect.top - pad}px`;
    this.spotlight.style.width = `${rect.width + pad * 2}px`;
    this.spotlight.style.height = `${rect.height + pad * 2}px`;

    // Update card content
    this.cardText.textContent = step.text;
    this.stepLabel.textContent = `${this.currentStep + 1} / ${STEPS.length}`;

    // Last step shows "Done" instead of "Next"
    const isLast = this.currentStep === STEPS.length - 1;
    this.nextBtn.textContent = isLast ? 'Done' : 'Next';
    this.skipBtn.style.display = isLast ? 'none' : '';

    // Position card relative to spotlight
    this.positionCard(rect, step.position);

    // If step has waitForEvent, auto-advance on event
    this.clearEventListener();
    if (step.waitForEvent) {
      const event = step.waitForEvent;
      const handler = () => {
        this.clearEventListener();
        // Small delay so user sees the effect before advancing
        setTimeout(() => this.advance(), 400);
      };
      // eventBus.on() returns an unsub function
      this.eventUnsub = eventBus.on(event, handler as never);
    }
  }

  private positionCard(targetRect: DOMRect, position: 'top' | 'bottom'): void {
    const cardWidth = 320;
    let left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
    // Clamp to viewport
    left = Math.max(12, Math.min(left, window.innerWidth - cardWidth - 12));

    this.card.style.width = `${cardWidth}px`;
    this.card.style.left = `${left}px`;

    if (position === 'bottom') {
      this.card.style.top = `${targetRect.bottom + 16}px`;
      this.card.style.bottom = '';
    } else {
      this.card.style.top = '';
      this.card.style.bottom = `${window.innerHeight - targetRect.top + 16}px`;
    }
  }

  private advance(): void {
    this.clearEventListener();
    this.currentStep++;
    if (this.currentStep >= STEPS.length) {
      this.finish();
    } else {
      this.showStep();
    }
  }

  private finish(): void {
    this.clearEventListener();
    this.active = false;
    this.overlay.classList.remove('tour-overlay--visible');

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    // Remove overlay after transition
    setTimeout(() => {
      if (this.overlay.parentElement) {
        this.overlay.parentElement.removeChild(this.overlay);
      }
    }, 300);

    // Mark as completed
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch { /* ignore */ }
  }

  private clearEventListener(): void {
    if (this.eventUnsub) {
      this.eventUnsub();
      this.eventUnsub = null;
    }
  }
}
