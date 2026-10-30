/**
 * Screen layouts taken 1:1 from the concept sheet (design/concept.webp).
 * Every coordinate is in concept-sheet pixels, local to its panel; ArtStage
 * converts them to percentages so overlays line up with the art at any size.
 * Panel images are produced by scripts/extract_art.py.
 */
import type { CSSProperties } from 'react';

export type Rect = readonly [x0: number, y0: number, x1: number, y1: number];

export interface PanelDef { src: string; w: number; h: number }

export const PANELS = {
  menu: { src: '/art/panel-menu.webp', w: 335, h: 815 },
  game: { src: '/art/panel-game.webp', w: 342, h: 815 },
  over: { src: '/art/panel-over.webp', w: 315, h: 815 },
  collection: { src: '/art/panel-collection.webp', w: 339, h: 416 },
  settings: { src: '/art/panel-settings.webp', w: 333, h: 416 },
  howto: { src: '/art/panel-howto.webp', w: 299, h: 416 },
} satisfies Record<string, PanelDef>;

export const MENU = {
  start: [31, 547, 306, 611],
  collection: [67, 625, 274, 673],
  settings: [67, 681, 274, 728],
  credits: [67, 737, 274, 784],
  dragonEye: [228, 38, 268, 78],
  torches: [[0, 470, 60, 560], [275, 470, 335, 560], [0, 720, 55, 815], [280, 720, 335, 815]],
} as const;

export const GAME = {
  scoreText: [13, 24, 108, 57],
  bestText: [196, 24, 281, 54],
  pause: [288, 8, 333, 53],
  floor: [41, 70, 306, 695],
  dpad: [11, 687, 126, 802],
  ability: [246, 705, 338, 805],
  abilityRing: [252, 711, 330, 789],
  abilityCount: [309, 766, 333, 796],
} as const;

export const OVER = {
  score: [104, 362, 204, 404],
  best: [109, 434, 209, 470],
  counts: [[58, 582, 88, 604], [117, 582, 147, 604], [174, 582, 204, 604], [233, 582, 263, 604]],
  newBest: [195, 366, 279, 405],
  playAgain: [21, 645, 299, 710],
  mainMenu: [61, 725, 266, 780],
  dragonEye: [212, 52, 252, 92],
} as const;

export const COLLECTION = {
  back: [11, 5, 44, 44],
  tabs: [[16, 50, 89, 87], [96, 50, 168, 87], [176, 50, 248, 87], [254, 50, 328, 87]],
  cols: [[16, 88], [96, 168], [176, 248], [255, 328]],
  rows: [[92, 192], [200, 301], [307, 408]],
} as const;

export const SETTINGS = {
  back: [18, 10, 49, 41],
  music: [150, 70, 275, 96],
  sfx: [150, 115, 275, 141],
  toggles: [[218, 166, 263, 196], [218, 210, 263, 240], [218, 252, 263, 282]],
  dragIcon: [44, 254, 74, 283],
  dragLabel: [79, 254, 210, 283],
} as const;

export const HOWTO = {
  back: [11, 10, 42, 41],
  controlText: [109, 175, 290, 214],
  avoidText: [109, 309, 290, 336],
  gotIt: [37, 356, 267, 407],
} as const;

/** Absolute-position style for a rect inside a panel. */
export function at(p: PanelDef, r: Rect | readonly number[]): CSSProperties {
  const [x0, y0, x1, y1] = r;
  return {
    position: 'absolute',
    left: `${(x0 / p.w) * 100}%`,
    top: `${(y0 / p.h) * 100}%`,
    width: `${((x1 - x0) / p.w) * 100}%`,
    height: `${((y1 - y0) / p.h) * 100}%`,
  };
}

/** Background that shows exactly the panel pixels under `r` (so a button can be pressed/scaled). */
export function slice(p: PanelDef, r: Rect | readonly number[]): CSSProperties {
  const [x0, y0, x1, y1] = r;
  const w = x1 - x0, h = y1 - y0;
  return {
    ...at(p, r),
    backgroundImage: `url(${p.src})`,
    backgroundSize: `${(p.w / w) * 100}% ${(p.h / h) * 100}%`,
    backgroundPosition: `${(x0 / (p.w - w)) * 100}% ${(y0 / (p.h - h)) * 100}%`,
  };
}

/** Font size in container-query units relative to the panel width (1 concept px). */
export const px = (p: PanelDef, n: number) => `${(n / p.w) * 100}cqw`;

export const ALL_ART = [
  ...Object.values(PANELS).map((p) => p.src),
  ...['head-up', 'head-right', 'head-down', 'head-left', 'body-strip', 'tail', 'puzzle', 'monsterCard', 'godCard',
    'millenniumEye', 'pillar', 'column', 'torch', 'fx-gold', 'fx-blue', 'fx-red', 'fx-spark', 'tile-0', 'tile-1', 'tile-2',
    'btn-primary', 'btn-secondary', 'tab-on', 'tab-off', 'toggle-on', 'toggle-off', 'slider-thumb', 'new-best', 'icon-dpad',
    'card-locked', 'card-dragon', 'card-sorcerer', 'card-keeper', 'card-warrior', 'card-jester', 'card-pharaoh',
    'card-puzzle', 'card-eye', 'card-god', 'card-guardian', 'card-flame', 'card-heart'].map((n) => `/art/${n}.webp`),
];
