import { CONFIG } from '../config.js';

/**
 * Аура: раз в cooldown бьёт всех врагов в радиусе вокруг игрока.
 * Урон маленький, зато по всей толпе сразу.
 */
export const aura = {
  id: 'aura',
  title: 'Аура',
  description: 'Жжёт всех врагов вокруг тебя',
  color: '#7ee787',
  icon: 'aura',
  layer: 'under',
  base: {
    radius: 75,
    damage: 6,
    /** Секунд между импульсами. */
    cooldown: 0.4,
    /** Отброс слабее обычного: иначе аура выталкивает толпу из себя. */
    knockback: 0.25,
  },
  levels: [
    { text: 'Радиус +20%', show: 'radius', apply: (s) => { s.radius *= 1.2; } },
    { text: 'Урон +50%', show: 'damage', apply: (s) => { s.damage *= 1.5; } },
    {
      text: 'Радиус +20%, импульсы на 25% чаще',
      show: 'radius',
      apply: (s) => {
        s.radius *= 1.2;
        s.cooldown *= 0.75;
      },
    },
    { text: 'Урон +50%', show: 'damage', apply: (s) => { s.damage *= 1.5; } },
  ],

  createState: () => ({ pulse: 0, time: 0 }),

  tick(weapon, dt) {
    weapon.state.time += dt;
    weapon.state.pulse = Math.max(0, weapon.state.pulse - dt * 4);
  },

  // Импульс идёт всегда, даже вокруг пусто: ритм ауры не должен сбиваться.
  fire(stats, { player, enemies, killed }, weapon) {
    if (!player.alive) return false;

    const reachLimit = stats.radius;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const reach = reachLimit + enemy.radius;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > reach * reach) continue;

      const distance = Math.sqrt(distanceSquared) || 1;
      if (enemy.takeHit(stats.damage, dx / distance, dy / distance, stats.knockback)) {
        killed.push(enemy);
      }
    }

    weapon.state.pulse = 1;
    return true;
  },

  draw(weapon, ctx, { player }, stats) {
    const { state } = weapon;

    ctx.save();
    ctx.beginPath();
    ctx.arc(player.x, player.y, stats.radius, 0, Math.PI * 2);
    // В момент импульса заливка ярче — видно ритм ударов.
    ctx.globalAlpha = 0.07 + state.pulse * 0.1;
    ctx.fillStyle = CONFIG.colors.aura;
    ctx.fill();

    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(state.time * 5) + state.pulse * 0.3;
    ctx.lineWidth = 2;
    ctx.strokeStyle = CONFIG.colors.aura;
    ctx.stroke();
    ctx.restore();
  },
};
