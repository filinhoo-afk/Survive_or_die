/**
 * Типы врагов. Класс Enemy один на всех — различаются они только данными.
 *
 * Числа (здоровье, скорость, урон, спавн) лежат в src/balance/enemies.json,
 * здесь — то, что к балансу не относится:
 *
 *   title         — имя для экрана итогов (берётся из словаря: enemy.<id>.title);
 *   color         — цвет осколков и полоски здоровья (barColor — свой цвет полоски);
 *   spriteScale   — во сколько раз увеличить пиксельный спрайт (art/enemies.js);
 *   showHealthBar — рисовать ли полоску здоровья над головой;
 *   ghost         — призрак: проходит сквозь препятствия и рисуется полупрозрачным;
 *   boss          — босс: в обычный спавн не попадает, появляется по
 *                   таймеру локации (см. entities/boss.js).
 */
import { BALANCE } from '../balance/index.js';
import { localize } from '../i18n/index.js';

/** Боссы выходят по таймеру локации: обычный спавн их не выбирает. */
const BOSS_SPAWN = { from: Infinity, weight: 0, pack: 1, wobble: 0 };

const LOOKS = {
  grunt: { color: '#f2786a', spriteScale: 3, showHealthBar: false },

  /** Рой: мелкие, быстрые, хрупкие, приходят стаей и петляют. */
  swarm: { color: '#f2c14e', spriteScale: 2, showHealthBar: false },

  /**
   * Танк: медленный, толстый, бьёт больно. Почти не отбрасывается
   * и расталкивает мелочь — за ним толпа идёт как за щитом.
   */
  tank: { color: '#b46ad0', spriteScale: 3, showHealthBar: true },

  /** Волк: быстрее игрока, кусает больно, но умирает с пары попаданий. */
  wolf: { color: '#8a919e', spriteScale: 3, showHealthBar: false },

  /** Энт: лесной великан, медленный и очень живучий. */
  treant: { color: '#3f7a3a', spriteScale: 3, showHealthBar: true },

  /**
   * Стрелок: не лезет в ближний бой, а держится на расстоянии и
   * обстреливает. Хрупкий — награда за то, что до него надо добраться.
   */
  shooter: { color: '#ff9f43', spriteScale: 3, showHealthBar: false },

  /** Призрак: проходит сквозь стены и камни, поэтому в проходах не застревает. */
  ghost: { color: '#a9c0ee', spriteScale: 3, showHealthBar: false, ghost: true },

  /** Привидение: старший призрак — крупнее, живучее, тоже сквозь стены. */
  wraith: { color: '#c49af0', spriteScale: 4, showHealthBar: true, ghost: true },

  /** Босс леса: огромный, медленный, бьёт залпами снарядов. */
  guardian: { color: '#2f8a4a', spriteScale: 6, showHealthBar: false, boss: true },

  /** Босс руин: держится на расстоянии, призывает призраков и телепортируется. */
  necromancer: { color: '#8658c4', barColor: '#9a5fe0', spriteScale: 5, showHealthBar: false, boss: true },

  /** Босс ледника: уходит под лёд и бьёт снизу там, где стоял игрок. */
  iceworm: { color: '#6fb6e6', barColor: '#6fb6e6', spriteScale: 6, showHealthBar: false, boss: true },

  /** Финальный босс бездны: три фазы — залпы, прыжки с призывом, разломы. */
  abyssal: { color: '#a24cd8', barColor: '#a24cd8', spriteScale: 6, showHealthBar: false, boss: true },
};

export const ENEMY_TYPES = Object.fromEntries(
  Object.entries(LOOKS).map(([id, look]) => [
    id,
    { id, ...(look.boss ? BOSS_SPAWN : {}), ...BALANCE.enemies.types[id], ...look },
  ]),
);

export const ENEMY_TYPE_LIST = Object.values(ENEMY_TYPES);

for (const type of ENEMY_TYPE_LIST) localize(type, `enemy.${type.id}`, ['title']);
