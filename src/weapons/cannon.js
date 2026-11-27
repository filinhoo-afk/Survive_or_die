import { BALANCE, weaponLevels } from '../balance/index.js';
import { spawnProjectile } from '../entities/projectile.js';
import { nearestEnemies } from '../systems/targeting.js';
import { localize, localizeLevels } from '../i18n/index.js';

/** Автопушка: сама бьёт по ближайшим врагам в радиусе. */
export const cannon = {
  id: 'cannon',
  color: '#9ad8ff',
  icon: 'bullet',
  /** Характеристики и уровни — src/balance/weapons.json. */
  base: BALANCE.weapons.weapons.cannon.base,
  levels: weaponLevels(BALANCE.weapons.weapons.cannon.levels),

  fire(stats, { player, enemyGrid, projectiles }, weapon) {
    if (!player.alive) return false;

    const targets = nearestEnemies(player, enemyGrid, stats.range, stats.count);
    if (targets.length === 0) return false;

    // Целей меньше, чем снарядов, — лишние летят в тех же по кругу.
    for (let i = 0; i < stats.count; i += 1) {
      const target = targets[i % targets.length];
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const distance = Math.hypot(dx, dy) || 1;

      projectiles.push(
        spawnProjectile(player.x, player.y, dx / distance, dy / distance, {
          damage: stats.damage,
          speed: stats.speed,
          pierce: stats.pierce,
          radius: stats.shotRadius,
          clip: weapon.definition.shotClip,
        }),
      );
    }

    return true;
  },
};

localize(cannon, 'weapon.cannon', ['title', 'description']);
localizeLevels(cannon, 'weapon.cannon');
