export interface Vec { x: number; y: number }

export type Direction = 'up' | 'right' | 'down' | 'left';

export const DIR_VEC: Record<Direction, Vec> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export const OPPOSITE: Record<Direction, Direction> = {
  up: 'down', down: 'up', left: 'right', right: 'left',
};

export type CollectibleId = 'puzzle' | 'monsterCard' | 'godCard' | 'millenniumEye' | 'seal';

export interface Collectible {
  id: number;
  type: CollectibleId;
  pos: Vec;
  /** Remaining engine ticks before it vanishes; null = permanent. */
  ttl: number | null;
  /** Total lifetime (for rendering fade-out). */
  ttlMax: number | null;
  /** Deck card shown on card pickups (monster/god cards); drawn from the engine's card pools. */
  cardId?: string;
}

export type GameEvent =
  | { type: 'eat'; item: Collectible; points: number; head: Vec }
  | { type: 'levelUp'; level: number }
  | { type: 'expire'; item: Collectible }
  | { type: 'abilityCharge'; charges: number }
  | { type: 'abilityStart'; ticks: number }
  | { type: 'abilityEnd' }
  | { type: 'sealStart'; ticks: number }
  | { type: 'sealEnd' }
  | { type: 'die'; reason: 'wall' | 'self' | 'obstacle'; head: Vec }
  | { type: 'win' };

export type GamePhase = 'ready' | 'running' | 'dead';
