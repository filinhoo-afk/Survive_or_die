/**
 * Персонажи: у каждого своё стартовое оружие и небольшой уклон в характеристиках.
 * Выбор запоминается в единой записи сохранения (save.js); нет записи — первый.
 */

import { patchSave, readSave } from './save.js';

export const HEROES = [
  { id: 'gunner', title: 'Стрелок', weapon: 'cannon', desc: 'Пушка · без изъянов', color: '#ffd65a' },
  {
    id: 'thrower',
    title: 'Метатель',
    weapon: 'knife',
    desc: 'Нож · +10% скорости, -15 здоровья',
    color: '#8fd3ff',
    apply: (p) => {
      p.speed *= 1.1;
      p.maxHp -= 15;
    },
  },
  {
    id: 'warden',
    title: 'Страж',
    weapon: 'orbit',
    desc: 'Щит · +30 здоровья, -8% скорости',
    color: '#5dcaa5',
    apply: (p) => {
      p.maxHp += 30;
      p.speed *= 0.92;
    },
  },
];

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
