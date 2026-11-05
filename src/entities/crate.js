/**
 * Разрушаемый ящик: стоит на карте, ломается от снарядов героя
 * и оставляет после себя предмет или кристалл.
 */
const PIXEL = 3;

export class Crate {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 16;
    this.maxHp = 3;
    this.hp = this.maxHp;
    this.flash = 0;
  }

  get alive() {
    return this.hp > 0;
  }

  get footY() {
    return this.y + 5 * PIXEL;
  }

  /** Удар снаряда; true — ящик разбит. */
  hit() {
    this.hp -= 1;
    this.flash = 0.08;
    return this.hp <= 0;
  }

  update(dt) {
    if (this.flash > 0) this.flash -= dt;
  }

  draw(ctx) {
    const p = PIXEL;
    const left = Math.round(this.x - 5 * p);
    const top = Math.round(this.y - 5 * p);
    const white = this.flash > 0;

    ctx.fillStyle = '#2a1a0c';
    ctx.fillRect(left, top, 10 * p, 10 * p);
    ctx.fillStyle = white ? '#ffffff' : '#9a6a36';
    ctx.fillRect(left + p, top + p, 8 * p, 8 * p);
    ctx.fillStyle = white ? '#ffffff' : '#6b4521';
    ctx.fillRect(left + p, top + 4 * p, 8 * p, p);
    ctx.fillRect(left + 4 * p, top + p, p, 8 * p);
    if (!white) {
      ctx.fillStyle = '#c99354';
      ctx.fillRect(left + p, top + p, 8 * p, p);
    }
    if (this.hp < this.maxHp) {
      ctx.fillStyle = '#2a1a0c';
      ctx.fillRect(left + 2 * p, top + 2 * p, p, 3 * p);
      if (this.hp === 1) ctx.fillRect(left + 6 * p, top + 5 * p, p, 3 * p);
    }
  }
}
