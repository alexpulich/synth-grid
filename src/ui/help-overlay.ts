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
    ];

    // Touch-only section (visible on coarse pointer devices)
    const touchSection: { title: string; rows: [string, string][] } = {
      title: 'Touch Controls',
      rows: [
        ['Tap cell', 'Toggle on/off'],
        ['Drag across cells', 'Paint / erase multiple cells'],
        ['Long-press active cell', 'Open context menu'],
        ['Edit mode (FAB button)', 'Tap active cells to edit properties'],
        ['Piano roll drag', 'Paint / erase notes'],
        ['Automation lane drag', 'Draw automation values'],
      ],
    };

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

    // Add touch section (hidden on non-touch devices via CSS)
    const touchSec = document.createElement('div');
    touchSec.className = 'help-section help-section--touch';

    const touchHeading = document.createElement('div');
    touchHeading.className = 'help-section-title';
    touchHeading.textContent = touchSection.title;
    touchSec.appendChild(touchHeading);

    for (const [key, desc] of touchSection.rows) {
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

      touchSec.appendChild(row);
    }
    panel.appendChild(touchSec);

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
