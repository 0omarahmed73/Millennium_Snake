import { describe, expect, it } from 'vitest';
import { SnakeEngine } from '../src/game/engine/SnakeEngine';
import { COLLECTIBLES } from '../src/game/engine/config';

const make = (cfg = {}) => new SnakeEngine({ obstacleCount: 0, bonusChance: 0, ...cfg }, 1234);

describe('SnakeEngine', () => {
  it('starts as a straight snake heading up', () => {
    const e = make();
    expect(e.segments).toHaveLength(e.config.startLength);
    expect(e.direction).toBe('up');
    expect(e.phase).toBe('ready');
  });

  it('moves one cell per step in the facing direction', () => {
    const e = make();
    const h = { ...e.head };
    e.turn('right'); e.step();
    expect(e.head).toEqual({ x: h.x + 1, y: h.y });
    expect(e.segments).toHaveLength(e.config.startLength);
  });

  it('rejects immediate reversal, including through the input queue', () => {
    const e = make();
    expect(e.turn('down')).toBe(false);
    expect(e.turn('right')).toBe(true);
    expect(e.turn('left')).toBe(false); // opposite of queued 'right'
    e.step();
    expect(e.direction).toBe('right');
  });

  it('buffers quick consecutive turns (up -> right -> down) without self-collision', () => {
    const e = make();
    e.turn('right'); e.turn('down');
    e.step(); e.step();
    expect(e.phase).toBe('running');
    expect(e.direction).toBe('down');
  });

  it('wraps through the side walls by default', () => {
    const e = make();
    e.turn('right');
    for (let i = 0; i < e.config.cols; i++) e.step();
    expect(e.phase).toBe('running');
    expect(e.head.x).toBe(Math.floor(e.config.cols / 2));
  });

  it('dies on wall collision when wrapping is disabled', () => {
    const e = make({ wrapWalls: false });
    e.turn('up');
    for (let i = 0; i < 40 && e.phase !== 'dead'; i++) e.step();
    expect(e.phase).toBe('dead');
    expect(e.drainEvents().some((ev) => ev.type === 'die' && ev.reason === 'wall')).toBe(true);
  });

  it('dies on self collision', () => {
    const e = make({ startLength: 6 });
    e.turn('right'); e.step();
    e.turn('down'); e.step();
    e.turn('left'); e.step();
    e.turn('up'); e.step();
    expect(e.phase).toBe('dead');
  });

  it('allows moving into the cell the tail is vacating', () => {
    const e = make({ startLength: 4 });
    e.turn('right'); e.step();
    e.turn('down'); e.step();
    e.turn('left'); e.step(); // head now where tail was
    expect(e.phase).toBe('running');
  });

  it('eats a puzzle: scores 10, grows by one, spawns another', () => {
    const e = make();
    const h = e.head;
    e.items = [{ id: 99, type: 'puzzle', pos: { x: h.x, y: h.y - 1 }, ttl: null, ttlMax: null }];
    e.turn('up'); e.step();
    expect(e.score).toBe(COLLECTIBLES.puzzle.points);
    e.step();
    expect(e.segments).toHaveLength(e.config.startLength + 1);
    expect(e.items.some((i) => i.type === 'puzzle')).toBe(true);
    expect(e.collected.puzzle).toBe(1);
  });

  it('never spawns items on the snake or obstacles', () => {
    const e = new SnakeEngine({ obstacleCount: 8 }, 7);
    for (let i = 0; i < 200; i++) {
      const it = e.spawnItem('monsterCard');
      if (!it) break;
      expect(e.obstacles.some((o) => o.x === it.pos.x && o.y === it.pos.y)).toBe(false);
      expect(e.segments.some((s) => s.x === it.pos.x && s.y === it.pos.y)).toBe(false);
    }
  });

  it('speeds up with level and respects the minimum tick', () => {
    const e = make();
    const t0 = e.tickMs;
    e.level = 3;
    expect(e.tickMs).toBeLessThan(t0);
    e.level = 999;
    expect(e.tickMs).toBe(e.config.minTickMs);
  });

  it('ghost form wraps walls and ignores own body', () => {
    const e = make({ wrapWalls: false });
    e.start();
    e.abilityCharges = 1;
    expect(e.useAbility()).toBe(true);
    e.turn('left');
    for (let i = 0; i < e.config.cols + 2; i++) e.step();
    expect(e.phase).toBe('running');
  });

  it('is deterministic for the same seed', () => {
    const a = new SnakeEngine({}, 42), b = new SnakeEngine({}, 42);
    expect(a.obstacles).toEqual(b.obstacles);
    expect(a.items[0].pos).toEqual(b.items[0].pos);
  });

  it('Seal of Orichalcos doubles points for a limited time, then ends', () => {
    const e = make({ sealTicks: 5 });
    const h = e.head;
    e.items = [
      { id: 1, type: 'seal', pos: { x: h.x, y: h.y - 1 }, ttl: null, ttlMax: null },
      { id: 2, type: 'puzzle', pos: { x: h.x, y: h.y - 2 }, ttl: null, ttlMax: null },
    ];
    e.turn('up'); e.step();
    expect(e.sealActive).toBe(true);
    expect(e.score).toBe(COLLECTIBLES.seal.points);
    e.step();
    expect(e.score).toBe(COLLECTIBLES.seal.points + COLLECTIBLES.puzzle.points * 2);
    for (let i = 0; i < 6; i++) e.step();
    expect(e.sealActive).toBe(false);
    expect(e.drainEvents().map((ev) => ev.type)).toEqual(expect.arrayContaining(['sealStart', 'sealEnd']));
  });
});
