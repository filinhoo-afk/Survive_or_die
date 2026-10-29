import { ENEMY_TYPES } from '../enemies/types.js';
import { Enemy } from './enemy.js';
import { EnemyShot } from './enemyShot.js';

/**
 * Фазы Некроманта; вторая включается ниже `until` доли здоровья.
 *
 *   keep     — на каком расстоянии от игрока он держится;
 *   summon   — призыв: сколько призраков, пауза между призывами, секунд свечения;
 *   teleport — пауза между прыжками и расстояние, на которое он выходит от игрока;
 *   ring     — снарядов в кольце при появлении после прыжка (0 — без кольца).
 */
const PHASES = [
  {
    until: 0.5,
    speed: 70,
    keep: 260,
    summon: { count: 4, cooldown: 6, windup: 0.9 },
    teleport: { cooldown: 7, distance: 300 },
    ring: 0,
    shot: null,
  },
  {
    until: 0,
    speed: 95,
    keep: 220,
    summon: { count: 6, cooldown: 4.5, windup: 0.7 },
    teleport: { cooldown: 4.5, distance: 260 },
    ring: 8,
    shot: { damage: 12, speed: 200, radius: 7, lifetime: 4 },
  },
];

/** Секунд, пока он тает перед прыжком и проявляется после. */
const VANISH_TIME = 0.5;
const APPEAR_TIME = 0.35;
/** Радиус, на котором появляются призванные призраки. */
const SUMMON_RADIUS = 70;
/** Призыв пропускается, если на карте и так слишком людно. */
const MAX_ENEMIES = 70;

/** Некромант: не лезет в ближний бой, зато зовёт призраков и пропадает с места. */
export class Necromancer extends Enemy {
  /** @param {{width: number, height: number}} world границы, внутри которых он телепортируется */
  constructor(x, y, type = ENEMY_TYPES.necromancer, world = null) {
    super(x, y, type, 1);
    this.world = world;
    this.phaseIndex = 0;
    this.summonCooldown = 3;
    this.teleportCooldown = this.phase.teleport.cooldown;
    /** Секунд до прыжка: пока идёт, он тает и не двигается. */
    this.vanishLeft = 0;
    /** Секунд после прыжка: он проявляется. */
    this.appearLeft = 0;
    /** Секунд свечения при смене фазы. */
    this.enrageFlash = 0;
    /** Смещение кольца снарядов: дыры не повторяются. */
    this.ringTurn = 0;
  }

  get phase() {
    return PHASES[this.phaseIndex];
  }

  /** 1 или 2 — для HUD. */
  get phaseNumber() {
    return this.phaseIndex + 1;
  }

  get aiming() {
    return this.aimLeft > 0 || this.enrageFlash > 0;
  }

  takeHit(amount, directionX, directionY, knockbackScale = 1) {
    const killed = super.takeHit(amount, directionX, directionY, knockbackScale);
    if (killed || this.phaseIndex > 0) return killed;

    if (this.hp / this.maxHp <= PHASES[0].until) {
      this.phaseIndex = 1;
      this.speed = this.phase.speed;
      this.enrageFlash = 1.2;
      this.aimLeft = 0;
      this.vanishLeft = 0;
      this.summonCooldown = 0.8;
      this.teleportCooldown = this.phase.teleport.cooldown;
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
   * @param {Array} shots сюда летят снаряды второй фазы
   * @param {Array} enemies сюда добавляются призванные призраки
   */
  update(dt, target, shots, enemies) {
    this.age += dt;
    this.animator.update(dt);
    if (this.flashFor > 0) this.flashFor = Math.max(0, this.flashFor - dt);
    if (this.enrageFlash > 0) this.enrageFlash = Math.max(0, this.enrageFlash - dt);
    if (this.appearLeft > 0) this.appearLeft = Math.max(0, this.appearLeft - dt);

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.001) return;
    this.angle = Math.atan2(dy, dx);

    if (this.vanishLeft > 0) {
      this.vanishLeft -= dt;
      if (this.vanishLeft <= 0) {
        this.vanishLeft = 0;
        this.teleport(target, shots);
      }
      return;
    }

    // Читая заклинание, он стоит на месте.
    if (this.aimLeft > 0) {
      this.aimLeft -= dt;
      if (this.aimLeft <= 0) {
        this.aimLeft = 0;
        this.summon(enemies);
        this.summonCooldown = this.phase.summon.cooldown;
      }
      return;
    }

    const phase = this.phase;
    const nx = dx / distance;
    const ny = dy / distance;
    if (distance > phase.keep) {
      this.x += nx * this.speed * dt;
      this.y += ny * this.speed * dt;
    } else if (distance < phase.keep * 0.6) {
      this.x -= nx * this.speed * dt;
      this.y -= ny * this.speed * dt;
    }

    this.teleportCooldown = Math.max(0, this.teleportCooldown - dt);
    this.summonCooldown = Math.max(0, this.summonCooldown - dt);
    if (this.teleportCooldown === 0) {
      this.vanishLeft = VANISH_TIME;
    } else if (this.summonCooldown === 0) {
      this.aimLeft = phase.summon.windup;
    }
  }

  /** Призраки встают кольцом вокруг него. */
  summon(enemies) {
    if (!enemies || enemies.length >= MAX_ENEMIES) return;
    const { count } = this.phase.summon;
    const start = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i += 1) {
      const angle = start + (i / count) * Math.PI * 2;
      enemies.push(
        new Enemy(
          this.x + Math.cos(angle) * SUMMON_RADIUS,
          this.y + Math.sin(angle) * SUMMON_RADIUS,
          ENEMY_TYPES.ghost,
          1,
        ),
      );
    }
  }

  /** Прыжок на `distance` от игрока в случайную сторону, но в пределах мира. */
  teleport(target, shots) {
    const phase = this.phase;
    const angle = Math.random() * Math.PI * 2;
    let x = target.x + Math.cos(angle) * phase.teleport.distance;
    let y = target.y + Math.sin(angle) * phase.teleport.distance;
    if (this.world) {
      x = Math.min(this.world.width - this.radius, Math.max(this.radius, x));
      y = Math.min(this.world.height - this.radius, Math.max(this.radius, y));
    }
    this.x = x;
    this.y = y;
    this.appearLeft = APPEAR_TIME;
    this.teleportCooldown = phase.teleport.cooldown;
    this.summonCooldown = Math.max(this.summonCooldown, 1);

    if (phase.ring > 0 && shots) {
      this.ringTurn += Math.PI / phase.ring;
      for (let i = 0; i < phase.ring; i += 1) {
        const a = this.ringTurn + (i / phase.ring) * Math.PI * 2;
        const dirX = Math.cos(a);
        const dirY = Math.sin(a);
        shots.push(
          new EnemyShot(this.x + dirX * this.radius, this.y + dirY * this.radius, dirX, dirY, phase.shot),
        );
      }
    }
  }

  /** Со смертью хозяина призванные призраки рассыпаются. */
  dismissMinions(enemies) {
    for (const enemy of enemies) {
      if (enemy !== this) enemy.alive = false;
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
