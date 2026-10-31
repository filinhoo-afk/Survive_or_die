import { ENEMY_TYPES } from '../enemies/types.js';
import { Enemy } from './enemy.js';
import { EnemyShot } from './enemyShot.js';

/**
 * Фазы червя; вторая включается ниже `until` доли здоровья.
 *
 *   surface   — секунд на поверхности, где его можно бить;
 *   dive      — секунд, пока он уходит под лёд;
 *   telegraph — секунд от метки на земле до удара: время убежать;
 *   strike    — главный удар: радиус и урон; червь выныривает в его центре;
 *   spikes    — сколько ещё ледяных шипов бьёт вокруг игрока вслед за главным ударом;
 *   spike     — радиус и урон шипа;
 *   ring      — снарядов-осколков при выныривании (0 — без осколков).
 */
const PHASES = [
  {
    until: 0.5,
    speed: 50,
    surface: 4.5,
    dive: 0.5,
    telegraph: 1.4,
    strike: { radius: 90, damage: 26 },
    spikes: 0,
    spike: null,
    ring: 0,
    shot: null,
  },
  {
    until: 0,
    speed: 80,
    surface: 3,
    dive: 0.4,
    telegraph: 1.05,
    strike: { radius: 95, damage: 30 },
    spikes: 4,
    spike: { radius: 55, damage: 18 },
    ring: 10,
    shot: { damage: 12, speed: 210, radius: 7, lifetime: 3.5 },
  },
];

/** Секунд, пока он выбирается из-под льда. */
const EMERGE_TIME = 0.5;
/** Секунд, пока след удара ещё виден после того, как он нанёс урон. */
const AFTERMATH = 0.35;
/** Шипы появляются не дальше этого от главного удара и с разбросом по времени. */
const SPIKE_REACH = 230;
const SPIKE_DELAY = 0.18;

/**
 * Ледяной червь: гонится за игроком, потом уходит под лёд. Под землёй он
 * неуязвим; на месте, где стоял игрок, загорается метка, и через секунду
 * червь бьёт из-под льда. Во второй фазе вокруг бьют шипы и летят осколки.
 */
export class IceWorm extends Enemy {
  /** @param {{width: number, height: number}} world границы, внутри которых он бьёт */
  constructor(x, y, type = ENEMY_TYPES.iceworm, world = null) {
    super(x, y, type, 1);
    this.world = world;
    this.phaseIndex = 0;
    /** 'surface' → 'dive' → 'burrow' → 'emerge' → 'surface' … */
    this.state = 'surface';
    this.stateLeft = 2.5;
    /** Метки ударов: { x, y, radius, damage, left, landed, fade, main }. */
    this.strikes = [];
    /** Секунд свечения при смене фазы. */
    this.enrageFlash = 0;
    /** Истинно в кадре, когда по земле ударили, — для тряски камеры. */
    this.slammed = false;
    this.ringTurn = 0;
  }

  get phase() {
    return PHASES[this.phaseIndex];
  }

  /** 1 или 2 — для HUD. */
  get phaseNumber() {
    return this.phaseIndex + 1;
  }

  /** Светятся глаза: сменил фазу или вот-вот нырнёт. */
  get aiming() {
    return this.enrageFlash > 0 || (this.state === 'surface' && this.stateLeft < 0.7);
  }

  takeHit(amount, directionX, directionY, knockbackScale = 1) {
    const killed = super.takeHit(amount, directionX, directionY, knockbackScale);
    if (killed || this.underground || this.phaseIndex > 0) return killed;

    if (this.hp / this.maxHp <= PHASES[0].until) {
      this.phaseIndex = 1;
      this.speed = this.phase.speed;
      this.enrageFlash = 1.2;
      // Сразу нырять: сменив фазу, он не должен ждать остаток старого окна.
      this.stateLeft = Math.min(this.stateLeft, 0.8);
    }
    return killed;
  }

  /** Насколько он ушёл в землю: 0 — весь на виду, 1 — целиком под льдом. */
  get sunk() {
    if (this.state === 'dive') return 1 - this.stateLeft / this.phase.dive;
    if (this.state === 'emerge') return this.stateLeft / EMERGE_TIME;
    return this.state === 'burrow' ? 1 : 0;
  }

  update(dt, target, shots) {
    this.age += dt;
    this.animator.update(dt);
    this.slammed = false;
    if (this.flashFor > 0) this.flashFor = Math.max(0, this.flashFor - dt);
    if (this.enrageFlash > 0) this.enrageFlash = Math.max(0, this.enrageFlash - dt);

    this.updateStrikes(dt, target, shots);

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.001) this.angle = Math.atan2(dy, dx);

    this.stateLeft -= dt;

    if (this.state === 'surface') {
      if (distance > 0.001) {
        this.x += (dx / distance) * this.speed * dt;
        this.y += (dy / distance) * this.speed * dt;
      }
      if (this.stateLeft <= 0) {
        this.state = 'dive';
        this.stateLeft = this.phase.dive;
      }
    } else if (this.state === 'dive') {
      if (this.stateLeft <= 0) this.burrow(target);
    } else if (this.state === 'emerge') {
      if (this.stateLeft <= 0) {
        this.state = 'surface';
        this.stateLeft = this.phase.surface;
      }
    }
    // Состояние 'burrow' завершается ударом: см. updateStrikes.
  }

  /** Червь под землёй: метка падает туда, где сейчас стоит игрок. */
  burrow(target) {
    this.state = 'burrow';
    this.underground = true;
    const phase = this.phase;
    const main = this.markStrike(target.x, target.y, phase.strike, phase.telegraph);
    main.main = true;

    for (let i = 0; i < phase.spikes; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const reach = 70 + Math.random() * SPIKE_REACH;
      this.markStrike(
        target.x + Math.cos(angle) * reach,
        target.y + Math.sin(angle) * reach,
        phase.spike,
        phase.telegraph + (i + 1) * SPIKE_DELAY,
      );
    }
  }

  markStrike(x, y, { radius, damage }, left) {
    const margin = radius * 0.5;
    const strike = {
      x: this.world ? Math.min(this.world.width - margin, Math.max(margin, x)) : x,
      y: this.world ? Math.min(this.world.height - margin, Math.max(margin, y)) : y,
      radius,
      damage,
      left,
      total: left,
      landed: false,
      fade: AFTERMATH,
      main: false,
    };
    this.strikes.push(strike);
    return strike;
  }

  updateStrikes(dt, target, shots) {
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
      if (strike.main) this.emergeAt(strike, shots);
    }
    this.strikes = this.strikes.filter((strike) => !strike.landed || strike.fade > 0);
  }

  /** Главный удар: червь выныривает в центре метки, а во второй фазе разбрасывает осколки. */
  emergeAt(strike, shots) {
    this.x = strike.x;
    this.y = strike.y;
    this.underground = false;
    this.state = 'emerge';
    this.stateLeft = EMERGE_TIME;

    const phase = this.phase;
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

  /** Метки на земле — под всеми спрайтами. */
  drawGround(ctx) {
    for (const strike of this.strikes) {
      ctx.save();
      ctx.translate(strike.x, strike.y);
      if (strike.landed) {
        const t = 1 - strike.fade / AFTERMATH;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = '#e8f8ff';
        ctx.beginPath();
        ctx.arc(0, 0, strike.radius * (0.8 + t * 0.3), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Метка заполняется к моменту удара: по ней видно, сколько осталось.
        const progress = 1 - strike.left / strike.total;
        ctx.fillStyle = `rgba(150, 215, 255, ${0.12 + progress * 0.28})`;
        ctx.beginPath();
        ctx.arc(0, 0, strike.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(230, 248, 255, ${0.25 + progress * 0.35})`;
        ctx.beginPath();
        ctx.arc(0, 0, strike.radius * progress, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = strike.main ? '#ffffff' : '#9fd8ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, strike.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** Спрайт поднимается из земли или уходит в неё: всё ниже линии ног обрезано. */
  draw(ctx) {
    if (this.underground) return;
    const sunk = this.sunk;
    const shift = sunk * this.radius * 2.2;

    ctx.save();
    if (sunk > 0) {
      ctx.beginPath();
      ctx.rect(this.x - 200, this.y - 200, 400, 200 + this.radius);
      ctx.clip();
    }
    this.animator.swap(this.clipName);
    this.animator.draw(ctx, this.x, this.y + shift, {
      scale: this.type.spriteScale,
      flipX: this.facingLeft,
    });
    ctx.restore();
  }
}
