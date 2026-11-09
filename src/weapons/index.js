import { cannon } from './cannon.js';
import { knife } from './knife.js';
import { orbit } from './orbit.js';
import { aura } from './aura.js';
import { EVOLUTIONS } from './evolutions.js';

/** Все оружия игры в порядке, в котором они показываются игроку. */
export const WEAPONS = [cannon, knife, orbit, aura];

export { EVOLUTIONS };

/** Базовые оружия и их эволюции — по id. */
export const WEAPONS_BY_ID = Object.fromEntries(
  [...WEAPONS, ...EVOLUTIONS].map((w) => [w.id, w]),
);
