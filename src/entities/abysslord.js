import { ENEMY_TYPES } from '../enemies/types.js';
import { Enemy } from './enemy.js';
import { spawnEnemyShot } from './enemyShot.js';

/**
 * Три фазы Владыки; следующая включается, когда доля здоровья упала до `until`.
 *
 *   cooldown / windup — пауза между залпами и секунд свечения перед залпом;
 *   ring / fan        — снарядов в кольце и в веере (0 — такого залпа нет);
 *   teleport          — пауза между прыжками и расстояние от игрока (null — не прыгает);
 *   summon            — кого и сколько призывает при появлении после прыжка;
 *   rifts             — разломы под ногами: сколько, пауза, радиус и урон.
 */
const PHASES = [
  {
    until: 0.66,
    speed: 60,
    cooldown: 3,
    windup: 0.8,
    shot: { damage: 12, speed: 190, radius: 7, lifetime: 4 },
    ring: 12,
    fan: 0,
    teleport: null,
    summon: null,
    rifts: null,
  },
  {
    until: 0.33,
    speed: 80,
    cooldown: 2.6,
    windup: 0.65,
    shot: { damage: 13, speed: 210, radius: 7, lifetime: 4 },
    ring: 10,
    fan: 5,
    spread: 0.7,
    teleport: { cooldown: 7, distance: 280 },
    summon: { type: 'wraith', count: 4 },
    rifts: null,
  },
  {
    until: 0,
    speed: 95,
    cooldown: 2,
    windup: 0.5,
    shot: { damage: 14, speed: 230, radius: 7, lifetime: 4 },
    ring: 14,
    fan: 7,
    spread: 0.9,
    teleport: { cooldown: 5.5, distance: 250 },
    summon: { type: 'ghost', count: 4 },
    rifts: { count: 3, cooldown: 4.5, telegraph: 1.1, radius: 75, damage: 22 },
  },
];

/** Секунд, пока он тает перед прыжком и проявляется после. */
const VANISH_TIME = 0.5;
const APPEAR_TIME = 0.35;
/** Секунд, пока след разлома ещё виден после удара. */
const AFTERMATH = 0.35;
/** Призыв пропускается, если на карте и так слишком людно. */
const MAX_ENEMIES = 70;
const SUMMON_RADIUS = 80;
/** Дальше этого от игрока лишние разломы не открываются. */
const RIFT_REACH = 240;
const RIFT_DELAY = 0.2;

/**
 * Владыка Бездны. Первая фаза — залпы по кругу, вторая — прыжки, призыв
 * и веера, третья — ещё и разломы под ногами. Каждая фаза добавляется
 * к прежним, а не заменяет их.
 */
export class AbyssLord extends Enemy {
  /** @param {{width: number, height: number}} world границы, внутри которых он прыгает */
  constructor(x, y, type = ENEMY_TYPES.abyssal, world = null) {
    super(x, y, type, 1);
    this.world = world;
    this.phaseIndex = 0;
    this.cooldown = 2;
    this.teleportCooldown = 0;
    this.riftCooldown = 0;
    this.vanishLeft = 0;
    this.appearLeft = 0;
    /** Секунд свечения при смене фазы. */
    this.enrageFlash = 0;
    this.volley = 0;
    this.ringTurn = 0;
    /** Разломы: { x, y, radius, damage, left, total, landed, fade }. */
    this.strikes = [];
    /** Истинно в кадре, когда разлом ударил, — для тряски камеры. */
    this.slammed = false;
  }

  get phase() {
    return PHASES[this.phaseIndex];
  }

  /** 1, 2 или 3 — для HUD. */
  get phaseNumber() {
    return this.phaseIndex + 1;
  }

  get aiming() {
    return this.aimLeft > 0 || this.enrageFlash > 0;
  }

  takeHit(amount, directionX, directionY, knockbackScale = 1) {
    const killed = super.takeHit(amount, directionX, directionY, knockbackScale);
    if (killed || this.phaseIndex >= PHASES.length - 1) return killed;

    if (this.hp / this.maxHp <= this.phase.until) {
      this.phaseIndex += 1;
      const phase = this.phase;
      this.speed = phase.speed;
      this.enrageFlash = 1.2;
      this.aimLeft = 0;
      this.vanishLeft = 0;
      this.cooldown = 1;
      this.teleportCooldown = phase.teleport ? phase.teleport.cooldown * 0.6 : 0;
      this.riftCooldown = phase.rifts ? 1.5 : 0;
    }
    return killed;
  }

  /** Прозрачность: тает перед прыжком, проявляется после. */
  get alpha() {
    if (this.vanishLeft > 0) return Math.max(0.15, this.vanishLeft / VANISH_TIME);
    if (this.appearLeft > 0) return 1 - (this.appearLeft / APPEAR_TIME) * 0.7;
    return 1;
  }

  /**
   * @param {Array} shots сюда летят его снаряды
   * @param {Array} enemies сюда добавляются призванные враги
   */
  update(dt, target, shots, enemies) {
    this.age += dt;
    this.animator.update(dt);
    this.slammed = false;
    if (this.flashFor > 0) this.flashFor = Math.max(0, this.flashFor - dt);
    if (this.enrageFlash > 0) this.enrageFlash = Math.max(0, this.enrageFlash - dt);
    if (this.appearLeft > 0) this.appearLeft = Math.max(0, this.appearLeft - dt);

    this.updateStrikes(dt, target);

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.001) return;
    this.angle = Math.atan2(dy, dx);

    if (this.vanishLeft > 0) {
      this.vanishLeft -= dt;
      if (this.vanishLeft <= 0) {
        this.vanishLeft = 0;
        this.teleport(target, shots, enemies);
      }
      return;
    }

    // Перед залпом он замирает: время отойти с линии огня.
    if (this.aimLeft > 0) {
      this.aimLeft -= dt;
      if (this.aimLeft <= 0) {
        this.aimLeft = 0;
        this.fire(shots, dx / distance, dy / distance);
        this.cooldown = this.phase.cooldown;
      }
      return;
    }

    const phase = this.phase;
    this.x += (dx / distance) * this.speed * dt;
    this.y += (dy / distance) * this.speed * dt;

    this.cooldown = Math.max(0, this.cooldown - dt);
    if (phase.teleport) this.teleportCooldown = Math.max(0, this.teleportCooldown - dt);
    if (phase.rifts) this.riftCooldown = Math.max(0, this.riftCooldown - dt);

    if (phase.rifts && this.riftCooldown === 0) {
      this.openRifts(target);
    }
    if (phase.teleport && this.teleportCooldown === 0) {
      this.vanishLeft = VANISH_TIME;
    } else if (this.cooldown === 0) {
      this.aimLeft = phase.windup;
    }
  }

  /** Один залп: кольцо, а там, где есть веер, — через раз веер в игрока. */
  fire(shots, nx, ny) {
    if (!shots) return;
    const phase = this.phase;
    const aimAngle = Math.atan2(ny, nx);
    this.volley += 1;

    const emit = (angle) => {
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      shots.push(
        spawnEnemyShot(this.x + dirX * this.radius, this.y + dirY * this.radius, dirX, dirY, phase.shot),
      );
    };

    if (phase.fan === 0 || this.volley % 2 === 1) {
      this.ringTurn += Math.PI / phase.ring;
      for (let i = 0; i < phase.ring; i += 1) {
        emit(this.ringTurn + (i / phase.ring) * Math.PI * 2);
      }
    } else {
      for (let i = 0; i < phase.fan; i += 1) {
        emit(aimAngle + (i / (phase.fan - 1) - 0.5) * phase.spread * 2);
      }
    }
  }

  /** Прыжок на `distance` от игрока в случайную сторону; на новом месте он зовёт свиту. */
  teleport(target, shots, enemies) {
    const { teleport } = this.phase;
    const angle = Math.random() * Math.PI * 2;
    this.x = this.inWorldX(target.x + Math.cos(angle) * teleport.distance);
    this.y = this.inWorldY(target.y + Math.sin(angle) * teleport.distance);
    this.appearLeft = APPEAR_TIME;
    this.teleportCooldown = teleport.cooldown;
    this.cooldown = Math.max(this.cooldown, 0.8);
    this.summon(enemies);
  }

  inWorldX(x) {
    return this.world ? Math.min(this.world.width - this.radius, Math.max(this.radius, x)) : x;
  }

  inWorldY(y) {
    return this.world ? Math.min(this.world.height - this.radius, Math.max(this.radius, y)) : y;
  }

  summon(enemies) {
    const { summon } = this.phase;
    if (!summon || !enemies || enemies.length >= MAX_ENEMIES) return;
    const start = Math.random() * Math.PI * 2;
    for (let i = 0; i < summon.count; i += 1) {
      const angle = start + (i / summon.count) * Math.PI * 2;
      enemies.push(
        new Enemy(
          this.x + Math.cos(angle) * SUMMON_RADIUS,
          this.y + Math.sin(angle) * SUMMON_RADIUS,
          ENEMY_TYPES[summon.type],
          1,
        ),
      );
    }
  }

  /** Первый разлом открывается под игроком, остальные — вокруг него с задержкой. */
  openRifts(target) {
    const { rifts } = this.phase;
    this.riftCooldown = rifts.cooldown;
    for (let i = 0; i < rifts.count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const reach = i === 0 ? 0 : 60 + Math.random() * RIFT_REACH;
      const margin = rifts.radius * 0.5;
      const left = rifts.telegraph + i * RIFT_DELAY;
      this.strikes.push({
        x: this.world
          ? Math.min(this.world.width - margin, Math.max(margin, target.x + Math.cos(angle) * reach))
          : target.x + Math.cos(angle) * reach,
        y: this.world
          ? Math.min(this.world.height - margin, Math.max(margin, target.y + Math.sin(angle) * reach))
          : target.y + Math.sin(angle) * reach,
        radius: rifts.radius,
        damage: rifts.damage,
        left,
        total: left,
        landed: false,
        fade: AFTERMATH,
      });
    }
  }

  updateStrikes(dt, target) {
    for (const strike of this.strikes) {
      if (strike.landed) {
        strike.fade -= dt;
        continue;
      }
      strike.left -= dt;
      if (strike.left > 0) continue;

      strike.landed = true;
      this.slammed = true;
      const dx = target.x - strike.x;
      const dy = target.y - strike.y;
      const reach = strike.radius + target.radius;
      if (dx * dx + dy * dy <= reach * reach) target.takeDamage(strike.damage);
    }
    this.strikes = this.strikes.filter((strike) => !strike.landed || strike.fade > 0);
  }

  /** Со смертью хозяина призванные им враги рассыпаются. */
  dismissMinions(enemies) {
    for (const enemy of enemies) {
      if (enemy !== this) enemy.alive = false;
    }
    this.strikes.length = 0;
  }

  /** Разломы на земле — под всеми спрайтами. */
  drawGround(ctx) {
    for (const strike of this.strikes) {
      ctx.save();
      ctx.translate(strike.x, strike.y);
      if (strike.landed) {
        const t = 1 - strike.fade / AFTERMATH;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = '#e9c8ff';
        ctx.beginPath();
        ctx.arc(0, 0, strike.radius * (0.8 + t * 0.3), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Разлом наливается к моменту удара: по нему видно, сколько осталось.
        const progress = 1 - strike.left / strike.total;
        ctx.fillStyle = `rgba(120, 40, 170, ${0.15 + progress * 0.3})`;
        ctx.beginPath();
        ctx.arc(0, 0, strike.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 90, 140, ${0.2 + progress * 0.35})`;
        ctx.beginPath();
        ctx.arc(0, 0, strike.radius * progress, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d58cff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, strike.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  draw(ctx) {
    ctx.globalAlpha = this.alpha;
    this.animator.swap(this.clipName);
    this.animator.draw(ctx, this.x, this.y, {
      scale: this.type.spriteScale,
      flipX: this.facingLeft,
    });
    ctx.globalAlpha = 1;
  }
}
