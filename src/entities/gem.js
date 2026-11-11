import { CONFIG } from '../config.js';
import { atlas } from '../art/index.js';
import { Animator } from '../gfx/animator.js';
import { Pool } from '../systems/pool.js';

/**
 * Кристалл опыта. Лежит на месте смерти врага, пока игрок не подойдёт
 * на расстояние магнита, — дальше летит к нему с ускорением.
 *
 * Берётся из пула через spawnGem, собранный возвращается в updateGems.
 */
export class Gem {
  constructor(x = 0, y = 0, value = 1) {
    this.animator = new Animator(atlas, 'gem.small');
    this.reset(x, y, value);
  }

  reset(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
    /** Крупный кристалл от толстого врага — больше и другого цвета. */
    this.big = value >= 5;
    this.animator.play(this.big ? 'gem.big' : 'gem.small', true);
    this.radius = this.big ? CONFIG.gem.radius * 1.6 : CONFIG.gem.radius;
    this.pulled = false;
    this.speed = 0;
    this.collected = false;
    // Случайная фаза покачивания, чтобы россыпь не дышала в унисон.
    this.age = Math.random() * 10;
    return this;
  }

  update(dt, player) {
    this.age += dt;

    let dx = player.x - this.x;
    let dy = player.y - this.y;
    let distance = Math.hypot(dx, dy);

    // Раз притянутый кристалл уже не отпускает, даже если игрок отбежал:
    // иначе он повиснет на полпути и будет раздражать.
    if (!this.pulled && distance < player.magnetRadius) this.pulled = true;

    if (this.pulled && distance > 0) {
      this.speed = Math.min(
        CONFIG.xp.maxPullSpeed,
        this.speed + CONFIG.xp.pullAcceleration * dt,
      );
      // Не дальше самого игрока — иначе на большой скорости перелетит его.
      const step = Math.min(distance, this.speed * dt);
      this.x += (dx / distance) * step;
      this.y += (dy / distance) * step;

      dx = player.x - this.x;
      dy = player.y - this.y;
      distance = Math.hypot(dx, dy);
    }

    if (distance <= player.radius + this.radius) this.collected = true;
  }

  draw(ctx) {
    const bob = this.pulled ? 0 : Math.sin(this.age * 4) * 1.5;
    this.animator.time = this.age;
    this.animator.draw(ctx, this.x, this.y + bob, { scale: 2 });
  }
}

export const gemPool = new Pool(() => new Gem());

/** Кристалл из пула. */
export function spawnGem(x, y, value) {
  return gemPool.obtain().reset(x, y, value);
}
