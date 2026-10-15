import { drawFrame } from './atlas.js';
import { DECOR_TABLE, GROUND_VARIANTS, TILE_PX } from '../art/terrain.js';

/** Хэш пары целых → число [0, 1): стабильный «случай» для каждой плитки. */
function hash2(x, y, salt) {
  let h = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1274126177, 2246822519) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function pickDecor(roll) {
  const total = DECOR_TABLE.reduce((sum, item) => sum + item.weight, 0);
  let left = roll * total;
  for (const item of DECOR_TABLE) {
    left -= item.weight;
    if (left < 0) return item.clip;
  }
  return DECOR_TABLE[0].clip;
}

/**
 * Один раз рисует всю землю мира в отдельную картинку.
 * В кадре игра только вырезает из неё окно камеры — тысячи плиток не рисуются заново.
 *
 * @param {{canvas: HTMLCanvasElement, clips: Record<string, object>}} atlas
 * @param {{width: number, height: number}} world
 * @param {{pixelScale: number, decorChance: number}} options
 * @returns {HTMLCanvasElement}
 */
export function bakeGround(atlas, world, { pixelScale, decorChance }) {
  const canvas = document.createElement('canvas');
  canvas.width = world.width;
  canvas.height = world.height;
  const ctx = canvas.getContext('2d');

  const tile = TILE_PX * pixelScale;
  const cols = Math.ceil(world.width / tile);
  const rows = Math.ceil(world.height / tile);

  const place = (clipName, x, y) => {
    const clip = atlas.clips[clipName];
    drawFrame(ctx, atlas, clip.rects[0], clip.anchor, x, y, { scale: pixelScale });
  };

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const variant = Math.floor(hash2(col, row, 1) * GROUND_VARIANTS);
      place(`ground.${variant}`, col * tile, row * tile);
    }
  }

  // Декор — поверх земли, со смещением внутри плитки, чтобы не выстраиваться в сетку.
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (hash2(col, row, 2) > decorChance) continue;
      const x = col * tile + tile * (0.25 + hash2(col, row, 3) * 0.5);
      const y = row * tile + tile * (0.4 + hash2(col, row, 4) * 0.5);
      place(pickDecor(hash2(col, row, 5)), x, y);
    }
  }

  return canvas;
}
