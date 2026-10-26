import { ENEMY_TYPES } from '../enemies/types.js';
import { Enemy } from './enemy.js';
import { EnemyShot } from './enemyShot.js';

/**
 * Атаки по фазам. Фаза определяется долей здоровья: пока её не опустили
 * ниже `until`, действует первая подходящая строка.
 *
 *   ring   — залп по кругу: столько снарядов, равномерно;
 *   fan    — веер в сторону игрока: столько снарядов в раствор `spread`;
 *   windup — сколько секунд страж светится перед залпом.
 */
const PHASES = [
  {
    until: 0.5,
    speed: 55,
    cooldown: 3.2,
    windup: 0.8,
    shot: { damage: 12, speed: 190, radius: 7, lifetime: 4 },
    ring: 10,
    fan: 0,
  },
  {
    until: 0,
    speed: 90,
    cooldown: 2.1,
    windup: 0.55,
    shot: { damage: 14, speed: 230, radius: 7, lifetime: 4 },
    ring: 14,
    fan: 5,
    spread: 0.7,
  },
];

/** Лесной страж: идёт на игрока и бьёт залпами; на половине здоровья звереет. */
export class Boss extends Enemy {
  constructor(x, y, type = ENEMY_TYPES.guardian) {
    super(x, y, type, 1);
    this.phaseIndex = 0;
    this.cooldown = 2;
    /** Чётные залпы кольцом, нечётные во второй фазе — веером. */
    this.volley = 0;
    /** Смещение кольца: каждый залп поворачивает его, дыры не повторяются. */
    this.ringTurn = 0;
    /** Секунд свечения при смене фазы — сигнал, что дальше будет хуже. */
    this.enrageFlash = 0;
  }

  get phase() {
    return PHASES[this.phaseIndex];
  }

  /** 1 или 2 — для HUD. */
  get phaseNumber() {
    return this.phaseIndex + 1;
  }

  takeHit(amount, directionX, directionY, knockbackScale = 1) {
    const killed = super.takeHit(amount, directionX, directionY, knockbackScale);
    if (killed || this.phaseIndex > 0) return killed;

    if (this.hp / this.maxHp <= PHASES[0].until) {
      this.phaseIndex = 1;
      this.speed = this.phase.speed;
      this.enrageFlash = 1.2;
      this.aimLeft = 0;
      this.cooldown = 1;
    }
    return killed;
  }

  get aiming() {
    return this.aimLeft > 0 || this.enrageFlash > 0;
  }

  update(dt, target, shots) {
    this.age += dt;
    this.animator.update(dt);
    if (this.flashFor > 0) this.flashFor = Math.max(0, this.flashFor - dt);
    if (this.enrageFlash > 0) this.enrageFlash = Math.max(0, this.enrageFlash - dt);

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.001) return;

    this.angle = Math.atan2(dy, dx);
    const phase = this.phase;

    // Перед залпом страж замирает: время отойти от линии огня.
    if (this.aimLeft > 0) {
      this.aimLeft -= dt;
      if (this.aimLeft <= 0) {
        this.aimLeft = 0;
        this.fire(shots, dx / distance, dy / distance);
        this.cooldown = phase.cooldown;
      }
      return;
    }

    this.x += (dx / distance) * this.speed * dt;
    this.y += (dy / distance) * this.speed * dt;

    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.cooldown === 0) this.aimLeft = phase.windup;
  }

  /** Один залп: кольцо, а во второй фазе через раз — ещё и веер в игрока. */
  fire(shots, nx, ny) {
    if (!shots) return;
    const phase = this.phase;
    const aimAngle = Math.atan2(ny, nx);
    this.volley += 1;

    const emit = (angle) => {
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      shots.push(
        new EnemyShot(this.x + dirX * this.radius, this.y + dirY * this.radius, dirX, dirY, phase.shot),
      );
    };

    if (phase.fan === 0 || this.volley % 2 === 1) {
      this.ringTurn += Math.PI / phase.ring;
      for (let i = 0; i < phase.ring; i += 1) {
        emit(this.ringTurn + (i / phase.ring) * Math.PI * 2);
      }
    }

    if (phase.fan > 0 && this.volley % 2 === 0) {
      for (let i = 0; i < phase.fan; i += 1) {
        emit(aimAngle + (i / (phase.fan - 1) - 0.5) * phase.spread * 2);
      }
    }
  }
}
