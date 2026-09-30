/**
 * До count ближайших живых врагов в радиусе, от ближнего к дальнему.
 * Сравниваем квадраты расстояний — без извлечения корней.
 */
export function nearestEnemies(from, enemies, maxRange, count) {
  const limit = maxRange * maxRange;
  const inRange = [];

  for (const enemy of enemies) {
    if (enemy.alive === false) continue;
    const dx = enemy.x - from.x;
    const dy = enemy.y - from.y;
    const distance = dx * dx + dy * dy;
    if (distance < limit) inRange.push({ enemy, distance });
  }

  inRange.sort((a, b) => a.distance - b.distance);
  return inRange.slice(0, count).map((entry) => entry.enemy);
}
