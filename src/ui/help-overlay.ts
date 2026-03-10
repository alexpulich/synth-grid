export class HelpOverlay {
  private overlay: HTMLElement;
  private visible = false;

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

    const sections: { title: string; rows: [string, string][] }[] = [
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
          ['Right-click', 'Cycle probability: 100% \u2192 75% \u2192 50% \u2192 25%'],
          ['Alt + Scroll', 'Change note pitch (scale-aware)'],
          ['Shift + Scroll', 'Set filter lock on active cell'],
          ['Shift + Right-click', 'Clear filter lock'],
        ],
      },
      {
        title: 'Mixer',
        rows: [
          ['V knob (per row)', 'Volume (drag up/down)'],
          ['P knob (per row)', 'Pan (drag up/down)'],
          ['E button (per row)', 'Euclidean rhythm generator'],
        ],
      },
      {
        title: 'Pattern',
        rows: [
          ['1 \u2013 4', 'Switch bank A\u2013D'],
          ['C', 'Clear current bank'],
          ['R', 'Randomize pattern'],
          ['[ / ]', 'Rotate pattern left / right'],
          ['\u2318/Ctrl + C', 'Copy bank'],
          ['\u2318/Ctrl + V', 'Paste bank'],
          ['\u2318/Ctrl + Z', 'Undo'],
          ['\u2318/Ctrl + Shift + Z', 'Redo'],
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
        title: 'Other',
        rows: [
          ['T', 'Cycle theme'],
          ['S', 'Toggle song mode'],
          ['?', 'Toggle this help'],
        ],
      },
    ];

    for (const section of sections) {
      const sec = document.createElement('div');
      sec.className = 'help-section';

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
      }

      panel.appendChild(sec);
    }

    this.overlay.appendChild(panel);
    parent.appendChild(this.overlay);

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.visible) {
        this.hide();
      }
    });
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  show(): void {
    this.visible = true;
    this.overlay.classList.add('help-overlay--visible');
  }

  hide(): void {
    this.visible = false;
    this.overlay.classList.remove('help-overlay--visible');
  }
}
