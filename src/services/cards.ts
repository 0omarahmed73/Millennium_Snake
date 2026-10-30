import type { SaveData } from './storage';
import type { RunStats } from '../game/engine/SnakeEngine';
import { DECK, type DeckCard, type DeckCardType } from './deck.generated';

export type Rarity = DeckCard['rarity'];
export type CardKind = 'monsters' | 'spells' | 'traps';

export interface CardDef extends DeckCard {
  kind: CardKind;
  typeLabel: string;
  requirement: string;
  /** Milestone unlock; cards without one are drawn from in-game card pickups. */
  milestone?: (s: SaveData) => boolean;
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#cbb98f', rare: '#4fa6ff', epic: '#b48cff', legendary: '#F3D27A',
};

const TYPE_LABEL: Record<DeckCardType, string> = {
  normal: 'Normal Monster', effect: 'Effect Monster', fusion: 'Fusion Monster', ritual: 'Ritual Monster',
  spell: 'Spell Card', trap: 'Trap Card', god: 'Egyptian God', field: 'Field Spell',
};

const MILESTONES: Record<string, [string, (s: SaveData) => boolean]> = {
  kuriboh: ['Play your first duel', (s) => s.gamesPlayed >= 1],
  'dark-magician': ['Reach a score of 150', (s) => s.bestScore >= 150],
  'dark-magician-girl': ['Reach a score of 300', (s) => s.bestScore >= 300],
  'pot-of-greed': ['Collect 25 Millennium Puzzles', (s) => s.totals.puzzle >= 25],
  'monster-reborn': ['Play 5 duels', (s) => s.gamesPlayed >= 5],
  polymerization: ['Grow a dragon of length 20', (s) => s.longestSnake >= 20],
  'mirror-force': ['Collect 3 Millennium Eyes', (s) => s.totals.millenniumEye >= 3],
  'the-seal-of-orichalcos': ['Collect the Seal of Orichalcos in the temple', (s) => (s.totals.seal ?? 0) >= 1],
};

const kindOf = (t: DeckCardType): CardKind => (t === 'spell' || t === 'field' ? 'spells' : t === 'trap' ? 'traps' : 'monsters');

export const CARDS: CardDef[] = DECK.map((c) => {
  const m = MILESTONES[c.id];
  return {
    ...c,
    kind: kindOf(c.type),
    typeLabel: TYPE_LABEL[c.type],
    requirement: m ? m[0] : c.type === 'god' ? 'Collect an Egyptian God Card in the temple' : 'Draw it from a Monster Card in the temple',
    milestone: m?.[1],
  };
});

export const cardById = (id: string): CardDef | undefined => CARDS.find((c) => c.id === id);
export const cardImage = (c: CardDef, unlocked: boolean) => (unlocked ? `/cards/${c.id}.webp` : '/art/card-locked.webp');

export function evaluateUnlocks(save: SaveData): string[] {
  return CARDS.filter((c) => c.milestone?.(save) && !save.unlockedCards.includes(c.id)).map((c) => c.id);
}

/**
 * What card pickups can show in the temple: every card, owned or still locked, can
 * appear again and again. God Card pickups show one of the three Egyptian Gods.
 * Rarer cards are listed fewer times so they turn up less often.
 */
const COPIES: Record<Rarity, number> = { common: 4, rare: 3, epic: 2, legendary: 1 };
const pool = (cards: CardDef[]) => cards.flatMap((c) => Array<string>(COPIES[c.rarity]).fill(c.id));
export const CARD_POOLS = {
  monsterCard: pool(CARDS.filter((c) => c.type !== 'god' && c.type !== 'field')),
  godCard: pool(CARDS.filter((c) => c.type === 'god')),
};

/** Cards picked up in a run that the player did not own yet (each once, in pickup order). */
export function newCardsFromRun(save: SaveData, stats: RunStats): string[] {
  const owned = new Set(save.unlockedCards);
  return stats.cards.filter((id) => cardById(id) && !owned.has(id) && (owned.add(id), true));
}
