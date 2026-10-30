import type { CollectibleId } from '../game/engine/types';

export type ControlMode = 'swipe' | 'both' | 'dpad';

export interface Settings {
  music: number; // 0..1
  sfx: number; // 0..1
  haptics: boolean;
  showFps: boolean;
  controls: ControlMode;
}

export interface SaveData {
  version: 1;
  bestScore: number;
  gamesPlayed: number;
  totalScore: number;
  longestSnake: number;
  totals: Record<CollectibleId, number>;
  unlockedCards: string[];
  newCards: string[];
  seenHowTo: boolean;
  settings: Settings;
}

export const defaultSave = (): SaveData => ({
  version: 1,
  bestScore: 0,
  gamesPlayed: 0,
  totalScore: 0,
  longestSnake: 0,
  totals: { puzzle: 0, monsterCard: 0, godCard: 0, millenniumEye: 0, seal: 0 },
  unlockedCards: [],
  newCards: [],
  seenHowTo: false,
  settings: { music: 0.5, sfx: 0.8, haptics: true, showFps: false, controls: 'both' },
});

const DB = 'millennium-snake';
const STORE = 'kv';
const KEY = 'save';
const LS_KEY = 'millennium-snake:save';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<unknown> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE).objectStore(STORE).get(KEY);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function merge(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<SaveData>;
  return {
    ...d,
    ...r,
    totals: { ...d.totals, ...(r.totals ?? {}) },
    settings: { ...d.settings, ...(r.settings ?? {}) },
    unlockedCards: Array.isArray(r.unlockedCards) ? r.unlockedCards : [],
    newCards: Array.isArray(r.newCards) ? r.newCards : [],
    version: 1,
  };
}

/** Loads the save from IndexedDB, falling back to localStorage; never throws. */
export async function loadSave(): Promise<SaveData> {
  try {
    const v = await idbGet();
    if (v) return merge(v);
  } catch (err) {
    console.warn('IndexedDB unavailable, using localStorage', err);
  }
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v) return merge(JSON.parse(v));
  } catch { /* ignore */ }
  return defaultSave();
}

/** Persists to both stores (IndexedDB primary, localStorage mirror) and swallows failures. */
export async function persistSave(data: SaveData): Promise<void> {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  try { await idbSet(data); } catch (err) { console.warn('Could not persist to IndexedDB', err); }
}
