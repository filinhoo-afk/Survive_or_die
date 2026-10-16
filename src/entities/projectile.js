import { CONFIG } from '../config.js';
import { atlas } from '../art/index.js';
import { Animator } from '../gfx/animator.js';

/**
 * Снаряд любого оружия: летит по прямой, живёт ограниченное время
 * и может пробить несколько врагов подряд.
 */
export class Projectile {
  /**
   * @param {object} options
   * @param {'orb'|'knife'} [options.kind] как рисовать
   * @param {number} [options.pierce] сколько врагов пробить, прежде чем исчезнуть
   */
  constructor(x, y, directionX, directionY, options = {}) {
    const defaults = CONFIG.projectile;

    this.x = x;
    this.y = y;
    this.kind = options.kind ?? 'orb';
    this.animator = new Animator(atlas, this.kind === 'knife' ? 'shot.knife' : 'shot.orb');
    this.radius = options.radius ?? defaults.radius;
    this.damage = options.damage ?? defaults.damage;
    this.lifetime = options.lifetime ?? defaults.lifetime;
    this.pierce = options.pierce ?? 0;
    this.age = 0;
    /** Снаряд исчерпал пробитие и должен исчезнуть. */
    this.spent = false;
    /** Кого уже задел — пробивающий снаряд не бьёт одного врага дважды. */
    this.hitEnemies = new Set();

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
    const knife = this.kind === 'knife';
    this.animator.draw(ctx, this.x, this.y, {
      scale: knife ? 2 : Math.ceil(this.radius / 3.5),
      rotation: knife ? Math.atan2(this.vy, this.vx) : 0,
    });
  }
}
