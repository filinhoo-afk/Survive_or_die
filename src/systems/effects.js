import { CONFIG } from '../config.js';

/**
 * Короткоживущие визуальные эффекты, не влияющие на игру:
 * смерть врага, повышение уровня, всплывающие надписи.
 */
export class Effects {
  constructor() {
    this.items = [];
    /** Сколько цифр урона сейчас живёт — для потолка. */
    this.damageTexts = 0;
  }

  /** @param {number} [scale] размер вспышки относительно обычного врага */
  deathBurst(x, y, color, scale = 1) {
    this.spawnParticles(x, y, color, scale);
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

  /** Осколки разлетаются во все стороны и тормозят о воздух. */
  spawnParticles(x, y, color, scale) {
    const cfg = CONFIG.effects.particles;
    const room = cfg.max - this.items.length;
    const count = Math.min(Math.round(cfg.perScale * scale), Math.max(0, room));
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
      this.items.push({
        kind: 'particle',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        age: 0,
        life: cfg.lifeMin + Math.random() * (cfg.lifeMax - cfg.lifeMin),
        size: cfg.size * (0.6 + Math.random() * 0.8),
      });
    }
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

  /** Цифра урона над врагом; крит — крупнее и золотая. */
  damageNumber(x, y, amount, crit) {
    const cfg = CONFIG.effects.damageText;
    if (this.damageTexts >= cfg.max) return;
    this.damageTexts += 1;
    this.items.push({
      kind: 'damage',
      x: x + (Math.random() - 0.5) * 14,
      y: y - 12,
      text: crit ? `${amount}!` : String(amount),
      color: crit ? CONFIG.colors.critText : CONFIG.colors.damageText,
      size: crit ? 22 : 14,
      age: 0,
      life: cfg.life * (crit ? 1.3 : 1),
    });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const item = this.items[i];
      item.age += dt;
      if (item.kind === 'particle') {
        const drag = Math.exp(-4 * dt);
        item.vx *= drag;
        item.vy *= drag;
        item.x += item.vx * dt;
        item.y += item.vy * dt;
      }
      if (item.age < item.life) continue;
      if (item.kind === 'damage') this.damageTexts -= 1;
      this.items[i] = this.items[this.items.length - 1];
      this.items.pop();
    }
  }

  draw(ctx) {
    ctx.save();

    for (const item of this.items) {
      const t = item.age / item.life;
      if (item.kind === 'burst') drawBurst(ctx, item, t);
      else if (item.kind === 'particle') drawParticle(ctx, item, t);
      else if (item.kind === 'ring') drawRing(ctx, item, t);
      else if (item.kind === 'damage') drawDamage(ctx, item, t);
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

/** Осколок — квадратик, который уменьшается и тает. */
function drawParticle(ctx, item, t) {
  const size = item.size * (1 - 0.6 * t);
  ctx.globalAlpha = 1 - t;
  ctx.fillStyle = item.color;
  ctx.fillRect(item.x - size / 2, item.y - size / 2, size, size);
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

/** Цифра быстро выскакивает вверх, замедляется и тает в конце. */
function drawDamage(ctx, item, t) {
  const eased = 1 - (1 - t) ** 3;
  ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
  ctx.font = `bold ${item.size}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0b0e14';
  const y = item.y - CONFIG.effects.damageText.rise * eased;
  ctx.strokeText(item.text, item.x, y);
  ctx.fillStyle = item.color;
  ctx.fillText(item.text, item.x, y);
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
