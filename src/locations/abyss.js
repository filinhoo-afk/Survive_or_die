import { BALANCE } from '../balance/index.js';
import { localize } from '../i18n/index.js';

/**
 * Пятая и последняя локация: бездна. Здесь собрана толпа из всех
 * прошлых локаций — волки, призраки, танки и стрелки идут вперемешку.
 * В конце выходит финальный босс — Владыка Бездны.
 */
export const ABYSS = {
  id: 'abyss',
  /** Секунд до босса и кто тут водится — src/balance/locations.json. */
  ...BALANCE.locations.abyss,
  world: { width: 3200, height: 2000 },
  colors: {
    outside: '#050309',
    border: '#7a3fb0',
  },
  boss: 'abyssal',
  obstacles: {
    count: 55,
    seed: 40,
    clearRadius: 200,
    gap: 70,
    kinds: [
      { clip: 'obstacle.obelisk', radius: 16, scale: 5, weight: 3 },
      { clip: 'obstacle.boulder', radius: 22, scale: 4, weight: 1 },
      { clip: 'obstacle.pillar', radius: 16, scale: 5, weight: 1 },
    ],
  },
  ground: {
    palette: { a: '#15101f', b: '#1a1428', c: '#100b19', d: '#231a35' },
    decorChance: 0.16,
    decor: [
      { clip: 'decor.voidcrack', weight: 4 },
      { clip: 'decor.rune', weight: 2 },
      { clip: 'decor.skull', weight: 2 },
      { clip: 'decor.bone', weight: 1 },
    ],
  },
};

localize(ABYSS, 'location.abyss', ['title']);
