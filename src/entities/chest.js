/**
 * Сундук с наградой: появляется на месте павшего босса и ждёт героя.
 * Рисуется прямоугольниками в пиксельном стиле, без файлов.
 */
const PIXEL = 4;
const OPEN_RADIUS = 46;

export class Chest {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.opened = false;
    this.age = 0;
  }

  update(dt) {
    this.age += dt;
  }

  /** Герой достаточно близко, чтобы открыть. */
  reachedBy(player) {
    return Math.hypot(player.x - this.x, player.y - this.y) <= OPEN_RADIUS + player.radius;
  }

  open() {
    this.opened = true;
  }

  draw(ctx) {
    const p = PIXEL;
    const left = Math.round(this.x - 6 * p);
    const top = Math.round(this.y - 5 * p);

    // Тень и золотое сияние, пока сундук закрыт.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(left, top + 9 * p, 12 * p, 2 * p);
    if (!this.opened) {
      const glow = 0.25 + 0.15 * Math.sin(this.age * 4);
      ctx.fillStyle = `rgba(255, 214, 90, ${glow})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 12 * p, 0, Math.PI * 2);
      ctx.fill();
    }

    // Корпус.
    ctx.fillStyle = '#5a3418';
    ctx.fillRect(left, top + 4 * p, 12 * p, 6 * p);
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(left + p, top + 5 * p, 10 * p, 4 * p);
    ctx.fillStyle = '#d9a93a';
    ctx.fillRect(left, top + 6 * p, 12 * p, p);

    if (this.opened) {
      // Крышка откинута, внутри — золото.
      ctx.fillStyle = '#ffd65a';
      ctx.fillRect(left + p, top + 3 * p, 10 * p, 2 * p);
      ctx.fillStyle = '#5a3418';
      ctx.fillRect(left, top - p, 12 * p, 3 * p);
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(left + p, top, 10 * p, p);
    } else {
      // Закрытая крышка и замок.
      ctx.fillStyle = '#5a3418';
      ctx.fillRect(left, top + p, 12 * p, 4 * p);
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(left + p, top + 2 * p, 10 * p, 2 * p);
      ctx.fillStyle = '#d9a93a';
      ctx.fillRect(left + 5 * p, top + 4 * p, 2 * p, 3 * p);
    }
  }
}
