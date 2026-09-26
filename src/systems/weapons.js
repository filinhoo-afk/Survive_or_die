import { CONFIG } from '../config.js';
import { Projectile } from '../entities/projectile.js';

/**
 * Автопушка: сама выбирает ближайшего врага в радиусе и стреляет в него.
 * Игрок не целится — он только решает, куда бежать.
 */
export class AutoCannon {
  constructor(config = CONFIG.weapon) {
    this.cooldown = config.cooldown;
    this.range = config.range;
    this.damage = config.damage;
    this.timer = 0;
  }

  /** @returns {Projectile|null} выстрел этого кадра, если он был */
  update(dt, player, enemies, projectiles) {
    this.timer = Math.max(0, this.timer - dt);

    if (!player.alive || this.timer > 0) return null;

    const target = findNearestEnemy(player, enemies, this.range);

    // Целей нет — кулдаун не тратим. Иначе враг, вошедший в радиус
    // сразу после холостого выстрела, ждал бы полный откат.
    if (!target) return null;

    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const distance = Math.hypot(dx, dy) || 1;

    const shot = new Projectile(player.x, player.y, dx / distance, dy / distance, this.damage);
    projectiles.push(shot);
    this.timer = this.cooldown;

    return shot;
  }
}

/** Ближайший враг в радиусе, или null. Сравниваем квадраты — без корней. */
export function findNearestEnemy(from, enemies, maxRange) {
  let best = null;
  let bestDistance = maxRange * maxRange;

  for (const enemy of enemies) {
    const dx = enemy.x - from.x;
    const dy = enemy.y - from.y;
    const distance = dx * dx + dy * dy;

    if (distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }

  return best;
}

/** Убирает отжившие снаряды и улетевшие за пределы мира. */
export function pruneProjectiles(projectiles, world) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const shot = projectiles[i];
    const outside =
      shot.x < 0 || shot.x > world.width || shot.y < 0 || shot.y > world.height;

    // Замена последним вместо splice: порядок снарядов не важен,
    // а удаление из середины перестаёт двигать весь хвост массива.
    if (shot.expired || outside) {
      projectiles[i] = projectiles[projectiles.length - 1];
      projectiles.pop();
    }
  }
}
