import { CONFIG } from '../config.js';

/** Снаряд летит по прямой и живёт ограниченное время. */
export class Projectile {
  constructor(x, y, directionX, directionY, damage = CONFIG.weapon.damage) {
    this.x = x;
    this.y = y;
    this.radius = CONFIG.projectile.radius;
    this.damage = damage;
    this.age = 0;
    this.lifetime = CONFIG.projectile.lifetime;

    const speed = CONFIG.projectile.speed;
    this.vx = directionX * speed;
    this.vy = directionY * speed;
  }

  get expired() {
    return this.age >= this.lifetime;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.age += dt;
  }

  draw(ctx) {
    // Короткий хвост в сторону, откуда снаряд прилетел: на быстром
    // движении одна точка читается хуже, чем отрезок.
    const tail = 0.03;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.x - this.vx * tail, this.y - this.vy * tail);
    ctx.lineTo(this.x, this.y);
    ctx.strokeStyle = CONFIG.colors.projectileTrail;
    ctx.lineWidth = this.radius * 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.colors.projectile;
    ctx.fill();
    ctx.restore();
  }
}
