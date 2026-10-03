import { CONFIG } from '../config.js';
import { ENEMY_TYPES } from '../enemies/types.js';

/** Враг бежит к игроку; как именно и насколько опасен — решает его тип. */
export class Enemy {
  constructor(x, y, type = ENEMY_TYPES.grunt) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = type.radius;
    this.speed = type.speed;
    this.damage = type.damage;
    this.xp = type.xp;
    this.color = type.color;
    this.mass = type.mass;
    this.angle = 0;

    this.maxHp = type.hp;
    this.hp = this.maxHp;
    this.alive = true;
    /** Сколько секунд ещё гореть белым после попадания. */
    this.flashFor = 0;

    // Случайная фаза петляния, иначе вся стая виляет синхронно.
    this.age = Math.random() * 10;
  }

  /**
   * Попадание: урон, вспышка и отброс по направлению удара.
   * @param {number} [knockbackScale] доля обычного отброса — частые
   *   слабые удары вроде ауры отбрасывают меньше, иначе выталкивают толпу
   * @returns {boolean} убит ли враг этим попаданием
   */
  takeHit(amount, directionX, directionY, knockbackScale = 1) {
    if (!this.alive) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.flashFor = CONFIG.enemy.hitFlash;

    const push = CONFIG.enemy.knockback * knockbackScale * (1 - this.type.knockbackResist);
    this.x += directionX * push;
    this.y += directionY * push;

    if (this.hp === 0) this.alive = false;
    return !this.alive;
  }

  update(dt, target) {
    this.age += dt;
    if (this.flashFor > 0) this.flashFor = Math.max(0, this.flashFor - dt);

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);

    // Стоим на месте, если уже вплотную: иначе деление на ноль и дрожание.
    if (distance < 0.001) return;

    // Петляние: курс отклоняется туда-сюда, но в среднем ведёт к игроку.
    const heading = Math.atan2(dy, dx) + Math.sin(this.age * 7) * this.type.wobble;
    this.x += Math.cos(heading) * this.speed * dt;
    this.y += Math.sin(heading) * this.speed * dt;
    this.angle = heading;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const fill = this.flashFor > 0 ? CONFIG.colors.enemyFlash : this.color;
    const r = this.radius;
    ctx.beginPath();

    if (this.type.shape === 'dart') {
      // Узкий наконечник: читается как «быстрый» ещё до того, как поедет.
      ctx.moveTo(r * 1.5, 0);
      ctx.lineTo(-r, r * 0.85);
      ctx.lineTo(-r * 0.45, 0);
      ctx.lineTo(-r, -r * 0.85);
    } else if (this.type.shape === 'tank') {
      // Восьмиугольник с внутренним кольцом — массивный, «бронированный».
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
    } else {
      // Ромб остриём вперёд — силуэт, который не спутать с круглым игроком.
      ctx.moveTo(r * 1.3, 0);
      ctx.lineTo(0, r * 0.8);
      ctx.lineTo(-r * 0.9, 0);
      ctx.lineTo(0, -r * 0.8);
    }

    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = this.type.shape === 'tank' ? 3 : 2;
    ctx.strokeStyle = this.type.outline;
    ctx.stroke();

    if (this.type.shape === 'tank') {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.45, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = this.type.outline;
      ctx.fill();
    }

    ctx.restore();

    if (this.type.showHealthBar && this.hp < this.maxHp) this.drawHealthBar(ctx);
  }

  drawHealthBar(ctx) {
    const width = this.radius * 2;
    const x = this.x - this.radius;
    const y = this.y - this.radius - 10;

    ctx.fillStyle = 'rgba(8, 10, 16, 0.8)';
    ctx.fillRect(x - 1, y - 1, width + 2, 6);
    ctx.fillStyle = this.color;
    ctx.fillRect(x, y, width * (this.hp / this.maxHp), 4);
  }
}

/**
 * Расталкивает врагов, стоящих друг в друге.
 *
 * Нахлёст делится по массам: лёгкий отлетает дальше, тяжёлый почти
 * не сдвигается. При равных массах — пополам, как раньше.
 *
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
      const overlap = minDistance - distance;
      const nx = dx / distance;
      const ny = dy / distance;
      const total = a.mass + b.mass;

      a.x -= nx * overlap * (b.mass / total);
      a.y -= ny * overlap * (b.mass / total);
      b.x += nx * overlap * (a.mass / total);
      b.y += ny * overlap * (a.mass / total);
    }
  }
}
