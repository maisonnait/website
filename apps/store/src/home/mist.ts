/**
 * The spray: a burst of soft particles on a canvas. Gold dust on white paper, warm light on
 * the night. Ported from the one-page site.
 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  s: number;
  g: number;
  a: number;
  life: number;
  max: number;
  wait: number;
}

export interface Burst {
  n?: number;
  angle?: number;
  spread?: number;
  power?: number;
}

export class Mist {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprite: HTMLCanvasElement;
  private parts: Particle[] = [];
  private w = 0;
  private h = 0;
  private dpr = 1;
  private raf = 0;
  private light = true;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.sprite = document.createElement('canvas');
    this.sprite.width = this.sprite.height = 64;
    this.paintSprite();
  }

  private paintSprite() {
    const sg = this.sprite.getContext('2d')!;
    sg.clearRect(0, 0, 64, 64);
    const g = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (this.light) {
      g.addColorStop(0, 'rgba(168,128,24,.95)');
      g.addColorStop(0.35, 'rgba(201,162,39,.42)');
      g.addColorStop(1, 'rgba(201,162,39,0)');
    } else {
      g.addColorStop(0, 'rgba(255,244,214,.95)');
      g.addColorStop(0.3, 'rgba(241,220,155,.45)');
      g.addColorStop(1, 'rgba(212,175,55,0)');
    }
    sg.fillStyle = g;
    sg.fillRect(0, 0, 64, 64);
  }

  setLight(value: boolean) {
    this.light = value;
    this.paintSprite();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  private tick = () => {
    const { ctx, parts } = this;
    this.raf = 0;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = this.light ? 'source-over' : 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]!;
      if (p.wait > 0) {
        p.wait--;
        continue;
      }
      p.life++;
      if (p.life > p.max) {
        parts.splice(i, 1);
        continue;
      }
      p.vx *= 0.955;
      p.vy = p.vy * 0.955 - 0.014;
      p.x += p.vx;
      p.y += p.vy;
      p.s *= p.g;
      const k = p.life / p.max;
      ctx.globalAlpha = (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9) * p.a;
      ctx.drawImage(this.sprite, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (parts.length) this.raf = requestAnimationFrame(this.tick);
  };

  burst(x: number, y: number, options: Burst = {}) {
    if (!this.w) this.resize();
    const n = options.n ?? 110;
    const angle = options.angle ?? -Math.PI / 2;
    const spread = options.spread ?? 0.95;
    const power = options.power ?? 1;
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * 2 * spread * (0.25 + Math.random() * 0.75);
      const v = (1.2 + Math.random() * 9) * power;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        s: 4 + Math.random() * 11,
        g: 1.012 + Math.random() * 0.02,
        a: 0.1 + Math.random() * 0.16,
        life: 0,
        max: 60 + Math.random() * 100,
        wait: Math.floor(Math.random() * 8),
      });
    }
    if (this.parts.length > 720) this.parts.splice(0, this.parts.length - 720);
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.parts = [];
  }
}
