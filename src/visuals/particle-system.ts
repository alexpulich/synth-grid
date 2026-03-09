interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export class ParticleSystem {
  private canvas: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private animFrameId: number | null = null;
  private lastTime = 0;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'particle-canvas';
    container.appendChild(this.canvas);
    this.ctx2d = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx2d.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  burst(x: number, y: number, color: string, count = 6): void {
    // Convert page coords to coords relative to canvas parent
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    const localX = x - rect.left;
    const localY = y - rect.top;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x: localX,
        y: localY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
        size: 2 + Math.random() * 3,
      });
    }
    if (!this.animFrameId) {
      this.lastTime = performance.now();
      this.animate();
    }
  }

  private animate = (): void => {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.ctx2d.clearRect(0, 0, rect.width, rect.height);

    this.particles = this.particles.filter((p) => p.life > 0);

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      p.life -= dt * 2.5;
      p.vx *= 0.97;

      this.ctx2d.globalAlpha = Math.max(0, p.life);
      this.ctx2d.fillStyle = p.color;
      this.ctx2d.beginPath();
      this.ctx2d.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      this.ctx2d.fill();
    }

    this.ctx2d.globalAlpha = 1;

    if (this.particles.length > 0) {
      this.animFrameId = requestAnimationFrame(this.animate);
    } else {
      this.animFrameId = null;
    }
  };
}
