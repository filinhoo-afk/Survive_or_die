import { CONFIG } from '../config.js';

/** Простейший враг: всегда бежит по прямой к игроку. */
export class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = CONFIG.enemy.radius;
    this.speed = CONFIG.enemy.speed;
    this.angle = 0;
  }

  update(dt, target) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);

    // Стоим на месте, если уже вплотную: иначе деление на ноль и дрожание.
    if (distance < 0.001) return;

    this.x += (dx / distance) * this.speed * dt;
    this.y += (dy / distance) * this.speed * dt;
    this.angle = Math.atan2(dy, dx);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Ромб остриём вперёд — силуэт, который не спутать с круглым игроком.
    ctx.beginPath();
    ctx.moveTo(this.radius * 1.3, 0);
    ctx.lineTo(0, this.radius * 0.8);
    ctx.lineTo(-this.radius * 0.9, 0);
    ctx.lineTo(0, -this.radius * 0.8);
    ctx.closePath();

    ctx.fillStyle = CONFIG.enemy.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = CONFIG.enemy.outline;
    ctx.stroke();

    ctx.restore();
  }
}

/**
 * Расталкивает врагов, стоящих друг в друге.
 * Без этого вся толпа сходится в одну точку и выглядит как один враг.
 * Перебор пар по квадрату приемлем на десятках врагов; на сотнях
 * это место придётся переписать на пространственную сетку.
 */
export function separate(enemies) {
  for (let i = 0; i < enemies.length; i += 1) {
    for (let j = i + 1; j < enemies.length; j += 1) {
      const a = enemies[i];
      const b = enemies[j];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minDistance = a.radius + b.radius;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared >= minDistance * minDistance) continue;

      const distance = Math.sqrt(distanceSquared) || 0.001;
      // Половину нахлёста забирает каждый — так пара расходится симметрично.
      const push = (minDistance - distance) / 2;
      const nx = (dx / distance) * push;
      const ny = (dy / distance) * push;

      a.x -= nx;
      a.y -= ny;
      b.x += nx;
      b.y += ny;
    }
  }
}
