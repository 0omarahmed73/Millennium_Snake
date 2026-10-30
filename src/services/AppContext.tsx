import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { defaultSave, loadSave, persistSave, type SaveData, type Settings } from './storage';
import { CARDS, evaluateUnlocks, newCardsFromRun } from './cards';
import type { CollectibleId } from '../game/engine/types';
import { audio } from './audio';
import { setHapticsEnabled } from './haptics';
import type { RunStats } from '../game/engine/SnakeEngine';

export type ScreenName = 'menu' | 'game' | 'gameover' | 'collection' | 'settings' | 'credits' | 'howto';

export interface RunResult extends RunStats {
  newBest: boolean;
  previousBest: number;
  unlockedNow: string[];
}

interface AppState {
  save: SaveData;
  screen: ScreenName;
  lastRun: RunResult | null;
  navigate(to: ScreenName): void;
  recordRun(stats: RunStats): RunResult;
  updateSettings(patch: Partial<Settings>): void;
  markHowToSeen(): void;
  clearNewCards(): void;
  resetProgress(): void;
  transitioning: boolean;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

/** Drops card ids that no longer exist and grants cards the player already qualifies for. */
function migrateCards(s: SaveData): SaveData {
  const known = new Set(CARDS.map((c) => c.id));
  const base = { ...s, unlockedCards: s.unlockedCards.filter((id) => known.has(id)), newCards: s.newCards.filter((id) => known.has(id)) };
  const earned = evaluateUnlocks(base);
  return { ...base, unlockedCards: [...base.unlockedCards, ...earned], newCards: [...base.newCards, ...earned] };
}

export function AppProvider({ initial, children }: { initial: SaveData; children: ReactNode }) {
  const [save, setSave] = useState<SaveData>(() => migrateCards(initial));
  const [screen, setScreen] = useState<ScreenName>('menu');
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  // Apply settings to services whenever they change.
  useEffect(() => {
    audio.setVolumes(save.settings.music, save.settings.sfx);
    setHapticsEnabled(save.settings.haptics);
  }, [save.settings]);

  const commit = useCallback((next: SaveData) => {
    saveRef.current = next;
    setSave(next);
    void persistSave(next);
  }, []);

  const navigate = useCallback((to: ScreenName) => {
    setTransitioning(true);
    window.setTimeout(() => {
      setScreen(to);
      window.setTimeout(() => setTransitioning(false), 30);
    }, 200);
  }, []);

  const recordRun = useCallback((stats: RunStats): RunResult => {
    const cur = saveRef.current;
    const next: SaveData = {
      ...cur,
      gamesPlayed: cur.gamesPlayed + 1,
      totalScore: cur.totalScore + stats.score,
      bestScore: Math.max(cur.bestScore, stats.score),
      longestSnake: Math.max(cur.longestSnake, stats.length),
      totals: Object.fromEntries(
        Object.entries(stats.collected).map(([k, v]) => [k, (cur.totals[k as CollectibleId] ?? 0) + v]),
      ) as Record<CollectibleId, number>,
    };
    const unlockedNow = [...new Set([...evaluateUnlocks(next), ...newCardsFromRun(next, stats)])];
    next.unlockedCards = [...next.unlockedCards, ...unlockedNow];
    next.newCards = [...next.newCards, ...unlockedNow];
    const result: RunResult = { ...stats, newBest: stats.score > cur.bestScore, previousBest: cur.bestScore, unlockedNow };
    commit(next);
    setLastRun(result);
    return result;
  }, [commit]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    commit({ ...saveRef.current, settings: { ...saveRef.current.settings, ...patch } });
  }, [commit]);

  const value = useMemo<AppState>(() => ({
    save, screen, lastRun, navigate, recordRun, updateSettings, transitioning,
    markHowToSeen: () => commit({ ...saveRef.current, seenHowTo: true }),
    clearNewCards: () => commit({ ...saveRef.current, newCards: [] }),
    resetProgress: () => {
      const fresh = { ...defaultSave(), settings: saveRef.current.settings };
      commit(fresh);
      setLastRun(null);
    },
  }), [save, screen, lastRun, navigate, recordRun, updateSettings, transitioning, commit]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { loadSave };
