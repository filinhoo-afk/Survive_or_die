import { CONFIG } from '../config.js';
import { atlas } from '../art/index.js';
import { Animator } from '../gfx/animator.js';

/**
 * Снаряд врага-стрелка. Бьёт только игрока и исчезает при попадании;
 * оружие игрока его не задевает — уворачиваться, а не сбивать.
 */
export class EnemyShot {
  constructor(x, y, directionX, directionY, options = {}) {
    const defaults = CONFIG.enemyShot;

    this.x = x;
    this.y = y;
    this.animator = new Animator(atlas, 'shot.enemy');
    this.radius = options.radius ?? defaults.radius;
    this.damage = options.damage ?? defaults.damage;
    this.lifetime = options.lifetime ?? defaults.lifetime;
    this.age = 0;
    this.spent = false;

    const speed = options.speed ?? defaults.speed;
    this.vx = directionX * speed;
    this.vy = directionY * speed;
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
