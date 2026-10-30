import { SnakeEngine, type RunStats } from './engine/SnakeEngine';
import { GameLoop } from './engine/GameLoop';
import type { Direction, GameEvent } from './engine/types';
import { ParticleSystem } from './effects/ParticleSystem';
import { Renderer } from './rendering/Renderer';
import type { GameArt } from './rendering/art';
import { InputController } from './input';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';

export interface SessionCallbacks {
  onScore(score: number): void;
  onAbility(charges: number, activeTicks: number): void;
  onPauseChange(paused: boolean): void;
  onDeath(stats: RunStats): void;
  onFirstMove(): void;
  onFps(fps: number): void;
}

/** Glue between engine, loop, renderer, input, audio and haptics. UI-framework agnostic. */
export class GameSession {
  readonly engine = new SnakeEngine();
  private fx = new ParticleSystem();
  private renderer: Renderer;
  private loop: GameLoop;
  private input: InputController;
  private paused = false;
  private started = false;
  private deathTimer = 0;
  private fpsAcc = 0;

  constructor(
    canvas: HTMLCanvasElement,
    gestureTarget: HTMLElement,
    art: GameArt,
    private cb: SessionCallbacks,
    cards?: { pools: SnakeEngine['cardPools']; owns(id: string): boolean; name(id: string): string },
  ) {
    if (cards) this.engine.cardPools = cards.pools;
    this.renderer = new Renderer(canvas, this.engine, this.fx, art);
    if (cards) {
      // Cards picked up earlier in this run count as owned for the sparkle/popup.
      this.renderer.ownsCard = (id, justCollected = false) =>
        cards.owns(id) || this.engine.cards.filter((c) => c === id).length > (justCollected ? 1 : 0);
      this.renderer.cardName = cards.name;
    }
    this.loop = new GameLoop({
      tickMs: () => this.engine.tickMs,
      step: () => this.step(),
      render: (a, dt, now) => {
        this.renderer.render(a, dt, now);
        this.fpsAcc += dt;
        if (this.fpsAcc > 500) { this.fpsAcc = 0; this.cb.onFps(this.loop.fps); }
      },
    });
    this.input = new InputController({
      target: gestureTarget,
      onDirection: (d) => this.turn(d),
      onPauseToggle: () => this.togglePause(),
      onAbility: () => this.useAbility(),
    });
    // Auto-pause when the page is hidden (iOS app switch, tab change).
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = (): void => {
    if (document.hidden && this.engine.phase === 'running') this.setPaused(true);
  };

  resize(w: number, h: number): number {
    return this.renderer.resize(w, h, window.devicePixelRatio || 1);
  }

  start(): void { this.loop.start(); }

  destroy(): void {
    clearTimeout(this.deathTimer);
    this.loop.stop();
    this.input.destroy();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  turn(dir: Direction): void {
    if (this.paused || this.engine.phase === 'dead') return;
    const was = this.engine.phase;
    if (this.engine.turn(dir) || this.engine.phase !== was) {
      if (!this.started && this.engine.phase === 'running') { this.started = true; this.cb.onFirstMove(); }
      haptic('light');
    }
  }

  useAbility(): void {
    if (this.paused) return;
    if (this.engine.useAbility()) { audio.play('ability'); haptic('success'); this.pushAbility(); this.flushEvents(); }
  }

  togglePause(): void { this.setPaused(!this.paused); }

  setPaused(p: boolean): void {
    if (this.engine.phase === 'dead' || p === this.paused) return;
    this.paused = p;
    this.loop.setPaused(p);
    audio.play('pause');
    this.cb.onPauseChange(p);
  }

  restart(): void {
    clearTimeout(this.deathTimer);
    this.engine.reset();
    this.fx.clear();
    this.started = false;
    this.paused = false;
    this.loop.setPaused(false);
    this.cb.onScore(0);
    this.pushAbility();
    this.cb.onPauseChange(false);
  }

  private pushAbility(): void {
    this.cb.onAbility(this.engine.abilityCharges, this.engine.abilityTicksLeft);
  }

  private step(): void {
    this.engine.step();
    this.flushEvents();
    if (this.engine.ghost) this.pushAbility();
  }

  private flushEvents(): void {
    for (const ev of this.engine.drainEvents()) this.handle(ev);
  }

  private handle(ev: GameEvent): void {
    this.renderer.onEvent(ev);
    switch (ev.type) {
      case 'eat':
        this.cb.onScore(this.engine.score);
        if (ev.item.type === 'godCard') { audio.play('god'); haptic('heavy'); }
        else if (ev.item.type === 'monsterCard') { audio.play('bonus'); haptic('medium'); }
        else if (ev.item.type === 'millenniumEye') { audio.play('eye'); haptic('success'); }
        else if (ev.item.type === 'seal') { audio.play('god'); haptic('heavy'); }
        else { audio.play('eat'); haptic('light'); }
        this.pushAbility();
        break;
      case 'levelUp': audio.play('levelUp'); break;
      case 'abilityStart': case 'abilityEnd': case 'abilityCharge': this.pushAbility(); break;
      case 'die':
        audio.play('die'); haptic('error');
        this.deathTimer = window.setTimeout(() => this.cb.onDeath(this.engine.stats()), 1100);
        break;
      default: break;
    }
  }
}
