import { CONFIG } from '../config.js';

/** Сколько опыта нужно, чтобы уйти с уровня level на следующий. */
export function xpForLevel(level) {
  return CONFIG.xp.base + (level - 1) * CONFIG.xp.step;
}

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = CONFIG.player.radius;
    this.speed = CONFIG.player.speed;
    this.facing = { x: 0, y: 1 };

    this.maxHp = CONFIG.player.maxHp;
    this.hp = this.maxHp;
    this.alive = true;

    /** Сколько секунд осталось быть неуязвимым после удара. */
    this.invulnerableFor = 0;
    /** Копится только во время неуязвимости — по нему считается мигание. */
    this.blinkClock = 0;

    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpForLevel(1);
  }

  get hpRatio() {
    return this.hp / this.maxHp;
  }

  get xpRatio() {
    return this.xp / this.xpToNext;
  }

  /**
   * Добавляет опыт; остаток переносится на следующий уровень.
   * @returns {number} сколько уровней получено разом
   */
  gainXp(amount) {
    this.xp += amount;
    let gained = 0;

    // while, а не if: крупная порция опыта может дать несколько уровней.
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.xpToNext = xpForLevel(this.level);
      gained += 1;
    }

    return gained;
  }

  update(dt, input, bounds) {
    if (this.invulnerableFor > 0) {
      this.invulnerableFor = Math.max(0, this.invulnerableFor - dt);
      this.blinkClock += dt;
    } else {
      this.blinkClock = 0;
    }

    const axis = input.getAxis();

    this.x += axis.x * this.speed * dt;
    this.y += axis.y * this.speed * dt;

    if (axis.x !== 0 || axis.y !== 0) this.facing = axis;

    this.x = clamp(this.x, this.radius, bounds.width - this.radius);
    this.y = clamp(this.y, this.radius, bounds.height - this.radius);
  }

  /** @returns {boolean} прошёл ли удар на самом деле */
  takeDamage(amount) {
    if (!this.alive || this.invulnerableFor > 0) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.invulnerableFor = CONFIG.player.invulnerability;
    this.blinkClock = 0;

    if (this.hp === 0) this.alive = false;

    return true;
  }

  /** Во время неуязвимости игрок мигает — видно, что удар засчитан. */
  get visible() {
    if (this.invulnerableFor <= 0) return true;
    return Math.floor(this.blinkClock / CONFIG.player.blinkPeriod) % 2 === 0;
  }

  draw(ctx) {
    if (!this.visible) return;

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
