import { describe, expect, it } from 'vitest';
import { CARDS, CARD_POOLS, newCardsFromRun } from '../src/services/cards';
import { defaultSave } from '../src/services/storage';

const stats = (cards: string[]) => ({
  score: 0, length: 4, level: 0, cards,
  collected: { puzzle: 0, monsterCard: cards.length, godCard: 0, millenniumEye: 0, seal: 0 },
});

describe('deck cards', () => {
  it('has the whole deck plus the Seal', () => {
    expect(CARDS.length).toBe(55);
    expect(CARDS.some((c) => c.id === 'the-seal-of-orichalcos')).toBe(true);
  });

  it('pickup pools include every non-god card (owned or not) and gods only for God Cards', () => {
    const monsters = new Set(CARD_POOLS.monsterCard);
    expect(monsters.size).toBe(CARDS.filter((c) => c.type !== 'god' && c.type !== 'field').length);
    expect(new Set(CARD_POOLS.godCard)).toEqual(new Set(CARDS.filter((c) => c.type === 'god').map((c) => c.id)));
  });

  it('rarer cards appear less often in the pool', () => {
    const count = (id: string) => CARD_POOLS.monsterCard.filter((x) => x === id).length;
    expect(count('kuriboh')).toBeGreaterThan(count('dark-magician'));
  });

  it('unlocks only cards not owned yet, once each, in pickup order', () => {
    const save = { ...defaultSave(), unlockedCards: ['kuriboh'] };
    expect(newCardsFromRun(save, stats(['kuriboh', 'sangan', 'sangan', 'exchange']))).toEqual(['sangan', 'exchange']);
  });
});
