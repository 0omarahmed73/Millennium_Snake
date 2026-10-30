import type { CollectibleId } from './types';

export interface CollectibleDef {
  id: CollectibleId;
  label: string;
  points: number;
  /** Segments added when eaten. */
  growth: number;
  /** Relative spawn weight for *bonus* spawns (puzzle is always guaranteed). */
  weight: number;
  /** Ticks the item stays on the board (null = until eaten). */
  ttl: number | null;
}

/** Add a new entry here to introduce another collectible; the engine is data driven. */
export const COLLECTIBLES: Record<CollectibleId, CollectibleDef> = {
  puzzle: { id: 'puzzle', label: 'Millennium Puzzle', points: 10, growth: 1, weight: 0, ttl: null },
  monsterCard: { id: 'monsterCard', label: 'Monster Card', points: 25, growth: 1, weight: 6, ttl: 60 },
  godCard: { id: 'godCard', label: 'Egyptian God Card', points: 100, growth: 2, weight: 1, ttl: 40 },
  millenniumEye: { id: 'millenniumEye', label: 'Millennium Eye', points: 0, growth: 0, weight: 2, ttl: 70 },
  seal: { id: 'seal', label: 'The Seal of Orichalcos', points: 50, growth: 1, weight: 1.2, ttl: 60 },
};

export interface GameConfig {
  cols: number;
  rows: number;
  startLength: number;
  /** Tick duration at level 0, in ms. */
  baseTickMs: number;
  minTickMs: number;
  /** Tick time shaved per level. */
  tickStepMs: number;
  /** Score needed per level. */
  pointsPerLevel: number;
  /** Max queued turns (prevents lost fast inputs but avoids long queues). */
  inputBuffer: number;
  /** true: leaving the board wraps to the opposite edge instead of killing the dragon. */
  wrapWalls: boolean;
  obstacleCount: number;
  /** Chance (0-1) after each meal that a bonus collectible spawns. */
  bonusChance: number;
  maxBonusOnBoard: number;
  abilityTicks: number;
  /** Ticks the Seal of Orichalcos field stays active (points are doubled meanwhile). */
  sealTicks: number;
  maxAbilityCharges: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  cols: 9,
  rows: 21,
  startLength: 4,
  baseTickMs: 200,
  minTickMs: 85,
  tickStepMs: 9,
  pointsPerLevel: 80,
  inputBuffer: 3,
  wrapWalls: true,
  obstacleCount: 5,
  bonusChance: 0.28,
  maxBonusOnBoard: 1,
  abilityTicks: 28,
  sealTicks: 70,
  maxAbilityCharges: 3,
};
