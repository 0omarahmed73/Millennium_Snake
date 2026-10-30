import type { SnakeEngine } from '../engine/SnakeEngine';
import type { Direction, GameEvent, Vec } from '../engine/types';
import { ParticleSystem } from '../effects/ParticleSystem';
import { ITEM_ART, type ArtName, type GameArt } from './art';

const ANGLE: Record<Direction, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
const HEAD: Record<Direction, ArtName> = { up: 'head-up', right: 'head-right', down: 'head-down', left: 'head-left' };
const FX: Record<string, ArtName> = { gold: 'fx-gold', blue: 'fx-blue', red: 'fx-red', spark: 'fx-spark' };

function mulberry(seed: number) {
  let a = seed;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Draws the temple floor, dragon, collectibles and effects using the concept-sheet sprites. */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  cell = 20;
  private dpr = 1;
  private bg: HTMLCanvasElement | null = null;
  private shakeT = 0;
  private shakeMag = 0;
  private flash = 0;
  private flashColor = '255,60,60';
  private levelPulse = 0;
  /** 0..1 visibility of the Seal of Orichalcos field overlay (eases in/out). */
  private sealFade = 0;
  private faces = new Map<string, HTMLImageElement>();
  private sealCache: { bloom: HTMLCanvasElement; inner: HTMLCanvasElement; greenGlow: HTMLCanvasElement } | null = null;
  private sealStartT = -10;
  private sealMote = 0;
  /** Whether the player already owns a deck card (set by the session; new cards sparkle). */
  ownsCard: (id: string, justCollected?: boolean) => boolean = () => true;
  /** Display names for card pickup popups. */
  cardName: (id: string) => string = (id) => id;
  private dustTimer = 0;
  private seen = new Map<number, number>();
  /** One body plate cut from the 4-plate strip. */
  private plate: { sx: number; sw: number; sh: number } = { sx: 0, sw: 1, sh: 1 };

  constructor(private canvas: HTMLCanvasElement, private engine: SnakeEngine, readonly fx: ParticleSystem, private art: GameArt) {
    this.ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
    const strip = art['body-strip'];
    this.plate = { sx: strip.naturalWidth * 0.255, sw: strip.naturalWidth * 0.245, sh: strip.naturalHeight };
  }

  get width(): number { return this.cell * this.engine.config.cols; }
  get height(): number { return this.cell * this.engine.config.rows; }

  /** Fit the board into the floor area of the panel (CSS px). Returns the cell size. */
  resize(availW: number, availH: number, dpr: number): number {
    const { cols, rows } = this.engine.config;
    this.dpr = Math.min(dpr, 2.5);
    this.cell = Math.max(8, Math.min(availW / cols, availH / rows));
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.bg = this.buildFloor();
    return this.cell;
  }

  center(v: Vec): Vec { return { x: (v.x + 0.5) * this.cell, y: (v.y + 0.5) * this.cell }; }

  onEvent(ev: GameEvent): void {
    const c = this.cell;
    switch (ev.type) {
      case 'eat': {
        const p = this.center(ev.item.pos);
        const kind = ev.item.type === 'millenniumEye' ? 'blue' : ev.item.type === 'godCard' ? 'red' : 'gold';
        const n = ev.item.type === 'godCard' ? 26 : ev.item.type === 'puzzle' ? 12 : 18;
        this.fx.burst(p.x, p.y, n, [kind, 'spark'], c * 6, c * 0.5);
        this.fx.ring(p.x, p.y, kind === 'blue' ? '#7fc4ff' : '#F3D27A', c);
        if (ev.points > 0) this.fx.popup(p.x, p.y - c * 0.4, `+${ev.points}`, ev.item.type === 'godCard' ? '#ffb0b8' : '#F3D27A', c * (ev.points >= 100 ? 0.95 : 0.7));
        if (ev.item.cardId) {
          const fresh = !this.ownsCard(ev.item.cardId, true);
          const y = Math.max(c * 1.2, p.y - c * 1.5);
          this.fx.popup(Math.min(Math.max(p.x, this.width * 0.3), this.width * 0.7), y, this.cardName(ev.item.cardId).toUpperCase(), fresh ? '#7dffb0' : '#e9e2d2', c * 0.48);
          if (fresh) this.fx.popup(Math.min(Math.max(p.x, this.width * 0.3), this.width * 0.7), y - c * 0.6, 'NEW CARD!', '#7dffb0', c * 0.55);
        }
        if (ev.item.type === 'godCard') { this.flash = 0.35; this.flashColor = '243,210,122'; }
        break;
      }
      case 'levelUp': this.levelPulse = 1; this.fx.popup(this.width / 2, this.height * 0.3, 'SPEED UP', '#7fc4ff', c * 0.75); break;
      case 'abilityStart': this.flash = 0.4; this.flashColor = '127,196,255'; break;
      case 'sealStart':
        this.sealStartT = performance.now() / 1000;
        this.flash = 0.55; this.flashColor = '90,255,150';
        this.fx.popup(this.width / 2, this.height * 0.42, 'SEAL OF ORICHALCOS', '#7dffb0', c * 0.62);
        this.fx.popup(this.width / 2, this.height * 0.42 + c * 0.9, 'POINTS ×2', '#F3D27A', c * 0.55);
        break;
      case 'sealEnd': this.fx.popup(this.width / 2, this.height * 0.42, 'THE SEAL FADES', '#7dffb0', c * 0.55); break;
      case 'die': {
        this.shakeMag = c * 0.45; this.shakeT = 0.5; this.flash = 0.55; this.flashColor = '255,60,60';
        const h = this.center(this.engine.segments[0]);
        this.fx.burst(h.x, h.y, 34, ['blue', 'spark', 'red'], c * 8, c * 0.6);
        break;
      }
      default: break;
    }
  }

  /** Dark temple slabs built from the concept tileset, lit warmly from the torch walls. */
  private buildFloor(): HTMLCanvasElement {
    const { cols, rows } = this.engine.config;
    const c = document.createElement('canvas');
    c.width = Math.round(this.width * this.dpr);
    c.height = Math.round(this.height * this.dpr);
    const x = c.getContext('2d') as CanvasRenderingContext2D;
    x.scale(this.dpr, this.dpr);
    const s = this.cell;
    const rnd = mulberry(1337);
    const tiles = [this.art['tile-0'], this.art['tile-0'], this.art['tile-1'], this.art['tile-2']];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const t = tiles[(rnd() * tiles.length) | 0];
        const flip = rnd() > 0.5;
        x.save();
        x.translate(i * s + (flip ? s : 0), j * s);
        x.scale(flip ? -1 : 1, 1);
        x.drawImage(t, 0, 0, s, s);
        x.restore();
      }
    }
    // Sand tiles -> dark slate: multiply with obsidian-blue, then add warm torch light from the side walls.
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = '#3c3a4c';
    x.fillRect(0, 0, this.width, this.height);
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = 'rgba(16,14,26,.18)';
    x.fillRect(0, 0, this.width, this.height);
    x.globalCompositeOperation = 'screen';
    for (const [gx, gy] of [[0, 0.14], [1, 0.14], [0, 0.55], [1, 0.55], [0.5, 1.02]]) {
      const cx = gx * this.width, cy = gy * this.height;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, s * 5);
      g.addColorStop(0, 'rgba(255,160,60,.30)');
      g.addColorStop(1, 'rgba(255,160,60,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, this.width, this.height);
    }
    x.globalCompositeOperation = 'source-over';
    // inner shadow where the floor meets the walls
    const edge = x.createLinearGradient(0, 0, s * 0.6, 0);
    edge.addColorStop(0, 'rgba(0,0,0,.45)'); edge.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = edge; x.fillRect(0, 0, s * 0.6, this.height);
    x.save(); x.translate(this.width, 0); x.scale(-1, 1); x.fillRect(0, 0, s * 0.6, this.height); x.restore();
    return c;
  }

  render(alpha: number, dt: number, now: number): void {
    if (!this.bg) return;
    const ctx = this.ctx;
    const e = this.engine;
    const s = this.cell;
    const t = now / 1000;
    this.fx.update(dt);
    this.dustTimer += dt;
    if (this.dustTimer > 300) { this.dustTimer = 0; this.fx.dust(Math.random() * this.width, this.height * (0.4 + Math.random() * 0.6), 'rgba(243,210,122,.7)'); }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, this.width, this.height);

    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt / 1000;
      const m = this.shakeMag * Math.max(0, this.shakeT / 0.5);
      sx = (Math.random() - 0.5) * 2 * m; sy = (Math.random() - 0.5) * 2 * m;
    }
    ctx.save();
    ctx.translate(sx, sy);
    ctx.drawImage(this.bg, 0, 0, this.width, this.height);
    this.drawSealField(dt, t);

    // obstacles: stone pillars from the tileset, anchored to the bottom of their cell
    e.obstacles.forEach((o, i) => {
      const img = this.art[i % 3 === 2 ? 'column' : 'pillar'];
      const h = s * 1.6, w = h * (img.naturalWidth / img.naturalHeight);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.ellipse((o.x + 0.5) * s, (o.y + 0.92) * s, s * 0.45, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(img, (o.x + 0.5) * s - w / 2, (o.y + 1) * s - h, w, h);
    });

    this.drawItems(now);
    this.drawSnake(alpha, t);

    // particles
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.fx.particles) {
      const k = 1 - p.life / p.max;
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color; ctx.globalAlpha = k * 0.8; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.3 + (1 - k) * 1.6), 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === 'dust') {
        ctx.globalAlpha = Math.sin((1 - k) * Math.PI) * 0.5; ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      } else {
        const img = this.art[FX[p.color] ?? 'fx-spark'];
        const size = p.size * 2 * (0.4 + k * 0.6);
        ctx.globalAlpha = k;
        ctx.drawImage(img, p.x - size / 2, p.y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of this.fx.popups) {
      const k = p.life / p.max;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `700 ${p.size * (1 + (1 - k) * 0.25)}px Cinzel, serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,12,4,.9)';
      const y = p.y - k * s * 1.5;
      ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, y);
    }
    ctx.globalAlpha = 1;

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flash})`; ctx.fillRect(0, 0, this.width, this.height);
      this.flash = Math.max(0, this.flash - dt / 700);
    }
    if (this.levelPulse > 0) {
      ctx.strokeStyle = `rgba(127,196,255,${this.levelPulse * 0.8})`; ctx.lineWidth = 3 + this.levelPulse * 5;
      ctx.strokeRect(0, 0, this.width, this.height);
      this.levelPulse = Math.max(0, this.levelPulse - dt / 600);
    }
  }

  /** Pre-rendered seal layers: a bloom of the sigil lines and the field art clipped to the circle. */
  private sealLayers(): { bloom: HTMLCanvasElement; inner: HTMLCanvasElement; greenGlow: HTMLCanvasElement } {
    if (this.sealCache) return this.sealCache;
    const S = 512;
    const bloom = document.createElement('canvas');
    bloom.width = bloom.height = S;
    const b = bloom.getContext('2d') as CanvasRenderingContext2D;
    b.globalCompositeOperation = 'lighter';
    // cheap blur: the sigil stamped around a small ring at low alpha
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r = 9 + (i % 2) * 7;
      b.globalAlpha = 0.11;
      b.drawImage(this.art.seal, Math.cos(a) * r, Math.sin(a) * r, S, S);
    }
    const inner = document.createElement('canvas');
    inner.width = inner.height = S;
    const n = inner.getContext('2d') as CanvasRenderingContext2D;
    const f = this.art.sealField;
    const side = Math.min(f.naturalWidth, f.naturalHeight);
    n.drawImage(f, (f.naturalWidth - side) / 2, (f.naturalHeight - side) / 2, side, side, 0, 0, S, S);
    n.globalCompositeOperation = 'destination-in';
    const mask = n.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.5);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    n.fillStyle = mask;
    n.fillRect(0, 0, S, S);
    const greenGlow = document.createElement('canvas');
    greenGlow.width = greenGlow.height = 128;
    const g = greenGlow.getContext('2d') as CanvasRenderingContext2D;
    const gg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gg.addColorStop(0, 'rgba(120,255,170,.8)');
    gg.addColorStop(0.4, 'rgba(60,220,120,.25)');
    gg.addColorStop(1, 'rgba(60,220,120,0)');
    g.fillStyle = gg;
    g.fillRect(0, 0, 128, 128);
    this.sealCache = { bloom, inner, greenGlow };
    return this.sealCache;
  }

  /**
   * The Seal of Orichalcos burns into the temple floor: the stone dims to a green cast,
   * the seal's smoke fills only the circle, and the glowing sigil spins in and pulses.
   * Drawn above the floor and below pillars, pickups and the dragon.
   */
  private drawSealField(dt: number, t: number): void {
    const e = this.engine, ctx = this.ctx, s = this.cell;
    const target = e.sealActive ? 1 : 0;
    this.sealFade += Math.sign(target - this.sealFade) * Math.min(Math.abs(target - this.sealFade), dt / 500);
    if (this.sealFade <= 0.001) return;
    const L = this.sealLayers();
    const W = this.width, H = this.height;
    const ending = e.sealActive && e.sealTicksLeft <= 12;
    const flick = ending ? 0.55 + 0.45 * Math.abs(Math.sin(t * 9)) : 1;
    const k = this.sealFade * flick;
    // spin-in on activation (ease-out-back), settles to a slow drift
    const p = Math.min(1, Math.max(0, (t - this.sealStartT) / 0.9));
    const intro = e.sealActive ? 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2) : 1;
    const size = W * 0.98 * Math.max(0.05, intro);
    const rot = t * 0.06 + (1 - p) * 2.4;
    const pulse = 0.82 + 0.18 * Math.sin(t * 2.6);

    ctx.save();
    // 1. the temple dims into an eerie green cast (multiply keeps the stone detail)
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = this.sealFade;
    ctx.fillStyle = '#7fa892';
    ctx.fillRect(0, 0, W, H);
    // 2. the seal's own smoke, only inside the circle
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.9 * k;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(rot * 0.5);
    ctx.drawImage(L.inner, -size / 2, -size / 2, size, size);
    ctx.rotate(rot * 0.5);
    // 3. bloom + 4. crisp sigil lines
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.65 * k * pulse;
    ctx.drawImage(L.bloom, -size / 2, -size / 2, size, size);
    ctx.globalAlpha = k;
    ctx.drawImage(this.art.seal, -size / 2, -size / 2, size, size);
    ctx.restore();

    // rising green motes while the seal holds
    if (e.sealActive) {
      this.sealMote += dt;
      if (this.sealMote > 90) {
        this.sealMote = 0;
        const a = Math.random() * Math.PI * 2, r = (0.2 + Math.random() * 0.3) * size;
        this.fx.dust(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r, 'rgba(125,255,176,.9)');
      }
      // remaining time: slim bar along the top edge
      const frac = e.sealTicksLeft / e.config.sealTicks;
      ctx.save();
      ctx.globalAlpha = 0.85 * this.sealFade;
      ctx.fillStyle = 'rgba(6,20,12,.75)';
      ctx.fillRect(s * 0.3, 3, W - s * 0.6, 3);
      ctx.fillStyle = '#7dffb0';
      ctx.fillRect(s * 0.3, 3, (W - s * 0.6) * frac, 3);
      ctx.restore();
    }
  }

  /** Lazily loads a deck card face; null until it has decoded (the generic sprite shows meanwhile). */
  private cardFace(id: string): HTMLImageElement | null {
    let img = this.faces.get(id);
    if (!img) {
      img = new Image();
      img.src = `/cards/${id}.webp`;
      this.faces.set(id, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  private drawItems(now: number): void {
    const ctx = this.ctx, s = this.cell, t = now / 1000;
    const alive = new Set<number>();
    for (const it of this.engine.items) {
      alive.add(it.id);
      if (!this.seen.has(it.id)) {
        this.seen.set(it.id, now);
        const c = this.center(it.pos);
        this.fx.ring(c.x, c.y, it.type === 'millenniumEye' ? '#7fc4ff' : '#F3D27A', s * 0.9);
      }
      const age = (now - (this.seen.get(it.id) as number)) / 1000;
      const pop = Math.min(1, age / 0.3);
      const scale = (1 - Math.pow(1 - pop, 3)) * (1 + Math.sin(t * 4 + it.id) * 0.04);
      const blink = it.ttl !== null && it.ttl <= 14 && Math.floor(t * 8) % 2 === 0;
      const c = this.center(it.pos);
      const bob = Math.sin(t * 3 + it.id) * s * 0.06;
      const img = this.art[ITEM_ART[it.type]];
      const h = s * (it.type === 'puzzle' ? 1.5 : 1.6) * scale;
      const w = h * (img.naturalWidth / img.naturalHeight);
      ctx.globalAlpha = blink ? 0.35 : 1;
      const face = it.cardId ? this.cardFace(it.cardId) : null;
      if (face) {
        // A real deck card standing on the floor: gold aura, gentle sway, sparkle if it is new.
        const ch = s * 1.75 * scale, cw = ch * (face.naturalWidth / face.naturalHeight);
        const isNew = !this.ownsCard(it.cardId as string);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (blink ? 0.2 : 0.55) * (0.75 + 0.25 * Math.sin(t * 4 + it.id));
        const auraImg = it.type === 'godCard' ? this.art['fx-red'] : this.art['fx-gold'];
        ctx.drawImage(auraImg, c.x - ch * 0.8, c.y - ch * 0.8 + bob, ch * 1.6, ch * 1.6);
        ctx.restore();
        ctx.save();
        ctx.translate(c.x, c.y + bob);
        ctx.rotate(Math.sin(t * 2 + it.id) * 0.08);
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.fillRect(-cw / 2 + 2, -ch / 2 + 3, cw, ch);
        ctx.drawImage(face, -cw / 2, -ch / 2, cw, ch);
        if (isNew) {
          ctx.globalCompositeOperation = 'lighter';
          const sp = s * (0.7 + 0.25 * Math.sin(t * 7 + it.id));
          ctx.translate(cw * 0.42, -ch * 0.44); ctx.rotate(t * 2);
          ctx.drawImage(this.art['fx-spark'], -sp / 2, -sp / 2, sp, sp);
        }
        ctx.restore();
      } else if (it.type === 'seal') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(c.x, c.y + bob); ctx.rotate(t * 0.8);
        ctx.drawImage(img, -w * 0.62, -h * 0.62, w * 1.24, h * 1.24);
        ctx.restore();
      } else {
        ctx.drawImage(img, c.x - w / 2, c.y - h / 2 + bob, w, h);
      }
      ctx.globalAlpha = 1;
    }
    for (const id of this.seen.keys()) if (!alive.has(id)) this.seen.delete(id);
  }

  private drawSnake(alpha: number, t: number): void {
    const e = this.engine, ctx = this.ctx, s = this.cell;
    const n = e.segments.length;
    const dead = e.phase === 'dead';
    const a = e.phase === 'running' ? alpha : 0;
    const { cols, rows } = e.config;
    // Unwrap the body into one continuous chain (segments that crossed an edge are
    // shifted by a board width/height so neighbours stay adjacent). The chain may
    // extend past the board; it is drawn again shifted to the opposite side below,
    // so the dragon slides out of one wall and in through the other seamlessly.
    const near = (v: number, ref: number, size: number) => {
      let d = v - ref;
      while (d > size / 2) d -= size;
      while (d < -size / 2) d += size;
      return ref + d;
    };
    const pts: Vec[] = new Array(n);
    let ux = 0, uy = 0;
    for (let i = 0; i < n; i++) {
      const cur = e.segments[i];
      const prev = e.prevSegments[i] ?? cur;
      if (i === 0) { ux = cur.x; uy = cur.y; } else { ux = near(cur.x, ux, cols); uy = near(cur.y, uy, rows); }
      const px0 = near(prev.x, ux, cols), py0 = near(prev.y, uy, rows);
      const gx = px0 + (ux - px0) * a, gy = py0 + (uy - py0) * a;
      pts[i] = { x: (gx + 0.5) * s, y: (gy + 0.5) * s };
    }
    if (!dead) {
      const wiggle = (e.phase === 'ready' ? 0.07 : 0.03) * s;
      for (let i = 1; i < n; i++) {
        const nx = pts[i - 1].x - pts[i].x, ny = pts[i - 1].y - pts[i].y;
        const l = Math.hypot(nx, ny) || 1;
        const off = Math.sin(t * 5 - i * 0.7) * wiggle * Math.min(1, i / 3);
        pts[i] = { x: pts[i].x + (-ny / l) * off, y: pts[i].y + (nx / l) * off };
      }
    }
    const W = this.width, H = this.height;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const pad = s * 1.2;
    const xs = [0, ...(minX < pad ? [W] : []), ...(maxX > W - pad ? [-W] : [])];
    const ys = [0, ...(minY < pad ? [H] : []), ...(maxY > H - pad ? [-H] : [])];
    for (const ox of xs) for (const oy of ys) {
      ctx.save();
      ctx.translate(ox, oy);
      this.drawDragon(pts, t, dead);
      ctx.restore();
    }
    // portal glow on both walls where the chain crosses an edge
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.75 + Math.sin(t * 8) * 0.15;
    const g = this.art.glow;
    for (let i = 1; i < n; i++) {
      const p = pts[i - 1], q = pts[i];
      for (const [edge, size, axis] of [[0, W, 'x'], [W, W, 'x'], [0, H, 'y'], [H, H, 'y']] as const) {
        const a0 = axis === 'x' ? p.x : p.y, a1 = axis === 'x' ? q.x : q.y;
        if ((a0 - edge) * (a1 - edge) >= 0 || a0 === a1) continue;
        const k = (edge - a0) / (a1 - a0);
        const c = axis === 'x' ? p.y + (q.y - p.y) * k : p.x + (q.x - p.x) * k;
        const other = edge === 0 ? size : 0;
        for (const at of [edge, other]) {
          const [gx, gy, gw, gh] = axis === 'x' ? [at - s * 0.6, c - s * 1.1, s * 1.2, s * 2.2] : [c - s * 1.1, at - s * 0.6, s * 2.2, s * 1.2];
          ctx.drawImage(g, gx, gy, gw, gh);
        }
      }
    }
    ctx.restore();
  }

  private drawDragon(pts: Vec[], t: number, dead: boolean): void {
    const e = this.engine, ctx = this.ctx, s = this.cell;
    const n = pts.length;
    const ghost = e.ghost;
    ctx.save();
    if (ghost) ctx.globalAlpha = 0.6 + Math.sin(t * 10) * 0.12;
    if (dead) ctx.globalAlpha = 0.8;

    // magical aura under the body
    ctx.globalCompositeOperation = 'lighter';
    const baseAlpha = ctx.globalAlpha;
    for (let i = 0; i < n; i += 2) {
      const w = s * (1.3 - (i / n) * 0.4);
      ctx.globalAlpha = baseAlpha * (ghost ? 0.5 : 0.22) * (0.7 + 0.3 * Math.sin(t * 4 - i * 0.5));
      ctx.drawImage(e.sealActive ? this.sealLayers().greenGlow : this.art.glow, pts[i].x - w, pts[i].y - w, w * 2, w * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = baseAlpha;

    const strip = this.art['body-strip'];

    // tail
    if (n > 1) {
      const p = pts[n - 1], q = pts[n - 2];
      const ang = Math.atan2(q.y - p.y, q.x - p.x);
      const img = this.art.tail;
      const h = s * 1.7, w = h * (img.naturalWidth / img.naturalHeight);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang + Math.PI / 2);
      ctx.drawImage(img, -w / 2, -h * 0.28, w, h);
      ctx.restore();
    }
    // body plates placed at even spacing along a smooth curve through the cells (concept S-curve look)
    const spacing = s * 0.42;
    const samples = this.sampleBody(pts, spacing, s);
    for (let k = samples.length - 1; k >= 0; k--) {
      const smp = samples[k];
      const f = smp.d / Math.max(1, samples[samples.length - 1].d);
      const th = s * 2.2 * (1 - 0.5 * Math.max(0, (f - 0.55) / 0.45));
      const len = spacing * 2.1;
      ctx.save(); ctx.translate(smp.x, smp.y); ctx.rotate(smp.a);
      ctx.drawImage(strip, this.plate.sx, 0, this.plate.sw, this.plate.sh, -len / 2, -th / 2, len, th);
      ctx.restore();
    }
    // head: one of the four directional sprites from the sheet
    const h0 = pts[0];
    const img = this.art[HEAD[e.direction]];
    const bob = Math.sin(t * 6) * s * 0.03;
    const big = s * 2.1;
    const ar = img.naturalWidth / img.naturalHeight;
    const w = ar >= 1 ? big : big * ar, hh = ar >= 1 ? big / ar : big;
    const v = { x: Math.cos(ANGLE[e.direction]), y: Math.sin(ANGLE[e.direction]) };
    ctx.drawImage(img, h0.x - w / 2 + v.x * s * 0.15, h0.y - hh / 2 + v.y * s * 0.15 + bob, w, hh);
    ctx.restore();
  }

  /**
   * Samples points every `spacing` px along a curve through the segment centres
   * (quadratic arcs between edge midpoints), starting just behind the head.
   * Points arrive unwrapped (continuous); any remaining jump breaks the curve. `a` points toward the head.
   */
  private sampleBody(pts: Vec[], spacing: number, s: number): { x: number; y: number; a: number; d: number }[] {
    const n = pts.length;
    if (n < 2) return [];
    const poly: Vec[] = [];
    const breaks = new Set<number>();
    const mid = (a: Vec, b: Vec) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    poly.push(mid(pts[0], pts[1]));
    for (let i = 1; i < n - 1; i++) {
      const a = mid(pts[i - 1], pts[i]), c = pts[i], b = mid(pts[i], pts[i + 1]);
      if (Math.hypot(pts[i].x - pts[i + 1].x, pts[i].y - pts[i + 1].y) > s * 1.6 || Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) > s * 1.6) {
        breaks.add(poly.length);
        poly.push(b);
        continue;
      }
      for (let k = 1; k <= 6; k++) {
        const t = k / 6, u = 1 - t;
        poly.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y });
      }
    }
    poly.push(pts[n - 1]);
    const out: { x: number; y: number; a: number; d: number }[] = [];
    let dist = 0, next = 0;
    for (let i = 1; i < poly.length; i++) {
      const p = poly[i - 1], q = poly[i];
      const seg = Math.hypot(q.x - p.x, q.y - p.y);
      if (breaks.has(i) || seg === 0) continue;
      const ang = Math.atan2(p.y - q.y, p.x - q.x);
      while (next <= dist + seg) {
        const t = (next - dist) / seg;
        out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, a: ang, d: next });
        next += spacing;
      }
      dist += seg;
    }
    return out;
  }
}
