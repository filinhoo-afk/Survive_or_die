/**
 * Камера — прямоугольное окно, через которое мы смотрим на мир.
 * Хранит координаты своего левого верхнего угла в мировой системе координат.
 */
export class Camera {
  constructor(viewWidth, viewHeight, world, smoothing = 7) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.world = world;
    this.smoothing = smoothing;
    this.x = 0;
    this.y = 0;
  }

  /** Мгновенно ставит камеру по центру цели — нужно при старте и рестарте. */
  snapTo(target) {
    const desired = this.desiredPosition(target);
    this.x = desired.x;
    this.y = desired.y;
  }

  /** Плавно подтягивает камеру к цели. */
  follow(target, dt) {
    const desired = this.desiredPosition(target);

    // Экспоненциальное сглаживание: не зависит от частоты кадров,
    // в отличие от наивного x += (desired - x) * 0.1.
    const t = 1 - Math.exp(-this.smoothing * dt);
    this.x += (desired.x - this.x) * t;
    this.y += (desired.y - this.y) * t;
  }

  /** Куда камера хотела бы встать: цель в центре, но не вылезая за край мира. */
  desiredPosition(target) {
    return {
      x: clampAxis(target.x - this.viewWidth / 2, this.world.width, this.viewWidth),
      y: clampAxis(target.y - this.viewHeight / 2, this.world.height, this.viewHeight),
    };
  }

  /** Сдвигает систему координат так, что дальше можно рисовать в мировых координатах. */
  apply(ctx) {
    // Округление до целых пикселей убирает дрожание тонких линий сетки.
    ctx.translate(-Math.round(this.x), -Math.round(this.y));
  }

  /** Видимый прямоугольник мира — по нему отсекаем всё, что рисовать не нужно. */
  get viewport() {
    return {
      left: this.x,
      top: this.y,
      right: this.x + this.viewWidth,
      bottom: this.y + this.viewHeight,
    };
  }
}

/** Прижимает камеру к границам мира; если мир уже экрана — центрирует его. */
function clampAxis(value, worldSize, viewSize) {
  if (worldSize <= viewSize) return (worldSize - viewSize) / 2;
  return Math.min(Math.max(value, 0), worldSize - viewSize);
}
