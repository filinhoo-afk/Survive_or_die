import { CONFIG } from '../config.js';
import { atlas } from '../art/index.js';
import { Animator } from '../gfx/animator.js';
import { Pool } from '../systems/pool.js';

/**
 * Снаряд любого оружия: летит по прямой, живёт ограниченное время
 * и может пробить несколько врагов подряд.
 *
 * Снаряды живут в пуле: новый берётся через spawnProjectile,
 * отживший возвращается в pruneProjectiles.
 */
export class Projectile {
  constructor(x = 0, y = 0, directionX = 1, directionY = 0, options = {}) {
    this.animator = new Animator(atlas, 'shot.orb');
    /** Кого уже задел — пробивающий снаряд не бьёт одного врага дважды. */
    this.hitEnemies = new Set();
    this.reset(x, y, directionX, directionY, options);
  }

  /**
   * @param {object} options
   * @param {'orb'|'knife'} [options.kind] как рисовать
   * @param {number} [options.pierce] сколько врагов пробить, прежде чем исчезнуть
   * @param {string} [options.clip] свой спрайт вместо стандартного для kind
   */
  reset(x, y, directionX, directionY, options = {}) {
    const defaults = CONFIG.projectile;

    this.x = x;
    this.y = y;
    this.kind = options.kind ?? 'orb';
    this.animator.play(options.clip ?? (this.kind === 'knife' ? 'shot.knife' : 'shot.orb'), true);
    this.radius = options.radius ?? defaults.radius;
    this.damage = options.damage ?? defaults.damage;
    this.lifetime = options.lifetime ?? defaults.lifetime;
    this.pierce = options.pierce ?? 0;
    this.age = 0;
    /** Снаряд исчерпал пробитие и должен исчезнуть. */
    this.spent = false;
    this.hitEnemies.clear();

    const speed = options.speed ?? defaults.speed;
    this.vx = directionX * speed;
    this.vy = directionY * speed;
    return this;
  }

  /** В пуле снаряд не должен держать убитых врагов. */
  recycle() {
    this.hitEnemies.clear();
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
    const knife = this.kind === 'knife';
    this.animator.draw(ctx, this.x, this.y, {
      scale: knife ? 2 : Math.ceil(this.radius / 3.5),
      rotation: knife ? Math.atan2(this.vy, this.vx) : 0,
    });
  }
}

export const projectilePool = new Pool(() => new Projectile());

/** Снаряд игрока из пула; аргументы — как у конструктора. */
export function spawnProjectile(x, y, directionX, directionY, options) {
  return projectilePool.obtain().reset(x, y, directionX, directionY, options);
}
