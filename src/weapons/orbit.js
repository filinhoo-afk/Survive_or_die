import { CONFIG } from '../config.js';

/**
 * Орбитальный щит: шары кружат вокруг игрока и бьют всех, кого задевают.
 *
 * Каждого врага шары бьют не чаще раза в hitInterval — иначе враг,
 * застрявший в шаре, получал бы урон 60 раз в секунду.
 */
export const orbit = {
  id: 'orbit',
  title: 'Щит',
  description: 'Шары кружат вокруг и бьют всех, кого заденут',
  color: '#5dcaa5',
  icon: 'orbit',
  layer: 'over',
  base: {
    count: 2,
    damage: 10,
    /**
     * Расстояние от игрока до центра шара. Заметно больше радиуса ауры (75):
     * иначе при обоих оружиях их кольца сливаются в одно.
     */
    radius: 95,
    orbSize: 9,
    /** Радиан в секунду. */
    rotation: 3,
    hitInterval: 0.5,
  },
  levels: [
    { text: 'Третий шар', show: 'count', apply: (s) => { s.count += 1; } },
    { text: 'Урон +40%', show: 'damage', apply: (s) => { s.damage *= 1.4; } },
    {
      text: 'Орбита шире на 20% и вращается быстрее',
      show: 'radius',
      apply: (s) => {
        s.radius *= 1.2;
        s.rotation *= 1.3;
      },
    },
    { text: 'Ещё два шара', show: 'count', apply: (s) => { s.count += 2; } },
  ],

  createState: () => ({
    angle: 0,
    time: 0,
    /** Враг → момент, когда его снова можно ударить. */
    nextHit: new WeakMap(),
  }),

  tick(weapon, dt, { player, enemies, killed }) {
    const { stats, state } = weapon;
    state.time += dt;
    state.angle += stats.rotation * dt;
    if (!player.alive) return;

    for (const orb of orbPositions(stats, state, player)) {
      for (const enemy of enemies) {
        if (!enemy.alive || (state.nextHit.get(enemy) ?? 0) > state.time) continue;

        const dx = enemy.x - orb.x;
        const dy = enemy.y - orb.y;
        const reach = enemy.radius + stats.orbSize;
        if (dx * dx + dy * dy > reach * reach) continue;

        state.nextHit.set(enemy, state.time + stats.hitInterval);

        // Отбрасываем от игрока, а не от шара: щит расчищает пространство.
        const ox = enemy.x - player.x;
        const oy = enemy.y - player.y;
        const distance = Math.hypot(ox, oy) || 1;
        if (enemy.takeHit(stats.damage, ox / distance, oy / distance)) killed.push(enemy);
      }
    }
  },

  draw(weapon, ctx, { player }) {
    const { stats, state } = weapon;

    ctx.save();
    ctx.setLineDash([4, 8]);
    ctx.strokeStyle = CONFIG.colors.orbitTrack;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(player.x, player.y, stats.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const orb of orbPositions(stats, state, player)) {
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, stats.orbSize, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.colors.orbit;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0b0e14';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(orb.x - 3, orb.y - 3, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#e1f5ee';
      ctx.fill();
    }

    ctx.restore();
  },
};

/** Шары равномерно разнесены по окружности. */
function orbPositions(stats, state, player) {
  return Array.from({ length: stats.count }, (_, i) => {
    const angle = state.angle + (i / stats.count) * Math.PI * 2;
    return {
      x: player.x + Math.cos(angle) * stats.radius,
      y: player.y + Math.sin(angle) * stats.radius,
    };
  });
}
