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
