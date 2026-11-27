/**
 * Персонажи: у каждого своё стартовое оружие и небольшой уклон в характеристиках.
 * Выбор запоминается в единой записи сохранения (save.js); нет записи — первый.
 */

import { BALANCE, applyChange } from '../balance/index.js';
import { localize } from '../i18n/index.js';
import { patchSave, readSave } from './save.js';

const COLORS = { gunner: '#ffd65a', thrower: '#8fd3ff', warden: '#5dcaa5' };

/** Порядок — как в меню; оружие и уклон в характеристиках — src/balance/heroes.json. */
export const HEROES = Object.entries(COLORS).map(([id, color]) => {
  const { weapon, ...change } = BALANCE.heroes[id];
  return { id, weapon, color, apply: (player) => applyChange(player, change) };
});

for (const hero of HEROES) localize(hero, `hero.${hero.id}`, ['title', 'desc']);

export function loadHeroIndex() {
  const index = HEROES.findIndex((h) => h.id === readSave().hero);
  return index >= 0 ? index : 0;
}

export function saveHeroIndex(index) {
  patchSave({ hero: HEROES[index].id });
}

/** Применяет черты героя к свежему игроку (до мета-бонусов, которые лечат до максимума). */
export function applyHero(hero, player) {
  hero.apply(player);
  player.hp = player.maxHp;
}
