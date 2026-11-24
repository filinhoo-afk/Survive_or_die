/**
 * Персонажи: у каждого своё стартовое оружие и небольшой уклон в характеристиках.
 * Выбор запоминается в единой записи сохранения (save.js); нет записи — первый.
 */

import { localize } from '../i18n/index.js';
import { patchSave, readSave } from './save.js';

export const HEROES = [
  { id: 'gunner', weapon: 'cannon', color: '#ffd65a' },
  {
    id: 'thrower',
   
    weapon: 'knife',
   
    color: '#8fd3ff',
    apply: (p) => {
      p.speed *= 1.1;
      p.maxHp -= 15;
    },
  },
  {
    id: 'warden',
   
    weapon: 'orbit',
   
    color: '#5dcaa5',
    apply: (p) => {
      p.maxHp += 30;
      p.speed *= 0.92;
    },
  },
];

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
  hero.apply?.(player);
  player.hp = player.maxHp;
}
