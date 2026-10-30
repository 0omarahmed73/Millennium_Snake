import type { CollectibleId } from '../engine/types';

/** Sprites cut from the concept sheet (public/art, see scripts/extract_art.py). Replace files to re-skin. */
const NAMES = [
  'head-up', 'head-right', 'head-down', 'head-left', 'body-strip', 'tail',
  'puzzle', 'monsterCard', 'godCard', 'millenniumEye', 'pillar', 'column',
  'fx-gold', 'fx-blue', 'fx-red', 'fx-spark', 'tile-0', 'tile-1', 'tile-2', 'seal',
] as const;

export type ArtName = (typeof NAMES)[number];
export type GameArt = Record<ArtName, HTMLImageElement> & { glow: HTMLCanvasElement; sealField: HTMLImageElement };
export const ITEM_ART: Record<CollectibleId, ArtName> = {
  puzzle: 'puzzle', monsterCard: 'monsterCard', godCard: 'godCard', millenniumEye: 'millenniumEye', seal: 'seal',
};

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function makeGlow(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(127,196,255,.8)');
  g.addColorStop(0.4, 'rgba(79,150,255,.25)');
  g.addColorStop(1, 'rgba(79,150,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return c;
}

let cache: Promise<GameArt> | null = null;

export function loadGameArt(): Promise<GameArt> {
  if (!cache) {
    cache = Promise.all([...NAMES.map((n) => load(`/art/${n}.webp`)), load('/art/seal-field.png')]).then((imgs) => {
      const art = Object.fromEntries(NAMES.map((n, i) => [n, imgs[i]])) as Record<ArtName, HTMLImageElement>;
      return { ...art, glow: makeGlow(), sealField: imgs[NAMES.length] };
    });
    cache.catch(() => { cache = null; });
  }
  return cache;
}

/** Preload every UI image so screens never pop in. Failures are non-fatal. */
export function preloadImages(urls: string[]): Promise<void> {
  return Promise.all(urls.map((u) => load(u).catch(() => null))).then(() => undefined);
}
