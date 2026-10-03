import { CONFIG } from '../config.js';

/**
 * Короткоживущие визуальные эффекты, не влияющие на игру:
 * смерть врага, повышение уровня, всплывающие надписи.
 */
export class Effects {
  constructor() {
    this.items = [];
  }

  /** @param {number} [scale] размер вспышки относительно обычного врага */
  deathBurst(x, y, color, scale = 1) {
    this.items.push({
      kind: 'burst',
      x,
      y,
      color,
      age: 0,
      life: CONFIG.effects.deathLife * Math.sqrt(scale),
      radius: CONFIG.effects.deathRadius * scale,
    });
  }

  /** Волна от игрока и надпись с новым уровнем. */
  levelUp(x, y, level) {
    const life = CONFIG.effects.levelUpLife;
    this.items.push({
      kind: 'ring',
      x,
      y,
      color: CONFIG.colors.levelUp,
      age: 0,
      life,
      radius: CONFIG.effects.levelUpRadius,
    });
    this.items.push({
      kind: 'text',
      x,
      y: y - 30,
      text: `Уровень ${level}`,
      color: CONFIG.colors.levelUp,
      age: 0,
      life: life * 1.6,
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
      if (item.kind === 'burst') drawBurst(ctx, item, t);
      else if (item.kind === 'ring') drawRing(ctx, item, t);
      else drawText(ctx, item, t);
    }

    ctx.restore();
  }
}

/** Смерть врага: сначала белая вспышка, потом гаснущее кольцо. */
function drawBurst(ctx, item, t) {
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

/** Кольцо уровня быстро разлетается и медленно гаснет. */
function drawRing(ctx, item, t) {
  const eased = 1 - (1 - t) ** 3;
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = item.color;
  ctx.lineWidth = 2 + 6 * (1 - t);
  ctx.beginPath();
  ctx.arc(item.x, item.y, item.radius * eased, 0, Math.PI * 2);
  ctx.stroke();
}

/** Надпись всплывает вверх и тает во второй половине жизни. */
function drawText(ctx, item, t) {
  ctx.globalAlpha = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
  ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#0b0e14';
  const y = item.y - 24 * t;
  ctx.strokeText(item.text, item.x, y);
  ctx.fillStyle = item.color;
  ctx.fillText(item.text, item.x, y);
}
