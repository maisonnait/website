/**
 * The mist of the hero: what rises from the stopper of the flacon. Three kinds of particles on
 * one canvas: soft puffs (the spray itself), a thin wisp that climbs in an S like the one of
 * the logo, and a few bright specks that catch the light. Gold dust on the light page, warm
 * light on the dark one. Time is counted in 60ths of a second, whatever the screen's rate.
 */
type Kind = 'puff' | 'wisp' | 'speck';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  grow: number;
  alpha: number;
  age: number;
  life: number;
  wait: number;
  phase: number;
  sway: number;
}

const MAX = 620;

export class Plume {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly soft = document.createElement('canvas');
  private readonly bright = document.createElement('canvas');
  private parts: Particle[] = [];
  private width = 0;
  private height = 0;
  private ratio = 1;
  private raf = 0;
  private last = 0;
  private light = true;
  /** -1: the mist drifts to the left (towards the words on a left-to-right page), 1: to the right. */
  drift = -1;
  /** How far the spray leans from the vertical, in radians, towards the drift. */
  lean = 0.2;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.soft.width = this.soft.height = 96;
    this.bright.width = this.bright.height = 32;
    this.paint();
  }

  private paint() {
    const dot = (target: HTMLCanvasElement, stops: [number, string][]) => {
      const size = target.width;
      const g2 = target.getContext('2d')!;
      g2.clearRect(0, 0, size, size);
      const gradient = g2.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      for (const [at, colour] of stops) gradient.addColorStop(at, colour);
      g2.fillStyle = gradient;
      g2.fillRect(0, 0, size, size);
    };
    if (this.light) {
      dot(this.soft, [
        [0, 'rgba(181,148,73,.60)'],
        [0.4, 'rgba(196,164,92,.26)'],
        [1, 'rgba(214,190,130,0)'],
      ]);
      dot(this.bright, [
        [0, 'rgba(150,112,30,.95)'],
        [0.35, 'rgba(181,148,73,.5)'],
        [1, 'rgba(181,148,73,0)'],
      ]);
    } else {
      dot(this.soft, [
        [0, 'rgba(255,226,170,.30)'],
        [0.4, 'rgba(226,190,120,.11)'],
        [1, 'rgba(201,170,99,0)'],
      ]);
      dot(this.bright, [
        [0, 'rgba(255,250,235,1)'],
        [0.3, 'rgba(255,226,160,.6)'],
        [1, 'rgba(230,190,110,0)'],
      ]);
    }
  }

  setLight(value: boolean) {
    if (value === this.light) return;
    this.light = value;
    this.paint();
  }

  resize() {
    const box = this.canvas.getBoundingClientRect();
    if (!box.width) return;
    this.ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.width = box.width;
    this.height = box.height;
    this.canvas.width = Math.round(this.width * this.ratio);
    this.canvas.height = Math.round(this.height * this.ratio);
  }

  private add(particle: Particle) {
    this.parts.push(particle);
    if (this.parts.length > MAX) this.parts.splice(0, this.parts.length - MAX);
    if (!this.raf) {
      this.last = 0;
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  /** One press on the stopper: a cone of mist going up from (x, y), in canvas pixels. `scale` follows the size of the flacon. */
  spray(x: number, y: number, scale = 1, strength = 1) {
    if (!this.width) this.resize();
    const lean = this.drift * this.lean;
    const puffs = Math.round(170 * strength);
    for (let i = 0; i < puffs; i++) {
      const angle = -Math.PI / 2 + lean + (Math.random() - 0.5) * 0.95 * (0.3 + Math.random() * 0.7);
      const speed = (1.4 + Math.random() * 8.2) * scale * (0.75 + strength * 0.25);
      this.add({
        kind: 'puff',
        x: x + (Math.random() - 0.5) * 6 * scale,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (7 + Math.random() * 17) * scale,
        grow: 1.008 + Math.random() * 0.012,
        alpha: 0.1 + Math.random() * 0.19,
        age: 0,
        life: 130 + Math.random() * 170,
        wait: Math.random() * 12,
        phase: Math.random() * 6.283,
        sway: 0.1 + Math.random() * 0.25,
      });
    }
    const specks = Math.round(46 * strength);
    for (let i = 0; i < specks; i++) {
      const angle = -Math.PI / 2 + lean + (Math.random() - 0.5) * 1.3;
      const speed = (3 + Math.random() * 11) * scale;
      this.add({
        kind: 'speck',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (0.8 + Math.random() * 1.9) * scale,
        grow: 1,
        alpha: 0.5 + Math.random() * 0.5,
        age: 0,
        life: 70 + Math.random() * 150,
        wait: Math.random() * 6,
        phase: Math.random() * 6.283,
        sway: 0.2 + Math.random() * 0.5,
      });
    }
  }

  /** A breath of the thin wisp: call it on every frame for as long as the wisp should climb. */
  wisp(x: number, y: number, scale = 1, amount = 1) {
    if (!this.width) this.resize();
    if (Math.random() > 0.55 * amount) return;
    this.add({
      kind: 'wisp',
      x,
      y,
      vx: 0,
      vy: -(0.75 + Math.random() * 0.5) * scale,
      size: (2.2 + Math.random() * 2.6) * scale,
      grow: 1.006 + Math.random() * 0.004,
      alpha: 0.2 + Math.random() * 0.16,
      age: 0,
      life: 150 + Math.random() * 90,
      wait: 0,
      phase: performance.now() / 1150, // neighbours share their phase: together they draw one moving S
      sway: (7 + Math.random() * 1.5) * scale,
    });
  }

  get busy() {
    return this.parts.length > 0;
  }

  private tick = (now: number) => {
    const { ctx, parts } = this;
    this.raf = 0;
    const step = this.last ? Math.min(3, (now - this.last) / 16.667) : 1;
    this.last = now;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    // on the dark page the mist is light: 'screen' adds up like light does, without burning out where puffs overlap
    ctx.globalCompositeOperation = this.light ? 'source-over' : 'screen';
    const slow = Math.pow(0.957, step);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]!;
      if (p.wait > 0) {
        p.wait -= step;
        continue;
      }
      p.age += step;
      if (p.age > p.life) {
        parts.splice(i, 1);
        continue;
      }
      const k = p.age / p.life;
      let x = p.x;
      if (p.kind === 'wisp') {
        p.y += p.vy * step;
        p.vy *= Math.pow(0.9992, step);
        p.size *= Math.pow(p.grow, step);
        // an S that widens as it climbs, leaning with the drift of the room
        const climb = p.age * 0.021;
        x = p.x + Math.sin(p.phase + climb * 2.1) * p.sway * Math.min(1, climb * 0.9) + this.drift * p.age * 0.085;
      } else {
        // the push of the spray dies quickly; then the mist hangs, drifts with the room and rises a little
        p.vx = p.vx * slow + this.drift * 0.016 * step;
        p.vy = p.vy * slow - (p.kind === 'puff' ? 0.006 : 0.002) * step;
        p.x += (p.vx + Math.sin(p.phase + p.age * 0.03) * p.sway * 0.12) * step;
        p.y += p.vy * step;
        p.size *= Math.pow(p.grow, step);
        x = p.x;
      }
      const fade = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88;
      const sparkle = p.kind === 'speck' ? 0.55 + 0.45 * Math.sin(p.phase + p.age * 0.22) : 1;
      ctx.globalAlpha = Math.max(0, fade * p.alpha * sparkle);
      const sprite = p.kind === 'speck' ? this.bright : this.soft;
      ctx.drawImage(sprite, x - p.size, p.y - p.size, p.size * 2, p.size * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (parts.length) this.raf = requestAnimationFrame(this.tick);
    else this.last = 0;
  };

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.last = 0;
    this.parts = [];
    if (this.width) {
      this.ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }
}
