import { buildAtlas } from '../gfx/atlas.js';
import { HERO_CLIPS } from './hero.js';

/** Единый атлас игры: сюда добавляются клипы всех сущностей. */
export const atlas = buildAtlas({
  ...HERO_CLIPS,
});
