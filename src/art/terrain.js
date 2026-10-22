import { LOCATION_LIST } from '../locations/index.js';

/**
 * Земля: плитки 16×16 и мелкий декор.
 *
 *   ground.<локация>.0…3 — четыре варианта плитки для каждой локации;
 *   decor.tuft / decor.stone / decor.bone / decor.skull — украшения поверх земли.
 *
 * Плитки собираются кодом из зерна: основа одного цвета и россыпь пятен,
 * у каждого варианта своя. Расклад по карте — в gfx/ground.js.
 */

export const TILE_PX = 16;
export const GROUND_VARIANTS = 4;

/** Небольшой детерминированный генератор — чтобы плитки не менялись между запусками. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGroundTile(variant) {
  const random = mulberry32(1000 + variant * 77);
  const rows = [];
  for (let y = 0; y < TILE_PX; y += 1) {
    let row = '';
    for (let x = 0; x < TILE_PX; x += 1) {
      const roll = random();
      if (roll < 0.1) row += 'd';
      else if (roll < 0.28) row += 'b';
      else if (roll < 0.4) row += 'c';
      else row += 'a';
    }
    rows.push(row);
  }
  return rows;
}

const TUFT = [
  '.g..g.g.',
  '.g.gg.g.',
  'gg.gggg.',
  '.ggggg..',
  '..hgg...',
  '...h....',
];

const STONE = [
  '..oooo..',
  '.olllmo.',
  'ollmmmdo',
  'olmmmddo',
  '.oddddo.',
  '..oooo..',
];

const BONE = [
  'ww....ww',
  '.wwwwww.',
  'ww....ww',
];

const SKULL = [
  '..oooo..',
  '.owwwwo.',
  'owwwwwwo',
  'owkwwkwo',
  'owwwwwwo',
  '.owkkwo.',
  '..owwo..',
];

const DECOR_PALETTE = {
  g: '#3f6b34',
  h: '#2a4624',
  o: '#0e120d',
  l: '#8b93a0',
  m: '#6c7482',
  d: '#434a58',
  w: '#d8d2bd',
  k: '#2b2a26',
};

export const TERRAIN_CLIPS = {
  ...Object.fromEntries(
    LOCATION_LIST.flatMap((location) =>
      Array.from({ length: GROUND_VARIANTS }, (_, i) => [
        `ground.${location.id}.${i}`,
        { palette: location.ground.palette, frames: [buildGroundTile(i)], anchor: { x: 0, y: 0 } },
      ]),
    ),
  ),
  'decor.tuft': { palette: DECOR_PALETTE, frames: [TUFT] },
  'decor.stone': { palette: DECOR_PALETTE, frames: [STONE] },
  'decor.bone': { palette: DECOR_PALETTE, frames: [BONE] },
  'decor.skull': { palette: DECOR_PALETTE, frames: [SKULL] },
};
