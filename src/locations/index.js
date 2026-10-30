import { WASTELAND } from './wasteland.js';
import { FOREST } from './forest.js';
import { RUINS } from './ruins.js';
import { GLACIER } from './glacier.js';

/**
 * Все локации игры. Локация — только данные: мир, палитра земли, декор,
 * список врагов и длительность. Код ничего не знает про конкретную локацию.
 */
export const LOCATIONS = {
  [WASTELAND.id]: WASTELAND,
  [FOREST.id]: FOREST,
  [RUINS.id]: RUINS,
  [GLACIER.id]: GLACIER,
};

export const LOCATION_LIST = Object.values(LOCATIONS);
export const DEFAULT_LOCATION = WASTELAND;
