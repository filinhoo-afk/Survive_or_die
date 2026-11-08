/**
 * Персонажи: у каждого своё стартовое оружие и небольшой уклон в характеристиках.
 * Выбор запоминается в localStorage; любая ошибка хранилища — берём первого.
 */

const STORAGE_KEY = 'survive-or-die:hero';

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
  try {
    const index = HEROES.findIndex((h) => h.id === localStorage.getItem(STORAGE_KEY));
    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
}

export function saveHeroIndex(index) {
  try {
    localStorage.setItem(STORAGE_KEY, HEROES[index].id);
  } catch {
    // Не сохранилось — выбор проживёт до перезагрузки.
  }
}

/** Применяет черты героя к свежему игроку (до мета-бонусов, которые лечат до максимума). */
export function applyHero(hero, player) {
  hero.apply?.(player);
  player.hp = player.maxHp;
}
