import { Projectile } from '../entities/projectile.js';
import { nearestEnemies } from '../systems/targeting.js';

/** Автопушка: сама бьёт по ближайшим врагам в радиусе. */
export const cannon = {
  id: 'cannon',
  title: 'Пушка',
  description: 'Сама стреляет в ближайшего врага',
  color: '#9ad8ff',
  icon: 'bullet',
  base: {
    cooldown: 0.55,
    damage: 20,
    range: 430,
    speed: 540,
    count: 1,
    pierce: 0,
  },
  levels: [
    { text: 'Урон +25%', show: 'damage', apply: (s) => { s.damage *= 1.25; } },
    { text: 'Второй снаряд по второй цели', show: 'count', apply: (s) => { s.count += 1; } },
    { text: 'Стреляет на 20% чаще', show: 'cooldown', apply: (s) => { s.cooldown *= 0.8; } },
    { text: 'Снаряды пробивают одного врага', show: 'pierce', apply: (s) => { s.pierce += 1; } },
  ],

  fire(stats, { player, enemies, projectiles }) {
    if (!player.alive) return false;

    const targets = nearestEnemies(player, enemies, stats.range, stats.count);
    if (targets.length === 0) return false;

    // Целей меньше, чем снарядов, — лишние летят в тех же по кругу.
    for (let i = 0; i < stats.count; i += 1) {
      const target = targets[i % targets.length];
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const distance = Math.hypot(dx, dy) || 1;

      projectiles.push(
        new Projectile(player.x, player.y, dx / distance, dy / distance, {
          damage: stats.damage,
          speed: stats.speed,
          pierce: stats.pierce,
        }),
      );
    }

    return true;
  },
};
