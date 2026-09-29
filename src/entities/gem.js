import { CONFIG } from '../config.js';

/**
 * Кристалл опыта. Лежит на месте смерти врага, пока игрок не подойдёт
 * на расстояние магнита, — дальше летит к нему с ускорением.
 */
export class Gem {
  constructor(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.radius = CONFIG.gem.radius;
    this.pulled = false;
    this.speed = 0;
    this.collected = false;
    // Случайная фаза покачивания, чтобы россыпь не дышала в унисон.
    this.age = Math.random() * 10;
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
    const x = this.x;
    const y = this.y + bob;
    const r = this.radius;

    ctx.save();

    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.4);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r * 1.4);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fillStyle = CONFIG.colors.gem;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = CONFIG.colors.gemOutline;
    ctx.stroke();

    // Светлая верхняя грань — без неё ромб читается как плоская метка.
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.4);
    ctx.lineTo(x + r * 0.55, y - r * 0.2);
    ctx.lineTo(x - r * 0.55, y - r * 0.2);
    ctx.closePath();
    ctx.fillStyle = CONFIG.colors.gemLight;
    ctx.fill();

    ctx.restore();
  }
}
