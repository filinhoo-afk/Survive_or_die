import { CONFIG } from '../config.js';
import { atlas } from '../art/index.js';
import { Animator } from '../gfx/animator.js';
import { Pool } from './pool.js';

/**
 * Записи эффектов общие для всех видов: вид задаёт, какие поля читаются.
 * Отжившие возвращаются в пул — при массовых смертях это сотни частиц
 * в секунду, и все они берутся из уже готовых объектов.
 */
export const effectPool = new Pool(() => ({ kind: '', x: 0, y: 0, age: 0, life: 1 }));

/**
 * Короткоживущие визуальные эффекты, не влияющие на игру:
 * смерть врага, повышение уровня, всплывающие надписи.
 */
export class Effects {
  constructor() {
    /** @type {object[]} */
    this.items = [];
    /** Сколько цифр урона сейчас живёт — для потолка. */
    this.damageTexts = 0;
  }

  /** Свежая запись из пула, уже в списке. */
  add(kind, x, y, life) {
    const item = effectPool.obtain();
    item.kind = kind;
    item.x = x;
    item.y = y;
    item.age = 0;
    item.life = life;
    this.items.push(item);
    return item;
  }

  /** Все эффекты — обратно в пул: новый забег начинается с чистого экрана. */
  clear() {
    effectPool.releaseAll(this.items);
    this.damageTexts = 0;
  }

  /** @param {number} [scale] размер вспышки относительно обычного врага */
  deathBurst(x, y, color, scale = 1) {
    this.spawnParticles(x, y, color, scale);
    const item = this.add('burst', x, y, CONFIG.effects.deathLife * Math.sqrt(scale));
    item.color = color;
    item.radius = CONFIG.effects.deathRadius * scale;
  }

  /** Тело убитого врага: проигрывает свой клип смерти и исчезает. */
  corpse(enemy) {
    const item = this.add('corpse', enemy.x, enemy.y, 0);
    // Проигрыватель остаётся у записи и в пуле — второй раз его не создаём.
    const clip = `${enemy.type.id}.death`;
    if (item.animator) item.animator.play(clip, true);
    else item.animator = new Animator(atlas, clip);
    const { fps, rects } = item.animator.clip;
    // Последний кадр держится ещё одну долю цикла и тает.
    item.life = (rects.length + 0.5) / fps;
    item.scale = enemy.spriteScale;
    item.flipX = enemy.facingLeft;
  }

  /** Осколки разлетаются во все стороны и тормозят о воздух. */
  spawnParticles(x, y, color, scale) {
    const cfg = CONFIG.effects.particles;
    const room = cfg.max - this.items.length;
    const count = Math.min(Math.round(cfg.perScale * scale), Math.max(0, room));
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
      const item = this.add('particle', x, y, cfg.lifeMin + Math.random() * (cfg.lifeMax - cfg.lifeMin));
      item.vx = Math.cos(angle) * speed;
      item.vy = Math.sin(angle) * speed;
      item.color = color;
      item.size = cfg.size * (0.6 + Math.random() * 0.8);
    }
  }

  /** Волна от игрока и надпись с новым уровнем. */
  levelUp(x, y, level) {
    const life = CONFIG.effects.levelUpLife;
    const ring = this.add('ring', x, y, life);
    ring.color = CONFIG.colors.levelUp;
    ring.radius = CONFIG.effects.levelUpRadius;
    const text = this.add('text', x, y - 30, life * 1.6);
    text.text = `Уровень ${level}`;
    text.color = CONFIG.colors.levelUp;
  }

  /** Цифра урона над врагом; крит — крупнее и золотая. */
  damageNumber(x, y, amount, crit) {
    const cfg = CONFIG.effects.damageText;
    if (this.damageTexts >= cfg.max) return;
    this.damageTexts += 1;
    const item = this.add('damage', x + (Math.random() - 0.5) * 14, y - 12, cfg.life * (crit ? 1.3 : 1));
    item.text = crit ? `${amount}!` : String(amount);
    item.color = crit ? CONFIG.colors.critText : CONFIG.colors.damageText;
    item.size = crit ? 22 : 14;
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const item = this.items[i];
      item.age += dt;
      if (item.kind === 'corpse') item.animator.update(dt);
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
      effectPool.release(item);
    }
  }

  draw(ctx) {
    ctx.save();

    for (const item of this.items) {
      const t = item.age / item.life;
      if (item.kind === 'corpse') drawCorpse(ctx, item, t);
      else if (item.kind === 'burst') drawBurst(ctx, item, t);
      else if (item.kind === 'particle') drawParticle(ctx, item, t);
      else if (item.kind === 'ring') drawRing(ctx, item, t);
      else if (item.kind === 'damage') drawDamage(ctx, item, t);
      else drawText(ctx, item, t);
    }

    ctx.restore();
  }
}

/** Тело стоит на месте, пока не рассыплется; в конце тает. */
function drawCorpse(ctx, item, t) {
  item.animator.draw(ctx, item.x, item.y, {
    scale: item.scale,
    flipX: item.flipX,
    alpha: t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3,
  });
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
