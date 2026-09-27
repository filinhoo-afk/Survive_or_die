import { CONFIG } from '../config.js';

/**
 * Короткоживущие визуальные эффекты, не влияющие на игру.
 * Пока здесь только кольцо на месте смерти врага.
 */
export class Effects {
  constructor() {
    this.items = [];
  }

  deathBurst(x, y, color) {
    this.items.push({
      x,
      y,
      color,
      age: 0,
      life: CONFIG.effects.deathLife,
      radius: CONFIG.effects.deathRadius,
    });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const item = this.items[i];
      item.age += dt;
      if (item.age < item.life) continue;
      this.items[i] = this.items[this.items.length - 1];
      this.items.pop();
    }
  }

  draw(ctx) {
    ctx.save();

    for (const item of this.items) {
      const t = item.age / item.life;

      // Первые мгновения — белая вспышка, потом расходящееся гаснущее кольцо.
      if (t < 0.35) {
        ctx.globalAlpha = 1 - t / 0.35;
        ctx.fillStyle = CONFIG.colors.enemyFlash;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1 + 3 * (1 - t);
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius * (0.4 + 0.6 * t), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
