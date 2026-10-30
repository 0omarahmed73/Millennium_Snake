/**
 * Fixed-timestep loop on requestAnimationFrame. Simulation steps happen at the
 * engine's tick rate regardless of display FPS; `alpha` (0..1) is handed to the
 * renderer for smooth interpolation between grid positions.
 */
export interface LoopHandlers {
  tickMs(): number;
  step(): void;
  render(alpha: number, dtMs: number, nowMs: number): void;
}

export class GameLoop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private paused = false;
  private running = false;
  fps = 0;
  private fpsFrames = 0;
  private fpsTime = 0;

  constructor(private h: LoopHandlers) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setPaused(p: boolean): void {
    this.paused = p;
    this.last = performance.now();
  }

  get isPaused(): boolean { return this.paused; }

  private frame = (now: number): void => {
    if (!this.running) return;
    // Clamp huge gaps (tab switch) so the snake never "catches up" in one burst.
    const dt = Math.min(100, now - this.last);
    this.last = now;

    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 500) {
      this.fps = Math.round((this.fpsFrames * 1000) / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    if (!this.paused) {
      this.acc += dt;
      const tick = this.h.tickMs();
      let guard = 0;
      while (this.acc >= tick && guard++ < 4) {
        this.h.step();
        this.acc -= tick;
      }
      if (guard >= 4) this.acc = 0;
    }
    this.h.render(this.paused ? this.acc / this.h.tickMs() : Math.min(1, this.acc / this.h.tickMs()), dt, now);
    this.raf = requestAnimationFrame(this.frame);
  };
}
