import { clamp } from '../utils/math';

export interface KnobOptions {
  formatValue?: (value: number) => string;
}

export class Knob {
  private el: HTMLElement;
  private indicatorEl: HTMLElement;
  private valueEl: HTMLElement | null = null;
  private tooltipEl: HTMLElement | null = null;
  private tooltipTimer: number | null = null;
  private _value: number;
  private isDragging = false;
  private startY = 0;
  private startValue = 0;

  private readonly MIN_ANGLE = -135;
  private readonly MAX_ANGLE = 135;
  private readonly SENSITIVITY = 0.005;

  constructor(
    parent: HTMLElement,
    private label: string,
    initialValue: number,
    private onChange: (value: number) => void,
    private options?: KnobOptions,
  ) {
    this._value = initialValue;
    this.el = this.build(parent);
    this.indicatorEl = this.el.querySelector('.knob-indicator')!;
    this.valueEl = this.el.querySelector('.knob-value');
    this.bindEvents();
    this.updateVisual();
  }

  private build(parent: HTMLElement): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'knob-wrapper';

    const knob = document.createElement('div');
    knob.className = 'knob';
    knob.setAttribute('role', 'slider');
    knob.setAttribute('tabindex', '0');
    knob.setAttribute('aria-label', this.label);
    knob.setAttribute('aria-valuemin', '0');
    knob.setAttribute('aria-valuemax', '1');

    const body = document.createElement('div');
    body.className = 'knob-body';

    const indicator = document.createElement('div');
    indicator.className = 'knob-indicator';

    body.appendChild(indicator);
    knob.appendChild(body);
    wrapper.appendChild(knob);

    if (this.options?.formatValue) {
      const valueEl = document.createElement('span');
      valueEl.className = 'knob-value';
      wrapper.appendChild(valueEl);
    }

    const labelEl = document.createElement('span');
    labelEl.className = 'knob-label';
    labelEl.textContent = this.label;
    wrapper.appendChild(labelEl);

    parent.appendChild(wrapper);
    return wrapper;
  }

  private bindEvents(): void {
    const knobEl = this.el.querySelector('.knob')!;

    knobEl.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.startY = (e as MouseEvent).clientY;
      this.startValue = this._value;
      document.body.style.cursor = 'ns-resize';
      this.showTooltip();
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e: Event) => {
      if (!this.isDragging) return;
      const me = e as MouseEvent;
      const deltaY = this.startY - me.clientY;
      this.setValue(clamp(this.startValue + deltaY * this.SENSITIVITY, 0, 1));
      this.updateTooltip();
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.style.cursor = '';
        this.scheduleHideTooltip();
      }
    });

    knobEl.addEventListener('touchstart', (e) => {
      this.isDragging = true;
      this.startY = (e as TouchEvent).touches[0].clientY;
      this.startValue = this._value;
      this.showTooltip();
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e: Event) => {
      if (!this.isDragging) return;
      const te = e as TouchEvent;
      const deltaY = this.startY - te.touches[0].clientY;
      this.setValue(clamp(this.startValue + deltaY * this.SENSITIVITY, 0, 1));
      this.updateTooltip();
    }, { passive: false });

    document.addEventListener('touchend', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.scheduleHideTooltip();
      }
    });

    knobEl.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'ArrowUp') { this.setValue(clamp(this._value + 0.02, 0, 1)); ke.preventDefault(); }
      if (ke.key === 'ArrowDown') { this.setValue(clamp(this._value - 0.02, 0, 1)); ke.preventDefault(); }
    });
  }

  private setValue(v: number): void {
    this._value = v;
    this.updateVisual();
    this.onChange(v);
  }

  private updateVisual(): void {
    const angle = this.MIN_ANGLE + this._value * (this.MAX_ANGLE - this.MIN_ANGLE);
    this.indicatorEl.style.transform = `rotate(${angle}deg)`;
    const knob = this.el.querySelector('.knob') as HTMLElement;
    knob.setAttribute('aria-valuenow', String(this._value));

    if (this.valueEl && this.options?.formatValue) {
      this.valueEl.textContent = this.options.formatValue(this._value);
    }
  }

  get value(): number { return this._value; }

  setValueSilent(v: number): void {
    this._value = clamp(v, 0, 1);
    this.updateVisual();
  }

  private showTooltip(): void {
    if (!this.options?.formatValue) return;
    if (this.tooltipTimer !== null) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
    if (!this.tooltipEl) {
      this.tooltipEl = document.createElement('div');
      this.tooltipEl.className = 'knob-tooltip';
      this.el.appendChild(this.tooltipEl);
    }
    this.updateTooltip();
    this.tooltipEl.classList.add('knob-tooltip--visible');
  }

  private updateTooltip(): void {
    if (!this.tooltipEl || !this.options?.formatValue) return;
    this.tooltipEl.textContent = this.options.formatValue(this._value);
  }

  private scheduleHideTooltip(): void {
    if (!this.tooltipEl) return;
    this.tooltipTimer = window.setTimeout(() => {
      this.tooltipEl?.classList.remove('knob-tooltip--visible');
      this.tooltipTimer = null;
    }, 500);
  }
}
