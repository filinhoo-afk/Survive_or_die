/**
 * Урон игроку от касания врагов.
 *
 * Достаточно найти одно касание: после попадания включается неуязвимость,
 * и остальные враги в этом кадре всё равно не пройдут.
 */
export function applyContactDamage(player, enemies) {
  if (!player.alive || player.invulnerableFor > 0) return null;

  for (const enemy of enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const reach = player.radius + enemy.radius;

    if (dx * dx + dy * dy <= reach * reach) {
      return player.takeDamage(enemy.damage) ? enemy : null;
    }
  }

  return null;
}

/**
 * Попадания снарядов во врагов. Снаряд с пробитием летит дальше,
 * пока не исчерпает его; каждого врага он задевает только раз.
 *
 * Пролететь врага насквозь между кадрами снаряд не может: самый быстрый,
 * нож, за шаг физики смещается на 640 / 60 ≈ 11 пикселей, а зона
 * попадания не меньше 18.
 *
 * @returns {Array} враги, убитые в этом кадре, — для эффектов смерти
 */
export function resolveProjectileHits(projectiles, enemies) {
  const killed = [];

  for (const shot of projectiles) {
    if (shot.expired) continue;

    for (const enemy of enemies) {
      if (!enemy.alive || shot.hitEnemies.has(enemy)) continue;

      const dx = enemy.x - shot.x;
      const dy = enemy.y - shot.y;
      const reach = enemy.radius + shot.radius;
      if (dx * dx + dy * dy > reach * reach) continue;

      shot.hitEnemies.add(enemy);
      const speed = Math.hypot(shot.vx, shot.vy) || 1;
      if (enemy.takeHit(shot.damage, shot.vx / speed, shot.vy / speed)) {
        killed.push(enemy);
      }

      if (shot.pierce > 0) {
        shot.pierce -= 1;
        continue;
      }

      shot.spent = true;
      break;
    }
  }

  return killed;
}

/** Убирает мёртвых врагов заменой последним, как и снаряды. */
export function removeDead(enemies) {
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    if (enemies[i].alive) continue;
    enemies[i] = enemies[enemies.length - 1];
    enemies.pop();
  }
}
