import { eventBus } from '../utils/event-bus';
import { deriveSwatches } from './theme-utils';

interface ThemeDefinition {
  id: string;
  name: string;
  vars: Record<string, string>;
}

const THEMES: ThemeDefinition[] = [
  {
    id: 'neon-night',
    name: 'Neon Night',
    vars: {},
  },
  {
    id: 'sunset-fade',
    name: 'Sunset Fade',
    vars: {
      '--color-bg': '#1a0a14',
      '--color-surface': '#241018',
      '--color-surface-light': '#301820',
      '--color-border': '#4a2030',
      '--color-text': '#e0c0b0',
      '--color-text-dim': '#906050',
      '--color-kick': '#ff4444',
      '--color-snare': '#ff8833',
      '--color-hihat': '#ffaa22',
      '--color-clap': '#ff6644',
      '--color-bass': '#cc4466',
      '--color-lead': '#ff5577',
      '--color-pad': '#dd6633',
      '--color-perc': '#ffbb44',
      '--cell-inactive': '#301820',
      '--cell-hover': '#3a2028',
      '--knob-bg': '#2a1420',
      '--knob-track': '#442030',
    },
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    vars: {
      '--color-bg': '#050a14',
      '--color-surface': '#0a1220',
      '--color-surface-light': '#10182a',
      '--color-border': '#1a2840',
      '--color-text': '#a0c0e0',
      '--color-text-dim': '#405870',
      '--color-kick': '#2288cc',
      '--color-snare': '#33aadd',
      '--color-hihat': '#44ccaa',
      '--color-clap': '#22ddbb',
      '--color-bass': '#1166aa',
      '--color-lead': '#3399ee',
      '--color-pad': '#2277bb',
      '--color-perc': '#55bbdd',
      '--cell-inactive': '#10182a',
      '--cell-hover': '#182238',
      '--knob-bg': '#0c1624',
      '--knob-track': '#1a2840',
    },
  },
  {
    id: 'phantom',
    name: 'Phantom',
    vars: {
      '--color-bg': '#0c0c0c',
      '--color-surface': '#161616',
      '--color-surface-light': '#1e1e1e',
      '--color-border': '#333333',
      '--color-text': '#cccccc',
      '--color-text-dim': '#666666',
      '--color-kick': '#ffffff',
      '--color-snare': '#cccccc',
      '--color-hihat': '#aaaaaa',
      '--color-clap': '#dddddd',
      '--color-bass': '#888888',
      '--color-lead': '#bbbbbb',
      '--color-pad': '#999999',
      '--color-perc': '#b0b0b0',
      '--cell-inactive': '#1e1e1e',
      '--cell-hover': '#282828',
      '--knob-bg': '#1a1a1a',
      '--knob-track': '#333333',
    },
  },
];

const STORAGE_KEY = 'synth-grid-theme';

export class ThemeSwitcher {
  private currentIndex = 0;
  private cards: HTMLButtonElement[] = [];

  constructor(parent: HTMLElement) {
    const container = document.createElement('div');
    container.className = 'theme-switcher';

    const label = document.createElement('span');
    label.className = 'section-label';
    label.textContent = 'Theme';
    container.appendChild(label);

    const cardsRow = document.createElement('div');
    cardsRow.className = 'theme-cards';

    for (let i = 0; i < THEMES.length; i++) {
      const theme = THEMES[i];
      const card = document.createElement('button');
      card.className = 'theme-card';
      if (i === 0) card.classList.add('theme-card--active');

      const swatchesRow = document.createElement('div');
      swatchesRow.className = 'theme-card-swatches';
      for (const color of deriveSwatches(theme.vars)) {
        const swatch = document.createElement('span');
        swatch.className = 'theme-card-swatch';
        swatch.style.background = color;
        swatchesRow.appendChild(swatch);
      }
      card.appendChild(swatchesRow);

      const name = document.createElement('span');
      name.className = 'theme-card-name';
      name.textContent = theme.name;
      card.appendChild(name);

      card.addEventListener('click', () => this.setTheme(i));
      cardsRow.appendChild(card);
      this.cards.push(card);
    }

    container.appendChild(cardsRow);
    parent.appendChild(container);

    // Restore from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const idx = THEMES.findIndex((t) => t.id === saved);
      if (idx >= 0) this.setTheme(idx);
    }
  }

  cycle(): void {
    this.setTheme((this.currentIndex + 1) % THEMES.length);
  }

  private setTheme(index: number): void {
    this.currentIndex = index;
    const theme = THEMES[index];
    const root = document.documentElement;

    // Reset all theme vars first (for Neon Night which has no overrides)
    if (theme.id === 'neon-night') {
      for (const t of THEMES) {
        for (const key of Object.keys(t.vars)) {
          root.style.removeProperty(key);
        }
      }
    } else {
      for (const [key, value] of Object.entries(theme.vars)) {
        root.style.setProperty(key, value);
      }
    }

    // Update active card
    for (let i = 0; i < this.cards.length; i++) {
      this.cards[i].classList.toggle('theme-card--active', i === index);
    }

    localStorage.setItem(STORAGE_KEY, theme.id);
    eventBus.emit('theme:changed', theme.id);
  }
}
