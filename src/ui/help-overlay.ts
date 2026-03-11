interface RowRef {
  el: HTMLElement;
  text: string; // searchable text (key + description, lowercased)
  sectionEl: HTMLElement;
}

export class HelpOverlay {
  private overlay: HTMLElement;
  private visible = false;
  private searchInput: HTMLInputElement | null = null;
  private sectionEls: HTMLElement[] = [];
  private rowRefs: RowRef[] = [];
  private noResults: HTMLElement | null = null;

  constructor(parent: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'help-overlay';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    const panel = document.createElement('div');
    panel.className = 'help-panel';

    const title = document.createElement('h2');
    title.className = 'help-title';
    title.textContent = 'Controls & Shortcuts';
    panel.appendChild(title);

    // Search input
    const searchWrap = document.createElement('div');
    searchWrap.className = 'help-search-wrap';

    this.searchInput = document.createElement('input');
    this.searchInput.className = 'help-search';
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Search shortcuts\u2026';
    this.searchInput.addEventListener('input', () => this.filterRows());
    searchWrap.appendChild(this.searchInput);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'help-search-clear';
    clearBtn.textContent = '\u00d7';
    clearBtn.addEventListener('click', () => {
      if (this.searchInput) {
        this.searchInput.value = '';
        this.filterRows();
        this.searchInput.focus();
      }
    });
    searchWrap.appendChild(clearBtn);

    panel.appendChild(searchWrap);

    // No results message
    this.noResults = document.createElement('div');
    this.noResults.className = 'help-no-results';
    this.noResults.textContent = 'No matching shortcuts found';
    panel.appendChild(this.noResults);

    const sections: { title: string; rows: [string, string][]; cssClass?: string }[] = [
      {
        title: 'Playback',
        rows: [
          ['Space', 'Play / Stop'],
        ],
      },
      {
        title: 'Grid',
        rows: [
          ['Click', 'Toggle cell on/off'],
          ['Drag', 'Paint multiple cells'],
          ['Shift + Click', 'Cycle velocity: soft \u2192 med \u2192 loud'],
          ['Right-click', 'Open cell context menu (all cell options)'],
          ['Alt + Scroll', 'Change note pitch (scale-aware)'],
          ['Shift + Scroll', 'Set filter lock on active cell'],
          ['Shift + Right-click', 'Clear filter lock'],
          ['Ctrl + Scroll', 'Set ratchet repeats (\u00d72, \u00d73, \u00d74)'],
          ['Ctrl + Right-click', 'Cycle trig condition (1:2, 2:2, 1:4, etc.)'],
          ['Alt + Right-click', 'Cycle note gate: Short \u2192 Normal \u2192 Long \u2192 Held'],
          ['Alt + Click', 'Toggle slide/glide (melodic rows)'],
          ['A', 'Toggle automation lanes'],
        ],
      },
      {
        title: 'Mixer',
        rows: [
          ['V knob (per row)', 'Volume (drag up/down)'],
          ['P knob (per row)', 'Pan (drag up/down)'],
          ['S knob (per row)', 'Swing amount (drag up/down)'],
          ['R knob (per row)', 'Reverb send amount (drag up/down)'],
          ['D knob (per row)', 'Delay send amount (drag up/down)'],
          ['E button (per row)', 'Euclidean rhythm generator'],
          ['\u266a button (melodic rows)', 'Open piano roll editor'],
          ['Double-click label', 'Open sound shaper (sample controls when loaded)'],
          ['Drag audio file onto label', 'Load sample for that row'],
        ],
      },
      {
        title: 'Pattern',
        rows: [
          ['1 \u2013 4', 'Switch/queue bank A\u2013D'],
          ['C', 'Clear current bank'],
          ['R', 'Randomize pattern'],
          ['[ / ]', 'Rotate pattern left / right'],
          ['\u2318/Ctrl + C', 'Copy bank'],
          ['\u2318/Ctrl + V', 'Paste bank'],
          ['\u2318/Ctrl + Z', 'Undo'],
          ['\u2318/Ctrl + Shift + Z', 'Redo'],
          ['Ctrl + Click step header', 'Copy step column'],
          ['Ctrl + Shift + Click step header', 'Paste step column'],
        ],
      },
      {
        title: 'Performance FX (hold)',
        rows: [
          ['F1', 'Tape Stop'],
          ['F2', 'Stutter'],
          ['F3', 'Bitcrush'],
          ['F4', 'Reverb Wash'],
        ],
      },
      {
        title: 'MIDI',
        rows: [
          ['M', 'Toggle MIDI CC learn mode'],
          ['MIDI button', 'Open MIDI settings panel'],
          ['MIDI Notes 36\u201343', 'Trigger instruments (GM drums)'],
          ['MIDI Notes 48\u201355', 'Trigger instruments (C3\u2013G3)'],
          ['MIDI CC', 'Control mapped parameters'],
        ],
      },
      {
        title: 'MIDI Output',
        rows: [
          ['N', 'Toggle MIDI output on/off'],
          ['MIDI panel \u2192 Output', 'Configure output port, channels, and clock'],
          ['Scroll on Note button', 'Change base MIDI note per row'],
        ],
      },
      {
        title: 'Mute Scenes',
        rows: [
          ['Alt + 1\u20138', 'Recall mute scene'],
          ['Shift + Alt + 1\u20138', 'Save current mutes to scene'],
        ],
      },
      {
        title: 'Other',
        rows: [
          ['T', 'Cycle theme'],
          ['S', 'Toggle song mode'],
          ['K', 'Toggle metronome'],
          ['P', 'Open pattern library'],
          ['?', 'Toggle this help'],
        ],
      },
      {
        title: 'Touch Controls',
        rows: [
          ['Tap cell', 'Toggle on/off'],
          ['Drag across cells', 'Paint / erase multiple cells'],
          ['Long-press active cell', 'Open context menu'],
          ['Edit mode (FAB button)', 'Tap active cells to edit properties'],
          ['Piano roll drag', 'Paint / erase notes'],
          ['Automation lane drag', 'Draw automation values'],
        ],
        cssClass: 'help-section--touch',
      },
    ];

    for (const section of sections) {
      const sec = document.createElement('div');
      sec.className = 'help-section' + (section.cssClass ? ` ${section.cssClass}` : '');

      const heading = document.createElement('div');
      heading.className = 'help-section-title';
      heading.textContent = section.title;
      sec.appendChild(heading);

      for (const [key, desc] of section.rows) {
        const row = document.createElement('div');
        row.className = 'help-row';

        const keyEl = document.createElement('span');
        keyEl.className = 'help-key';
        keyEl.textContent = key;
        row.appendChild(keyEl);

        const descEl = document.createElement('span');
        descEl.className = 'help-desc';
        descEl.textContent = desc;
        row.appendChild(descEl);

        sec.appendChild(row);
        this.rowRefs.push({
          el: row,
          text: `${key} ${desc}`.toLowerCase(),
          sectionEl: sec,
        });
      }

      panel.appendChild(sec);
      this.sectionEls.push(sec);
    }

    this.overlay.appendChild(panel);
    parent.appendChild(this.overlay);

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.visible) {
        this.hide();
      }
    });
  }

  private filterRows(): void {
    const query = this.searchInput?.value.trim().toLowerCase() ?? '';
    let anyVisible = false;

    if (!query) {
      // Show all
      for (const ref of this.rowRefs) {
        ref.el.classList.remove('help-row--hidden');
      }
      for (const sec of this.sectionEls) {
        sec.classList.remove('help-section--hidden');
      }
      if (this.noResults) this.noResults.classList.remove('help-no-results--visible');
      return;
    }

    // Hide non-matching rows
    for (const ref of this.rowRefs) {
      const matches = ref.text.includes(query);
      ref.el.classList.toggle('help-row--hidden', !matches);
      if (matches) anyVisible = true;
    }

    // Hide sections with no visible rows
    for (const sec of this.sectionEls) {
      const hasVisibleRow = this.rowRefs.some(
        (ref) => ref.sectionEl === sec && !ref.el.classList.contains('help-row--hidden'),
      );
      sec.classList.toggle('help-section--hidden', !hasVisibleRow);
    }

    if (this.noResults) {
      this.noResults.classList.toggle('help-no-results--visible', !anyVisible);
    }
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  show(): void {
    this.visible = true;
    this.overlay.classList.add('help-overlay--visible');
    // Focus search and clear previous query
    if (this.searchInput) {
      this.searchInput.value = '';
      this.filterRows();
      setTimeout(() => this.searchInput?.focus(), 100);
    }
  }

  hide(): void {
    this.visible = false;
    this.overlay.classList.remove('help-overlay--visible');
  }
}
