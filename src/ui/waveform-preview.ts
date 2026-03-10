import type { SampleMeta } from '../types';

export class WaveformPreview {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buffer: AudioBuffer | null = null;
  private meta: SampleMeta = { filename: '', trimStart: 0, trimEnd: 1, loop: false };
  private dragging: 'start' | 'end' | null = null;
  private onChange: (trimStart: number, trimEnd: number) => void;

  constructor(parent: HTMLElement, onChange: (trimStart: number, trimEnd: number) => void) {
    this.onChange = onChange;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'waveform-preview';
    this.canvas.width = 200;
    this.canvas.height = 60;
    this.ctx = this.canvas.getContext('2d')!;
    parent.appendChild(this.canvas);

    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mouseup', () => this.onMouseUp());
  }

  setBuffer(buffer: AudioBuffer | null, meta: SampleMeta): void {
    this.buffer = buffer;
    this.meta = { ...meta };
    this.draw();
  }

  updateMeta(meta: SampleMeta): void {
    this.meta = { ...meta };
    this.draw();
  }

  private draw(): void {
    const { canvas, ctx, buffer, meta } = this;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!buffer) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No sample', w / 2, h / 2 + 3);
      return;
    }

    // Draw dimmed regions outside trim
    const trimStartX = meta.trimStart * w;
    const trimEndX = meta.trimEnd * w;

    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(0, 0, trimStartX, h);
    ctx.fillRect(trimEndX, 0, w - trimEndX, h);

    // Draw waveform
    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / w));
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const sampleIdx = Math.floor((x / w) * data.length);
      let min = 0, max = 0;
      for (let j = 0; j < step; j++) {
        const val = data[sampleIdx + j] ?? 0;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const yMin = ((1 - max) / 2) * h;
      const yMax = ((1 - min) / 2) * h;
      if (x === 0) {
        ctx.moveTo(x, yMin);
      }
      ctx.lineTo(x, yMin);
      ctx.lineTo(x, yMax);
    }
    ctx.stroke();

    // Highlight active region
    ctx.fillStyle = 'rgba(100,200,255,0.08)';
    ctx.fillRect(trimStartX, 0, trimEndX - trimStartX, h);

    // Trim handles
    ctx.fillStyle = 'rgba(100,200,255,0.8)';
    ctx.fillRect(trimStartX - 1, 0, 2, h);
    ctx.fillRect(trimEndX - 1, 0, 2, h);

    // Small triangles at top of handles
    ctx.beginPath();
    ctx.moveTo(trimStartX, 0);
    ctx.lineTo(trimStartX + 6, 0);
    ctx.lineTo(trimStartX, 8);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(trimEndX, 0);
    ctx.lineTo(trimEndX - 6, 0);
    ctx.lineTo(trimEndX, 8);
    ctx.fill();
  }

  private onMouseDown(e: MouseEvent): void {
    if (!this.buffer) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;

    const startDist = Math.abs(x - this.meta.trimStart);
    const endDist = Math.abs(x - this.meta.trimEnd);
    const threshold = 0.05;

    if (startDist < threshold && startDist <= endDist) {
      this.dragging = 'start';
    } else if (endDist < threshold) {
      this.dragging = 'end';
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.dragging || !this.buffer) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    if (this.dragging === 'start') {
      this.meta.trimStart = Math.min(x, this.meta.trimEnd - 0.02);
    } else {
      this.meta.trimEnd = Math.max(x, this.meta.trimStart + 0.02);
    }
    this.draw();
    this.onChange(this.meta.trimStart, this.meta.trimEnd);
  }

  private onMouseUp(): void {
    this.dragging = null;
  }
}
