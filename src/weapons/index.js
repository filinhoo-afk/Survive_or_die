import { cannon } from './cannon.js';
import { knife } from './knife.js';
import { orbit } from './orbit.js';
import { aura } from './aura.js';

/** Все оружия игры в порядке, в котором они показываются игроку. */
export const WEAPONS = [cannon, knife, orbit, aura];

export const WEAPONS_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
