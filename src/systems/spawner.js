import { CONFIG } from '../config.js';
import { Enemy } from '../entities/enemy.js';

/**
 * Выпускает врагов волнами за краем экрана, чтобы они входили в кадр,
 * а не появлялись из воздуха на глазах у игрока.
 */
export class Spawner {
  constructor(world, config = CONFIG.spawner) {
    this.world = world;
    this.interval = config.interval;
    this.waveSize = config.waveSize;
    this.maxEnemies = config.maxEnemies;
    this.margin = config.margin;

    this.timer = 0;
    this.wave = 0;
  }

  /** Сколько секунд осталось до следующей волны — для HUD. */
  get timeToNextWave() {
    return Math.max(0, this.interval - this.timer);
  }

  update(dt, enemies, camera) {
    this.timer += dt;
    if (this.timer < this.interval) return 0;

    // Вычитаем, а не обнуляем: при просадке кадров волны не «съезжают».
    this.timer -= this.interval;
    return this.spawnWave(enemies, camera);
  }

  spawnWave(enemies, camera) {
    this.wave += 1;
    let spawned = 0;

    for (let i = 0; i < this.waveSize; i += 1) {
      if (enemies.length >= this.maxEnemies) break;
      const point = this.pickSpawnPoint(camera);
      enemies.push(new Enemy(point.x, point.y));
      spawned += 1;
    }

    return spawned;
  }

  /**
   * Случайная точка на периметре прямоугольника, описанного вокруг кадра
   * с отступом margin. Такая точка всегда вне экрана и всегда рядом с ним.
   *
   * Часть периметра может выходить за границы мира — у края карты
   * свободного места за кадром просто нет. Такие точки отбрасываем
   * и берём другую сторону.
   */
  pickSpawnPoint(camera) {
    const view = camera.viewport;
    const left = view.left - this.margin;
    const right = view.right + this.margin;
    const top = view.top - this.margin;
    const bottom = view.bottom + this.margin;

    const width = right - left;
    const height = bottom - top;
    const perimeter = 2 * (width + height);
    const inset = CONFIG.enemy.radius;

    let last = null;

    for (let attempt = 0; attempt < 16; attempt += 1) {
      const point = pointOnPerimeter(Math.random() * perimeter, left, top, width, height);

      if (
        point.x >= inset &&
        point.x <= this.world.width - inset &&
        point.y >= inset &&
        point.y <= this.world.height - inset
      ) {
        return point;
      }

      last = point;
    }

    // Мир меньше кадра с отступами: годных точек нет, прижимаем к границе.
    return {
      x: clamp(last.x, inset, this.world.width - inset),
      y: clamp(last.y, inset, this.world.height - inset),
    };
  }
}

/** Разворачивает длину вдоль периметра в точку на нём, начиная с левого верха. */
function pointOnPerimeter(distance, left, top, width, height) {
  let t = distance;

  if (t < width) return { x: left + t, y: top };
  t -= width;

  if (t < height) return { x: left + width, y: top + t };
  t -= height;

  if (t < width) return { x: left + width - t, y: top + height };
  t -= width;

  return { x: left, y: top + height - t };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
