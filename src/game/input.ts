import type { Direction } from './engine/types';

export interface InputOptions {
  /** Element that receives drag/swipe gestures (the game canvas wrapper). */
  target: HTMLElement;
  onDirection(dir: Direction): void;
  onPauseToggle(): void;
  onAbility(): void;
  /** Drag distance (CSS px) required before a direction is registered. */
  dragThreshold?: number;
}

const KEY_MAP: Record<string, Direction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right',
};

/**
 * Keyboard (arrows / WASD) for laptops; touch & mouse *drag anywhere* for phones.
 * While a finger stays down, every time it travels `dragThreshold` px the gesture is
 * re-anchored, so continuous dragging steers the snake turn-by-turn (no lift needed).
 */
export class InputController {
  private anchor: { x: number; y: number } | null = null;
  private pointerId: number | null = null;
  private readonly threshold: number;

  constructor(private o: InputOptions) {
    this.threshold = o.dragThreshold ?? 18;
    window.addEventListener('keydown', this.onKey);
    o.target.addEventListener('pointerdown', this.onDown);
    o.target.addEventListener('pointermove', this.onMove);
    o.target.addEventListener('pointerup', this.onUp);
    o.target.addEventListener('pointercancel', this.onUp);
    o.target.addEventListener('touchmove', this.block, { passive: false });
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    const t = this.o.target;
    t.removeEventListener('pointerdown', this.onDown);
    t.removeEventListener('pointermove', this.onMove);
    t.removeEventListener('pointerup', this.onUp);
    t.removeEventListener('pointercancel', this.onUp);
    t.removeEventListener('touchmove', this.block);
  }

  private block = (e: Event) => e.preventDefault();

  private onKey = (e: KeyboardEvent): void => {
    if (e.repeat && (e.key === ' ' || e.key === 'Escape' || e.key === 'p')) return;
    const dir = KEY_MAP[e.key];
    if (dir) { e.preventDefault(); this.o.onDirection(dir); return; }
    if (e.key === ' ' || e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      this.o.onPauseToggle();
    } else if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
      this.o.onAbility();
    }
  };

  private onDown = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).closest('button')) return;
    this.pointerId = e.pointerId;
    this.anchor = { x: e.clientX, y: e.clientY };
    try { this.o.target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  private onMove = (e: PointerEvent): void => {
    if (this.pointerId !== e.pointerId || !this.anchor) return;
    const dx = e.clientX - this.anchor.x;
    const dy = e.clientY - this.anchor.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < this.threshold) return;
    const dir: Direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.o.onDirection(dir);
    this.anchor = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent): void => {
    if (this.pointerId === e.pointerId) { this.pointerId = null; this.anchor = null; }
  };
}
