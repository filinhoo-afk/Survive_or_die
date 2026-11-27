import { BALANCE } from '../balance/index.js';
import { cannon } from './cannon.js';
import { knife } from './knife.js';
import { orbit } from './orbit.js';
import { aura } from './aura.js';
import { localize } from '../i18n/index.js';

/**
 * Эволюции: оружие на максимальном уровне плюс взятая пассивка
 * превращаются в новое оружие. Поведение берётся у исходного оружия,
 * меняются характеристики и внешний вид.
 *
 *   evolvesFrom — какое оружие превращается;
 *   requires    — какая пассивка нужна (хотя бы первый ранг).
 *
 * Рецепты и характеристики лежат в src/balance/weapons.json, здесь — облик.
 *
 * Уровней у эволюции нет: это вершина ветки.
 */
export const EVOLUTIONS = [
  evolve(cannon, 'thunder', { color: '#ffd65a', icon: 'thunder', shotClip: 'shot.thunder' }),
  evolve(knife, 'blades', { color: '#ffe9a0', icon: 'blades', shotClip: 'shot.blade' }),
  evolve(orbit, 'bastion', { color: '#f2c14e', icon: 'bastion', ballClip: 'orbit.bastion' }),
  evolve(aura, 'sanctum', { color: '#ffe27a', icon: 'sanctum', auraColor: '#ffd65a' }),
];

/** Эволюция: поведение исходного оружия, новый облик и характеристики из таблицы. */
function evolve(weapon, id, look) {
  const { from, requires, base } = BALANCE.weapons.evolutions[id];
  return { ...weapon, ...look, id, evolvesFrom: from, requires, base, levels: [] };
}

for (const evolution of EVOLUTIONS) localize(evolution, `weapon.${evolution.id}`, ['title', 'description']);
