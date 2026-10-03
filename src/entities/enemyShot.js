import { CONFIG } from '../config.js';

/**
 * Снаряд врага-стрелка. Бьёт только игрока и исчезает при попадании;
 * оружие игрока его не задевает — уворачиваться, а не сбивать.
 */
export class EnemyShot {
  constructor(x, y, directionX, directionY, options = {}) {
    const defaults = CONFIG.enemyShot;

    this.x = x;
    this.y = y;
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
  }

  draw(ctx) {
    const tail = 0.04;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.x - this.vx * tail, this.y - this.vy * tail);
    ctx.lineTo(this.x, this.y);
    ctx.strokeStyle = CONFIG.colors.enemyShotTrail;
    ctx.lineWidth = this.radius * 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.colors.enemyShot;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = CONFIG.colors.enemyShotOutline;
    ctx.stroke();
    ctx.restore();
  }
}
