import { CONFIG } from '../config.js';
import { ENEMY_TYPES } from '../enemies/types.js';
import { EnemyShot } from './enemyShot.js';
import { atlas } from '../art/index.js';
import { Animator } from '../gfx/animator.js';

let hitListener = null;

/** Кто хочет знать о каждом попадании по врагу (цифры урона): fn(enemy, damage, crit). */
export function setHitListener(fn) {
  hitListener = fn;
}

/** Враг бежит к игроку; как именно и насколько опасен — решает его тип. */
export class Enemy {
  /** @param {number} [hpScale] множитель здоровья — растёт вместе со временем забега */
  constructor(x, y, type = ENEMY_TYPES.grunt, hpScale = 1) {
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

    this.maxHp = Math.round(type.hp * hpScale);
    this.hp = this.maxHp;
    this.alive = true;
    /** Сколько секунд ещё гореть белым после попадания. */
    this.flashFor = 0;

    // Случайная фаза петляния, иначе вся стая виляет синхронно.
    this.age = Math.random() * 10;

    /** Только у стрелков: секунд до следующего прицеливания и до выстрела. */
    this.shotCooldown = type.ranged ? Math.random() * type.ranged.cooldown : 0;
    this.aimLeft = 0;
    /** Под землёй враг неуязвим, не бьёт касанием и не попадает в цели оружия. */
    this.underground = false;

    // Фаза шага случайна по той же причине, что и фаза петляния.
    this.animator = new Animator(atlas, `${type.id}.walk`);
    this.animator.time = Math.random();
  }

  /** Стрелок целится: стоит на месте и светится — игрок успевает среагировать. */
  get aiming() {
    return this.aimLeft > 0;
  }

  /**
   * Попадание: урон, вспышка и отброс по направлению удара.
   * @param {number} [knockbackScale] доля обычного отброса — частые
   *   слабые удары вроде ауры отбрасывают меньше, иначе выталкивают толпу
   * @returns {boolean} убит ли враг этим попаданием
   */
  takeHit(amount, directionX, directionY, knockbackScale = 1) {
    if (!this.alive || this.underground) return false;

    const crit = Math.random() < CONFIG.crit.chance;
    const dealt = Math.round(crit ? amount * CONFIG.crit.multiplier : amount);
    hitListener?.(this, dealt, crit);

    this.hp = Math.max(0, this.hp - dealt);
    this.flashFor = CONFIG.enemy.hitFlash;

    const push = CONFIG.enemy.knockback * knockbackScale * (1 - this.type.knockbackResist);
    this.x += directionX * push;
    this.y += directionY * push;

    if (this.hp === 0) this.alive = false;
    return !this.alive;
  }

  /**
   * @param {Array} [shots] сюда стрелки кладут выпущенные снаряды
   */
  update(dt, target, shots) {
    this.age += dt;
    this.animator.update(dt);
    if (this.flashFor > 0) this.flashFor = Math.max(0, this.flashFor - dt);

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);

    // Стоим на месте, если уже вплотную: иначе деление на ноль и дрожание.
    if (distance < 0.001) return;

    if (this.type.ranged) {
      this.updateShooter(dt, dx, dy, distance, shots);
      return;
    }

    // Петляние: курс отклоняется туда-сюда, но в среднем ведёт к игроку.
    const heading = Math.atan2(dy, dx) + Math.sin(this.age * 7) * this.type.wobble;
    this.x += Math.cos(heading) * this.speed * dt;
    this.y += Math.sin(heading) * this.speed * dt;
    this.angle = heading;
  }

  /**
   * Стрелок: подходит на keepDistance, при сближении пятится, а между
   * выстрелами замирает на время прицеливания — выстрел не из ниоткуда.
   */
  updateShooter(dt, dx, dy, distance, shots) {
    const ranged = this.type.ranged;
    const nx = dx / distance;
    const ny = dy / distance;
    this.angle = Math.atan2(dy, dx);

    if (this.aiming) {
      this.aimLeft -= dt;
      if (this.aimLeft <= 0) {
        this.aimLeft = 0;
        this.shotCooldown = ranged.cooldown;
        shots?.push(
          new EnemyShot(this.x + nx * this.radius, this.y + ny * this.radius, nx, ny, {
            damage: ranged.damage,
            speed: ranged.speed,
          }),
        );
      }
      return;
    }

    if (distance > ranged.keepDistance) {
      this.x += nx * this.speed * dt;
      this.y += ny * this.speed * dt;
    } else if (distance < ranged.keepDistance * 0.7) {
      this.x -= nx * this.speed * dt;
      this.y -= ny * this.speed * dt;
    }

    // Целится только с близкого расстояния: издалека снаряд всё равно истечёт.
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    if (this.shotCooldown === 0 && distance <= ranged.keepDistance * 1.6) {
      this.aimLeft = ranged.windup;
    }
  }

  /** Спрайты нарисованы лицом вправо; идущий влево отражается. */
  get facingLeft() {
    return Math.cos(this.angle) < 0;
  }

  /** Вспышка после попадания важнее прицела, прицел — ходьбы. */
  get clipName() {
    const id = this.type.id;
    if (this.flashFor > 0) return `${id}.hit`;
    return this.aiming ? `${id}.aim` : `${id}.walk`;
  }

  /** Где враг стоит ногами: спрайт центрирован на теле, ноги ниже на радиус. */
  get footY() {
    return this.y + this.radius;
  }

  draw(ctx) {
    // Клипы одного типа поделены на кадры одинаково, шаг не сбрасывается.
    this.animator.swap(this.clipName);
    if (this.type.ghost) ctx.globalAlpha = 0.72;
    this.animator.draw(ctx, this.x, this.y, {
      scale: this.type.spriteScale,
      flipX: this.facingLeft,
    });
    ctx.globalAlpha = 1;

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
