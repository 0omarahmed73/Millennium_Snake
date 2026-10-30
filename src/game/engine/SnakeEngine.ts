import { COLLECTIBLES, DEFAULT_CONFIG, type GameConfig } from './config';
import { createRng, type Rng } from './rng';
import {
  DIR_VEC, OPPOSITE,
  type Collectible, type CollectibleId, type Direction, type GameEvent, type GamePhase, type Vec,
} from './types';

export interface RunStats {
  score: number;
  length: number;
  level: number;
  collected: Record<CollectibleId, number>;
  /** Deck cards picked up this run, in order (duplicates allowed). */
  cards: string[];
}

/**
 * Pure, DOM-free Snake simulation. It advances in discrete grid steps via `step()`.
 * Timing (fixed timestep) lives in GameLoop, rendering in Renderer.
 */
export class SnakeEngine {
  readonly config: GameConfig;
  private rng: Rng;

  phase: GamePhase = 'ready';
  /** Segments, head first. */
  segments: Vec[] = [];
  /** Segment positions before the last step (same length as `segments`), for interpolation. */
  prevSegments: Vec[] = [];
  direction: Direction = 'up';
  /** Direction the head last moved in (reverse checks use the end of the queue). */
  private queue: Direction[] = [];
  obstacles: Vec[] = [];
  items: Collectible[] = [];
  score = 0;
  level = 0;
  collected: Record<CollectibleId, number> = { puzzle: 0, monsterCard: 0, godCard: 0, millenniumEye: 0, seal: 0 };
  /** Card ids a card pickup can show, per collectible type (owned and locked alike). */
  cardPools: Partial<Record<CollectibleId, string[]>> = {};
  cards: string[] = [];
  /** Remaining ticks of the Seal of Orichalcos field (0 = inactive). */
  sealTicksLeft = 0;
  private pendingGrowth = 0;
  private nextItemId = 1;
  abilityCharges = 0;
  abilityTicksLeft = 0;
  /** Set when the head wrapped across a board edge this step. */
  wrapped = false;
  private events: GameEvent[] = [];

  constructor(config: Partial<GameConfig> = {}, seed: number = (Math.random() * 2 ** 32) >>> 0) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = createRng(seed);
    this.reset();
  }

  reset(seed?: number): void {
    if (seed !== undefined) this.rng = createRng(seed);
    const { cols, rows, startLength } = this.config;
    const hx = Math.floor(cols / 2);
    const hy = Math.floor(rows * 0.7);
    this.segments = Array.from({ length: startLength }, (_, i) => ({ x: hx, y: hy + i }));
    this.prevSegments = this.segments.map((s) => ({ ...s }));
    this.direction = 'up';
    this.queue = [];
    this.items = [];
    this.obstacles = [];
    this.score = 0;
    this.level = 0;
    this.collected = { puzzle: 0, monsterCard: 0, godCard: 0, millenniumEye: 0, seal: 0 };
    this.sealTicksLeft = 0;
    this.cards = [];
    this.pendingGrowth = 0;
    this.abilityCharges = 0;
    this.abilityTicksLeft = 0;
    this.wrapped = false;
    this.events = [];
    this.phase = 'ready';
    this.placeObstacles();
    this.spawnItem('puzzle');
  }

  /** Current tick duration in ms, based on level. */
  get tickMs(): number {
    const { baseTickMs, minTickMs, tickStepMs } = this.config;
    return Math.max(minTickMs, baseTickMs - this.level * tickStepMs);
  }

  get head(): Vec { return this.segments[0]; }
  get ghost(): boolean { return this.abilityTicksLeft > 0; }
  get sealActive(): boolean { return this.sealTicksLeft > 0; }

  stats(): RunStats {
    return { score: this.score, length: this.segments.length, level: this.level, collected: { ...this.collected }, cards: [...this.cards] };
  }

  start(): void {
    if (this.phase === 'ready') this.phase = 'running';
  }

  /** Queue a turn. Returns false when rejected (reverse/duplicate/queue full). */
  turn(dir: Direction): boolean {
    if (this.phase === 'dead') return false;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.direction;
    if (dir === last) { this.start(); return false; }
    if (dir === OPPOSITE[last]) return false;
    if (this.queue.length >= this.config.inputBuffer) return false;
    this.queue.push(dir);
    this.start();
    return true;
  }

  /** Activate the stored ability (ghost form). */
  useAbility(): boolean {
    if (this.phase !== 'running' || this.abilityCharges <= 0 || this.ghost) return false;
    this.abilityCharges--;
    this.abilityTicksLeft = this.config.abilityTicks;
    this.events.push({ type: 'abilityStart', ticks: this.abilityTicksLeft });
    return true;
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Advance the simulation by exactly one grid step. */
  step(): void {
    if (this.phase !== 'running') return;
    const { cols, rows } = this.config;

    if (this.queue.length) this.direction = this.queue.shift() as Direction;
    const v = DIR_VEC[this.direction];
    const head = this.segments[0];
    let nx = head.x + v.x;
    let ny = head.y + v.y;
    this.wrapped = false;

    const ghost = this.ghost;
    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) {
      if (!ghost && !this.config.wrapWalls) return this.die('wall', { x: nx, y: ny });
      nx = (nx + cols) % cols;
      ny = (ny + rows) % rows;
      this.wrapped = true;
    }
    const next = { x: nx, y: ny };

    const growing = this.pendingGrowth > 0;
    // The tail cell is vacated this step unless we are growing, so moving into it is legal.
    const bodyEnd = growing ? this.segments.length : this.segments.length - 1;
    if (!ghost) {
      for (let i = 0; i < bodyEnd; i++) {
        if (this.segments[i].x === nx && this.segments[i].y === ny) return this.die('self', next);
      }
      if (this.obstacles.some((o) => o.x === nx && o.y === ny)) return this.die('obstacle', next);
    }

    // Commit move
    const old = this.segments;
    this.prevSegments = old.map((s) => ({ ...s }));
    const moved = [next, ...old.map((s) => ({ ...s }))];
    if (growing) {
      this.pendingGrowth--;
      this.prevSegments.push({ ...old[old.length - 1] });
    } else {
      moved.pop();
    }
    this.segments = moved;

    // Item pickup
    const idx = this.items.findIndex((it) => it.pos.x === nx && it.pos.y === ny);
    if (idx >= 0) this.eat(this.items.splice(idx, 1)[0]);

    // Item expiry
    for (const it of [...this.items]) {
      if (it.ttl === null) continue;
      it.ttl--;
      if (it.ttl <= 0) {
        this.items.splice(this.items.indexOf(it), 1);
        this.events.push({ type: 'expire', item: it });
      }
    }

    if (this.abilityTicksLeft > 0) {
      this.abilityTicksLeft--;
      if (this.abilityTicksLeft === 0) {
        this.events.push({ type: 'abilityEnd' });
        // Never end ghost form while inside a solid cell: extend until clear.
        if (this.insideSolid()) {
          this.abilityTicksLeft = 1;
        }
      }
    }

    if (this.sealTicksLeft > 0) {
      this.sealTicksLeft--;
      if (this.sealTicksLeft === 0) this.events.push({ type: 'sealEnd' });
    }

    if (!this.items.some((i) => i.type === 'puzzle')) this.spawnItem('puzzle');
  }

  private insideSolid(): boolean {
    const h = this.segments[0];
    if (this.obstacles.some((o) => o.x === h.x && o.y === h.y)) return true;
    for (let i = 1; i < this.segments.length; i++) {
      if (this.segments[i].x === h.x && this.segments[i].y === h.y) return true;
    }
    return false;
  }

  private eat(item: Collectible): void {
    const def = COLLECTIBLES[item.type];
    // The Seal doubles every reward while its field is active.
    const points = def.points * (this.sealActive ? 2 : 1);
    this.score += points;
    this.pendingGrowth += def.growth;
    this.collected[item.type]++;
    if (item.cardId) this.cards.push(item.cardId);
    this.events.push({ type: 'eat', item, points, head: { ...this.segments[0] } });

    if (item.type === 'seal') {
      this.sealTicksLeft = this.config.sealTicks;
      this.events.push({ type: 'sealStart', ticks: this.sealTicksLeft });
    }

    if (item.type === 'millenniumEye') {
      this.abilityCharges = Math.min(this.config.maxAbilityCharges, this.abilityCharges + 1);
      this.events.push({ type: 'abilityCharge', charges: this.abilityCharges });
    }

    const level = Math.floor(this.score / this.config.pointsPerLevel);
    if (level > this.level) {
      this.level = level;
      this.events.push({ type: 'levelUp', level });
    }

    if (item.type === 'puzzle') {
      const bonuses = this.items.filter((i) => i.type !== 'puzzle').length;
      if (bonuses < this.config.maxBonusOnBoard && this.rng() < this.config.bonusChance) {
        const type = this.pickBonus();
        if (type) this.spawnItem(type);
      }
    }
  }

  private pickBonus(): CollectibleId | null {
    // No second Seal while one is on the field or already on the board.
    const sealBusy = this.sealActive || this.items.some((i) => i.type === 'seal');
    const defs = Object.values(COLLECTIBLES).filter((d) => d.weight > 0 && !(d.id === 'seal' && sealBusy));
    const total = defs.reduce((s, d) => s + d.weight, 0);
    if (total <= 0) return null;
    let r = this.rng() * total;
    for (const d of defs) {
      r -= d.weight;
      if (r <= 0) return d.id;
    }
    return defs[defs.length - 1].id;
  }

  private die(reason: 'wall' | 'self' | 'obstacle', at: Vec): void {
    this.phase = 'dead';
    this.events.push({ type: 'die', reason, head: at });
  }

  isFree(x: number, y: number): boolean {
    if (this.segments.some((s) => s.x === x && s.y === y)) return false;
    if (this.obstacles.some((o) => o.x === x && o.y === y)) return false;
    if (this.items.some((i) => i.pos.x === x && i.pos.y === y)) return false;
    return true;
  }

  private randomFreeCell(): Vec | null {
    const { cols, rows } = this.config;
    const free: Vec[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) if (this.isFree(x, y)) free.push({ x, y });
    }
    if (!free.length) return null;
    return free[Math.floor(this.rng() * free.length)];
  }

  spawnItem(type: CollectibleId): Collectible | null {
    const pos = this.randomFreeCell();
    if (!pos) {
      this.events.push({ type: 'win' });
      return null;
    }
    const ttl = COLLECTIBLES[type].ttl;
    const pool = this.cardPools[type];
    const cardId = pool?.length ? pool[Math.floor(this.rng() * pool.length)] : undefined;
    const item: Collectible = { id: this.nextItemId++, type, pos, ttl, ttlMax: ttl, cardId };
    this.items.push(item);
    return item;
  }

  /** Obstacles are never adjacent to each other, borders, or the snake's start lane -> never walls off food. */
  private placeObstacles(): void {
    const { cols, rows, obstacleCount } = this.config;
    const startX = Math.floor(cols / 2);
    let guard = 0;
    while (this.obstacles.length < obstacleCount && guard++ < 500) {
      const x = 1 + Math.floor(this.rng() * (cols - 2));
      const y = 1 + Math.floor(this.rng() * (rows - 2));
      if (Math.abs(x - startX) <= 1 && y > Math.floor(rows * 0.7) - 8) continue;
      if (this.obstacles.some((o) => Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1)) continue;
      this.obstacles.push({ x, y });
    }
  }
}
