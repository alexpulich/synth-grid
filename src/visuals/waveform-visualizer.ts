import { INSTRUMENTS } from '../audio/instruments';

export class WaveformVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;
  private analyser: AnalyserNode;
  private dataArray: Uint8Array<ArrayBuffer>;
  private rafId: number | null = null;
  private silentFrames = 0;
  private readonly MAX_SILENT_FRAMES = 30; // ~500ms at 60fps

  constructor(parent: HTMLElement, analyser: AnalyserNode) {
    this.analyser = analyser;
    this.dataArray = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;

    const container = document.createElement('div');
    container.className = 'visualizer-container';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'visualizer-canvas';
    this.canvas.height = 64;
    container.appendChild(this.canvas);
    parent.appendChild(container);

    this.ctx2d = this.canvas.getContext('2d')!;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.startDrawing();
  }

  private resizeCanvas(): void {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.canvas.width = rect.width;
  }

  private startDrawing(): void {
    if (this.rafId !== null) return;
    this.silentFrames = 0;
    this.draw();
  }

  private draw = (): void => {
    this.analyser.getByteFrequencyData(this.dataArray);

    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx2d;

    ctx.clearRect(0, 0, width, height);

    const binCount = this.dataArray.length;
    const barWidth = width / binCount;
    let hasSignal = false;

    const colors = INSTRUMENTS.map((inst) => inst.color);

    for (let i = 0; i < binCount; i++) {
      const value = this.dataArray[i];
      if (value > 2) hasSignal = true;

      const barHeight = (value / 255) * height;
      const colorIdx = Math.floor((i / binCount) * colors.length);
      const color = colors[colorIdx % colors.length];

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7 + (value / 255) * 0.3;
      ctx.fillRect(
        i * barWidth,
        height - barHeight,
        barWidth - 1,
        barHeight,
      );
    }

    ctx.globalAlpha = 1;

    if (!hasSignal) {
      this.silentFrames++;
      if (this.silentFrames > this.MAX_SILENT_FRAMES) {
        this.rafId = null;
        return;
      }
    } else {
      this.silentFrames = 0;
    }

    this.rafId = requestAnimationFrame(this.draw);
  };

  wake(): void {
    this.startDrawing();
  }
}
