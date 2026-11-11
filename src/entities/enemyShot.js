import { CONFIG } from '../config.js';
import { atlas } from '../art/index.js';
import { Animator } from '../gfx/animator.js';
import { Pool } from '../systems/pool.js';

/**
 * Снаряд врага-стрелка. Бьёт только игрока и исчезает при попадании;
 * оружие игрока его не задевает — уворачиваться, а не сбивать.
 *
 * Берётся из пула через spawnEnemyShot.
 */
export class EnemyShot {
  constructor(x = 0, y = 0, directionX = 1, directionY = 0, options = {}) {
    this.animator = new Animator(atlas, 'shot.enemy');
    this.reset(x, y, directionX, directionY, options);
  }

  reset(x, y, directionX, directionY, options = {}) {
    const defaults = CONFIG.enemyShot;

    this.x = x;
    this.y = y;
    this.animator.time = 0;
    this.radius = options.radius ?? defaults.radius;
    this.damage = options.damage ?? defaults.damage;
    this.lifetime = options.lifetime ?? defaults.lifetime;
    this.age = 0;
    this.spent = false;

    const speed = options.speed ?? defaults.speed;
    this.vx = directionX * speed;
    this.vy = directionY * speed;
    return this;
  }

  get expired() {
    return this.spent || this.age >= this.lifetime;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.age += dt;
    this.animator.update(dt);
  }

  draw(ctx) {
    this.animator.draw(ctx, this.x, this.y, { scale: Math.ceil(this.radius / 3.5) });
  }
}

export const enemyShotPool = new Pool(() => new EnemyShot());

/** Вражеский снаряд из пула; аргументы — как у конструктора. */
export function spawnEnemyShot(x, y, directionX, directionY, options) {
  return enemyShotPool.obtain().reset(x, y, directionX, directionY, options);
}
