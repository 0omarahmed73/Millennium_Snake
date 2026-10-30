/** Pooled particle + floating text system. Draw order is handled by the Renderer. */
export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  kind: 'spark' | 'ring' | 'dust';
  drag: number;
}

export interface Popup { x: number; y: number; text: string; life: number; max: number; color: string; size: number }

export class ParticleSystem {
  particles: Particle[] = [];
  popups: Popup[] = [];
  private readonly cap = 400;

  burst(x: number, y: number, count: number, colors: string[], speed = 120, size = 3): void {
    for (let i = 0; i < count && this.particles.length < this.cap; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.8);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0, max: 0.45 + Math.random() * 0.45,
        size: size * (0.6 + Math.random() * 0.8),
        color: colors[(Math.random() * colors.length) | 0], kind: 'spark', drag: 2.2,
      });
    }
  }

  ring(x: number, y: number, color: string, size: number): void {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.5, size, color, kind: 'ring', drag: 0 });
  }

  dust(x: number, y: number, color: string): void {
    if (this.particles.length >= this.cap) return;
    this.particles.push({
      x, y, vx: (Math.random() - 0.5) * 6, vy: -4 - Math.random() * 8,
      life: 0, max: 3 + Math.random() * 3, size: 0.8 + Math.random() * 1.4, color, kind: 'dust', drag: 0,
    });
  }

  popup(x: number, y: number, text: string, color: string, size: number): void {
    this.popups.push({ x, y, text, life: 0, max: 0.9, color, size });
  }

  update(dt: number): void {
    const s = dt / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += s;
      if (p.life >= p.max) { this.particles.splice(i, 1); continue; }
      const k = Math.max(0, 1 - p.drag * s);
      p.vx *= k; p.vy *= k;
      p.x += p.vx * s; p.y += p.vy * s;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life += s;
      if (p.life >= p.max) this.popups.splice(i, 1);
    }
  }

  clear(): void { this.particles.length = 0; this.popups.length = 0; }
}
