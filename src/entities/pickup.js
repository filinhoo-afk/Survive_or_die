/**
 * Подбираемый предмет: аптечка, магнит или бомба. Лежит на земле, пока герой
 * не подойдёт; в последние секунды мигает и исчезает. Рисуется прямоугольниками.
 */
export const PICKUP_KINDS = {
  heal: { color: '#f2786a' },
  magnet: { color: '#7aa2ff' },
  bomb: { color: '#ffb347' },
};

const LIFETIME = 25;
const BLINK_FROM = 5;
const PIXEL = 3;
const PICKUP_RADIUS = 18;

export class Pickup {
  constructor(x, y, kind) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.info = PICKUP_KINDS[kind];
    this.age = Math.random() * 10;
    this.life = LIFETIME;
    this.collected = false;
  }

  get expired() {
    return this.life <= 0;
  }

  update(dt, player) {
    this.age += dt;
    this.life -= dt;
    const reach = PICKUP_RADIUS + player.radius;
    if ((player.x - this.x) ** 2 + (player.y - this.y) ** 2 <= reach * reach) this.collected = true;
  }

  draw(ctx) {
    if (this.life < BLINK_FROM && Math.floor(this.life * 6) % 2 === 0) return;
    const p = PIXEL;
    const cx = Math.round(this.x);
    const cy = Math.round(this.y + Math.sin(this.age * 4) * 2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(cx - 4 * p, cy + 4 * p, 8 * p, p);

    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(cx - 4 * p, cy - 4 * p, 8 * p, 8 * p);
    ctx.fillStyle = this.info.color;
    ctx.fillRect(cx - 3 * p, cy - 3 * p, 6 * p, 6 * p);

    ctx.fillStyle = '#ffffff';
    if (this.kind === 'heal') {
      ctx.fillRect(cx - p, cy - 2 * p, 2 * p, 4 * p);
      ctx.fillRect(cx - 2 * p, cy - p, 4 * p, 2 * p);
    } else if (this.kind === 'magnet') {
      ctx.fillRect(cx - 2 * p, cy - 2 * p, p, 4 * p);
      ctx.fillRect(cx + p, cy - 2 * p, p, 4 * p);
      ctx.fillRect(cx - 2 * p, cy + p, 4 * p, p);
    } else {
      ctx.fillStyle = '#0b0e14';
      ctx.fillRect(cx - 2 * p, cy - p, 4 * p, 3 * p);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx + p, cy - 2 * p, p, p);
    }
  }
}
