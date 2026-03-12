import { INSTRUMENTS } from '../audio/instruments';
import { eventBus } from '../utils/event-bus';

interface Ring {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

export class ReactiveBackground {
  private canvas: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;
  private animId: number | null = null;
  private rings: Ring[] = [];
  private energy = 0;
  private smoothEnergy = 0;
  private hue = 220;
  private isPlaying = false;
  private fadeAlpha = 0;

  private analyserData: Uint8Array<ArrayBuffer>;
  private prevLowEnergy = 0;
  private prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(parent: HTMLElement, private analyser: AnalyserNode) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'reactive-bg-canvas';
    parent.prepend(this.canvas);

    this.ctx2d = this.canvas.getContext('2d')!;
    this.analyserData = new Uint8Array(analyser.frequencyBinCount);

    this.resize();
    window.addEventListener('resize', () => this.resize());

    eventBus.on('transport:play', () => {
      this.isPlaying = true;
      if (!this.animId && !this.prefersReducedMotion) this.animate();
    });

    eventBus.on('transport:stop', () => {
      this.isPlaying = false;
    });

    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.prefersReducedMotion = e.matches;
      if (e.matches) {
        if (this.animId !== null) {
          cancelAnimationFrame(this.animId);
          this.animId = null;
        }
        this.rings = [];
        this.ctx2d.clearRect(0, 0, this.canvas.width, this.canvas.height);
      } else if (this.isPlaying) {
        this.animate();
      }
    });
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private animate = (): void => {
    this.analyser.getByteFrequencyData(this.analyserData);

    // Compute total energy and low-freq energy
    let total = 0;
    let lowEnergy = 0;
    for (let i = 0; i < this.analyserData.length; i++) {
      total += this.analyserData[i];
      if (i < 4) lowEnergy += this.analyserData[i];
    }
    this.energy = total / this.analyserData.length / 255;
    this.smoothEnergy = this.lerp(this.smoothEnergy, this.energy, 0.15);

    // Beat detection (kick)
    const lowThreshold = this.prevLowEnergy * 1.3;
    if (lowEnergy > 150 && lowEnergy > lowThreshold) {
      this.spawnRing();
    }
    this.prevLowEnergy = lowEnergy;

    // Hue shift
    this.hue = (this.hue + this.energy * 0.5) % 360;

    // Fade control
    if (this.isPlaying) {
      this.fadeAlpha = Math.min(1, this.fadeAlpha + 0.02);
    } else {
      this.fadeAlpha = Math.max(0, this.fadeAlpha - 0.015);
    }

    this.draw();

    if (this.fadeAlpha > 0 || this.isPlaying) {
      this.animId = requestAnimationFrame(this.animate);
    } else {
      this.animId = null;
    }
  };

  private draw(): void {
    const { width, height } = this.canvas;
    const cx = width / 2;
    const cy = height / 2;

    this.ctx2d.clearRect(0, 0, width, height);
    this.ctx2d.globalAlpha = this.fadeAlpha;

    // Ambient gradient
    const gradient = this.ctx2d.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.6);
    const sat = 30 + this.smoothEnergy * 40;
    const light = 5 + this.smoothEnergy * 8;
    gradient.addColorStop(0, `hsla(${this.hue}, ${sat}%, ${light}%, 0.4)`);
    gradient.addColorStop(1, 'transparent');
    this.ctx2d.fillStyle = gradient;
    this.ctx2d.fillRect(0, 0, width, height);

    // Center glow
    const glowRadius = 80 + this.smoothEnergy * 120;
    const glowGrad = this.ctx2d.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    glowGrad.addColorStop(0, `hsla(${this.hue}, 60%, 30%, ${this.smoothEnergy * 0.3})`);
    glowGrad.addColorStop(1, 'transparent');
    this.ctx2d.fillStyle = glowGrad;
    this.ctx2d.fillRect(0, 0, width, height);

    // Rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.radius += 3;
      ring.alpha -= 0.012;

      if (ring.alpha <= 0 || ring.radius > ring.maxRadius) {
        this.rings.splice(i, 1);
        continue;
      }

      this.ctx2d.strokeStyle = ring.color;
      this.ctx2d.globalAlpha = ring.alpha * this.fadeAlpha;
      this.ctx2d.lineWidth = 2;
      this.ctx2d.beginPath();
      this.ctx2d.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      this.ctx2d.stroke();
    }

    this.ctx2d.globalAlpha = 1;
  }

  private spawnRing(): void {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    this.rings.push({
      x: cx + (Math.random() - 0.5) * 60,
      y: cy + (Math.random() - 0.5) * 40,
      radius: 10,
      maxRadius: Math.max(this.canvas.width, this.canvas.height) * 0.5,
      color: INSTRUMENTS[0].color,
      alpha: 0.5,
    });
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}
