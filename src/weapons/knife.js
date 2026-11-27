import { BALANCE, weaponLevels } from '../balance/index.js';
import { spawnProjectile } from '../entities/projectile.js';
import { localize, localizeLevels } from '../i18n/index.js';

/**
 * Метательный нож: летит туда, куда смотрит игрок, и пробивает насквозь.
 * В отличие от пушки, им нужно целиться — собственным движением.
 */
export const knife = {
  id: 'knife',
  color: '#e6f1ff',
  icon: 'knife',
  /** Характеристики и уровни — src/balance/weapons.json. */
  base: BALANCE.weapons.weapons.knife.base,
  levels: weaponLevels(BALANCE.weapons.weapons.knife.levels),

  // Нож бросается всегда, даже без врагов рядом: игрок целится сам.
  fire(stats, { player, projectiles }, weapon) {
    if (!player.alive) return false;

    const heading = Math.atan2(player.facing.y, player.facing.x);

    for (let i = 0; i < stats.count; i += 1) {
      const angle = heading + (i - (stats.count - 1) / 2) * stats.spread;
      projectiles.push(
        spawnProjectile(player.x, player.y, Math.cos(angle), Math.sin(angle), {
          kind: 'knife',
          clip: weapon.definition.shotClip,
          radius: 6,
          damage: stats.damage,
          speed: stats.speed,
          lifetime: stats.lifetime,
          pierce: stats.pierce,
        }),
      );
    }

    return true;
  },
};

localize(knife, 'weapon.knife', ['title', 'description']);
localizeLevels(knife, 'weapon.knife');
