import { CONFIG } from '../config.js';

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
  }

  draw(ctx) {
    if (this.kind === 'knife') drawKnife(ctx, this);
    else drawOrb(ctx, this);
  }
}

function drawOrb(ctx, shot) {
  // Короткий хвост в сторону, откуда снаряд прилетел: на быстром
  // движении одна точка читается хуже, чем отрезок.
  const tail = 0.03;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(shot.x - shot.vx * tail, shot.y - shot.vy * tail);
  ctx.lineTo(shot.x, shot.y);
  ctx.strokeStyle = CONFIG.colors.projectileTrail;
  ctx.lineWidth = shot.radius * 2;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
  ctx.fillStyle = CONFIG.colors.projectile;
  ctx.fill();
  ctx.restore();
}

/** Клинок остриём по направлению полёта, с рукоятью сзади. */
function drawKnife(ctx, shot) {
  ctx.save();
  ctx.translate(shot.x, shot.y);
  ctx.rotate(Math.atan2(shot.vy, shot.vx));

  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.lineTo(0, -3);
  ctx.lineTo(-4, 0);
  ctx.lineTo(0, 3);
  ctx.closePath();
  ctx.fillStyle = CONFIG.colors.knife;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = CONFIG.colors.knifeEdge;
  ctx.stroke();

  ctx.fillStyle = CONFIG.colors.knifeHandle;
  ctx.fillRect(-10, -1.5, 6, 3);

  ctx.restore();
}
