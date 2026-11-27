import { BALANCE, weaponLevels } from '../balance/index.js';
import { CONFIG } from '../config.js';
import { atlas } from '../art/index.js';
import { Animator } from '../gfx/animator.js';
import { localize, localizeLevels } from '../i18n/index.js';

/**
 * Орбитальный щит: шары кружат вокруг игрока и бьют всех, кого задевают.
 *
 * Каждого врага шары бьют не чаще раза в hitInterval — иначе враг,
 * застрявший в шаре, получал бы урон 60 раз в секунду.
 */
export const orbit = {
  id: 'orbit',
  color: '#5dcaa5',
  icon: 'orbit',
  layer: 'over',
  /** Характеристики и уровни — src/balance/weapons.json. */
  base: BALANCE.weapons.weapons.orbit.base,
  levels: weaponLevels(BALANCE.weapons.weapons.orbit.levels),

  createState: (definition) => ({
    angle: 0,
    time: 0,
    animator: new Animator(atlas, definition.ballClip ?? 'orbit.ball'),
    /** Враг → момент, когда его снова можно ударить. */
    nextHit: new WeakMap(),
  }),

  tick(weapon, dt, { player, enemyGrid, enemyShots, killed }, stats) {
    const { state } = weapon;
    state.time += dt;
    state.animator.update(dt);
    state.angle += stats.rotation * dt;
    if (!player.alive) return;

    for (const orb of orbPositions(stats, state, player)) {
      // Бастион гасит вражеские снаряды, которые влетели в шар.
      if (stats.blocksShots && enemyShots) {
        for (const shot of enemyShots) {
          const reach = shot.radius + stats.orbSize;
          if ((shot.x - orb.x) ** 2 + (shot.y - orb.y) ** 2 <= reach * reach) shot.spent = true;
        }
      }

      for (const enemy of enemyGrid.query(orb.x, orb.y, stats.orbSize)) {
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

  draw(weapon, ctx, { player }, stats) {
    const { state } = weapon;

    ctx.save();
    ctx.setLineDash([4, 8]);
    ctx.strokeStyle = CONFIG.colors.orbitTrack;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(player.x, player.y, stats.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const orb of orbPositions(stats, state, player)) {
      state.animator.draw(ctx, orb.x, orb.y, { scale: Math.max(1, Math.round(stats.orbSize / 4.5)) });
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

localize(orbit, 'weapon.orbit', ['title', 'description']);
localizeLevels(orbit, 'weapon.orbit');
