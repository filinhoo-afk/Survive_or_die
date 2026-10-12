import { CONFIG } from '../config.js';
import { atlas } from '../art/index.js';
import { Animator } from '../gfx/animator.js';

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
    /** Сколько секунд ещё показывать красный кадр урона. */
    this.hurtFor = 0;
    this.moving = false;
    this.animator = new Animator(atlas, 'hero.idle.down');

    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpForLevel(1);

    /** Своё у каждого игрока, чтобы его можно было прокачивать. */
    this.magnetRadius = CONFIG.xp.magnetRadius;

    /** Множители для всего оружия разом — их меняют пассивки. */
    this.mods = { damage: 1, cooldown: 1, area: 1 };
    /** Здоровья в секунду. */
    this.regen = 0;
    /** На столько слабее каждый удар по игроку. */
    this.armor = 0;
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
    if (this.alive && this.regen > 0) {
      this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    }

    if (this.invulnerableFor > 0) {
      this.invulnerableFor = Math.max(0, this.invulnerableFor - dt);
      this.blinkClock += dt;
    } else {
      this.blinkClock = 0;
    }

    const axis = input.getAxis();

    this.x += axis.x * this.speed * dt;
    this.y += axis.y * this.speed * dt;

    this.moving = axis.x !== 0 || axis.y !== 0;
    if (this.moving) this.facing = axis;

    if (this.hurtFor > 0) this.hurtFor = Math.max(0, this.hurtFor - dt);
    this.animator.update(dt);

    this.x = clamp(this.x, this.radius, bounds.width - this.radius);
    this.y = clamp(this.y, this.radius, bounds.height - this.radius);
  }

  /** @returns {boolean} прошёл ли удар на самом деле */
  takeDamage(amount) {
    if (!this.alive || this.invulnerableFor > 0) return false;

    // Броня не обнуляет удар полностью: иначе на пятом ранге
    // слабые враги перестали бы быть угрозой вовсе.
    const dealt = Math.max(1, amount - this.armor);
    this.hp = Math.max(0, this.hp - dealt);
    this.invulnerableFor = CONFIG.player.invulnerability;
    this.blinkClock = 0;
    this.hurtFor = CONFIG.player.hurtTime;

    if (this.hp <= 0) this.alive = false;

    return true;
  }

  /** Во время неуязвимости игрок мигает — видно, что удар засчитан. */
  get visible() {
    if (this.invulnerableFor <= 0) return true;
    return Math.floor(this.blinkClock / CONFIG.player.blinkPeriod) % 2 === 0;
  }

  /** Ракурс спрайта по направлению взгляда; при равенстве осей побеждает бок. */
  get view() {
    const { x, y } = this.facing;
    if (Math.abs(x) >= Math.abs(y)) return 'side';
    return y < 0 ? 'up' : 'down';
  }

  /** Какой клип должен играть прямо сейчас: урон важнее ходьбы, ходьба — стойки. */
  get clipName() {
    const state = this.hurtFor > 0 || !this.alive ? 'hurt' : this.moving ? 'walk' : 'idle';
    return `hero.${state}.${this.view}`;
  }

  draw(ctx) {
    if (!this.visible) return;

    this.animator.play(this.clipName);

    // Ноги стоят чуть ниже центра круга столкновений — тело выглядит стоящим на земле.
    this.animator.draw(ctx, this.x, this.y + this.radius + 2, {
      scale: CONFIG.player.spriteScale,
      flipX: this.view === 'side' && this.facing.x < 0,
    });
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
