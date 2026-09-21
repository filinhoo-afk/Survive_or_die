import { CONFIG } from '../config.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = CONFIG.player.radius;
    this.speed = CONFIG.player.speed;
    this.facing = { x: 0, y: 1 };
  }

  update(dt, input, bounds) {
    const axis = input.getAxis();

    this.x += axis.x * this.speed * dt;
    this.y += axis.y * this.speed * dt;

    if (axis.x !== 0 || axis.y !== 0) this.facing = axis;

    // Пока мир размером с экран — просто не выпускаем игрока за края.
    this.x = clamp(this.x, this.radius, bounds.width - this.radius);
    this.y = clamp(this.y, this.radius, bounds.height - this.radius);
  }

  draw(ctx) {
    ctx.save();

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.colors.player;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = CONFIG.colors.playerOutline;
    ctx.stroke();

    // Короткий «нос» показывает, куда смотрит игрок.
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(
      this.x + this.facing.x * this.radius * 1.6,
      this.y + this.facing.y * this.radius * 1.6,
    );
    ctx.strokeStyle = CONFIG.colors.player;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
