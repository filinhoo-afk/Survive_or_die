import { buildAtlas } from '../gfx/atlas.js';
import { HERO_CLIPS } from './hero.js';
import { ENEMY_CLIPS } from './enemies.js';
import { TERRAIN_CLIPS } from './terrain.js';
import { EFFECT_CLIPS } from './effects.js';
import { ICON_CLIPS } from './icons.js';

/** Единый атлас игры: сюда добавляются клипы всех сущностей. */
export const atlas = buildAtlas({
  ...HERO_CLIPS,
  ...ENEMY_CLIPS,
  ...TERRAIN_CLIPS,
  ...EFFECT_CLIPS,
  ...ICON_CLIPS,
});
