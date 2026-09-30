import { Projectile } from '../entities/projectile.js';

/**
 * Метательный нож: летит туда, куда смотрит игрок, и пробивает насквозь.
 * В отличие от пушки, им нужно целиться — собственным движением.
 */
export const knife = {
  id: 'knife',
  title: 'Нож',
  description: 'Летит по направлению взгляда и пробивает врагов насквозь',
  color: '#e6f1ff',
  icon: 'knife',
  base: {
    cooldown: 0.9,
    damage: 14,
    speed: 640,
    lifetime: 0.6,
    count: 1,
    pierce: 2,
    /** Угол между ножами в веере, радианы. */
    spread: 0.2,
  },
  levels: [
    { text: 'Второй нож веером', show: 'count', apply: (s) => { s.count += 1; } },
    { text: 'Урон +40%', show: 'damage', apply: (s) => { s.damage *= 1.4; } },
    {
      text: 'Третий нож, пробивают ещё одного врага',
      show: 'count',
      apply: (s) => {
        s.count += 1;
        s.pierce += 1;
      },
    },
    { text: 'Бросает на 30% чаще', show: 'cooldown', apply: (s) => { s.cooldown *= 0.7; } },
  ],

  // Нож бросается всегда, даже без врагов рядом: игрок целится сам.
  fire(stats, { player, projectiles }) {
    if (!player.alive) return false;

    const heading = Math.atan2(player.facing.y, player.facing.x);

    for (let i = 0; i < stats.count; i += 1) {
      const angle = heading + (i - (stats.count - 1) / 2) * stats.spread;
      projectiles.push(
        new Projectile(player.x, player.y, Math.cos(angle), Math.sin(angle), {
          kind: 'knife',
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
