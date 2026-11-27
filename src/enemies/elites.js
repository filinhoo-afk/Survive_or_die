/**
 * Элитные враги: обычный враг с одним модификатором.
 *
 * Элита крупнее, живучее и щедрее на опыт; модификатор добавляет свою
 * особенность и цвет ободка под ногами, по которому её видно издалека.
 * Множители и шанс появления лежат в src/balance/elites.json, здесь — цвета.
 */
import { BALANCE } from '../balance/index.js';
import { localize } from '../i18n/index.js';
import { random } from '../systems/rng.js';

export const ELITE = BALANCE.elites.elite;

const MODIFIER_COLORS = { armored: '#9aa6bd', swift: '#4cc9f0', brutal: '#f2786a', rich: '#ffd34e' };

export const ELITE_MODIFIERS = Object.fromEntries(
  Object.entries(MODIFIER_COLORS).map(([id, color]) => [
    id,
    { id, color, ...BALANCE.elites.modifiers[id] },
  ]),
);

for (const modifier of Object.values(ELITE_MODIFIERS)) localize(modifier, `elite.${modifier.id}`, ['title']);

/** Случайный модификатор: все равновероятны. */
export function rollModifier() {
  const all = Object.values(ELITE_MODIFIERS);
  return all[Math.floor(random('spawn') * all.length)];
}

/** Шанс, что новый враг окажется элитой, через `seconds` секунд забега. */
export function eliteChance(seconds) {
  if (seconds < ELITE.from) return 0;
  const minutes = seconds / 60;
  return Math.min(ELITE.maxChance, ELITE.chance + ELITE.chancePerMinute * (minutes - ELITE.from / 60));
}
