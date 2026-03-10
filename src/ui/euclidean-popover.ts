import { NUM_STEPS } from '../types';
import type { Sequencer } from '../sequencer/sequencer';
import { euclidean, rotatePattern } from '../utils/euclidean';

export class EuclideanPopover {
  private el: HTMLElement;
  private previewCells: HTMLElement[] = [];
  private hitsSlider!: HTMLInputElement;
  private rotationSlider!: HTMLInputElement;
  private hitsLabel!: HTMLElement;
  private rotationLabel!: HTMLElement;
  private currentRow = 0;
  private visible = false;

  constructor(private sequencer: Sequencer) {
    this.el = document.createElement('div');
    this.el.className = 'euclidean-popover';
    this.build();

    document.addEventListener('mousedown', (e) => {
      if (this.visible && !this.el.contains(e.target as Node)) {
        this.hide();
      }
    });
  }

  private build(): void {
    const title = document.createElement('div');
    title.className = 'euclidean-title';
    title.textContent = 'Euclidean';
    this.el.appendChild(title);

    // Hits slider
    const hitsRow = this.createSliderRow('Hits', 0, NUM_STEPS, 4);
    this.hitsSlider = hitsRow.slider;
    this.hitsLabel = hitsRow.label;
    this.el.appendChild(hitsRow.container);

    // Rotation slider
    const rotRow = this.createSliderRow('Rot', 0, NUM_STEPS - 1, 0);
    this.rotationSlider = rotRow.slider;
    this.rotationLabel = rotRow.label;
    this.el.appendChild(rotRow.container);

    // Mini preview
    const preview = document.createElement('div');
    preview.className = 'euclidean-preview';
    for (let i = 0; i < NUM_STEPS; i++) {
      const cell = document.createElement('div');
      cell.className = 'euclidean-preview-cell';
      preview.appendChild(cell);
      this.previewCells.push(cell);
    }
    this.el.appendChild(preview);

    // Apply button
    const applyBtn = document.createElement('button');
    applyBtn.className = 'euclidean-apply';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => {
      this.sequencer.applyEuclidean(
        this.currentRow,
        Number(this.hitsSlider.value),
        Number(this.rotationSlider.value),
      );
      this.hide();
    });
    this.el.appendChild(applyBtn);

    this.hitsSlider.addEventListener('input', () => this.updatePreview());
    this.rotationSlider.addEventListener('input', () => this.updatePreview());
  }

  private createSliderRow(label: string, min: number, max: number, initial: number) {
    const container = document.createElement('div');
    container.className = 'euclidean-slider-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'euclidean-slider-label';
    labelEl.textContent = label;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'euclidean-slider';
    slider.min = String(min);
    slider.max = String(max);
    slider.value = String(initial);

    const valueEl = document.createElement('span');
    valueEl.className = 'euclidean-slider-value';
    valueEl.textContent = String(initial);

    slider.addEventListener('input', () => {
      valueEl.textContent = slider.value;
    });

    container.appendChild(labelEl);
    container.appendChild(slider);
    container.appendChild(valueEl);

    return { container, slider, label: valueEl };
  }

  private updatePreview(): void {
    const hits = Number(this.hitsSlider.value);
    const rotation = Number(this.rotationSlider.value);
    const pattern = rotatePattern(euclidean(NUM_STEPS, hits), rotation);

    for (let i = 0; i < NUM_STEPS; i++) {
      this.previewCells[i].classList.toggle('euclidean-preview-cell--active', pattern[i]);
    }
  }

  show(row: number, anchor: HTMLElement): void {
    this.currentRow = row;
    this.hitsSlider.value = '4';
    this.rotationSlider.value = '0';
    this.hitsLabel.textContent = '4';
    this.rotationLabel.textContent = '0';
    this.updatePreview();

    // Position near anchor
    const rect = anchor.getBoundingClientRect();
    this.el.style.top = `${rect.bottom + 4}px`;
    this.el.style.left = `${rect.left}px`;

    if (!this.el.parentElement) {
      document.body.appendChild(this.el);
    }
    this.el.classList.add('euclidean-popover--visible');
    this.visible = true;
  }

  hide(): void {
    this.el.classList.remove('euclidean-popover--visible');
    this.visible = false;
  }
}
