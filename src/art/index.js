import { buildAtlas } from '../gfx/atlas.js';
import { HERO_CLIPS } from './hero.js';
import { ENEMY_CLIPS } from './enemies.js';

/** Единый атлас игры: сюда добавляются клипы всех сущностей. */
export const atlas = buildAtlas({
  ...HERO_CLIPS,
  ...ENEMY_CLIPS,
});
