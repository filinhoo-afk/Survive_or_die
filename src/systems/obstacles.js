import { Obstacle } from '../entities/obstacle.js';

/** Детерминированный генератор: у локации одна и та же расстановка в каждом забеге. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickKind(kinds, roll) {
  const total = kinds.reduce((sum, kind) => sum + kind.weight, 0);
  let left = roll * total;
  for (const kind of kinds) {
    left -= kind.weight;
    if (left < 0) return kind;
  }
  return kinds[0];
}

/** Расставляет препятствия по данным локации: не у краёв, не на старте, не слипаясь. */
export function buildObstacles(location) {
  const { world, obstacles: cfg } = location;
  if (!cfg) return [];

  const random = mulberry32(cfg.seed);
  const edge = 80;
  const result = [];

  for (let attempt = 0; attempt < cfg.count * 20 && result.length < cfg.count; attempt += 1) {
    const kind = pickKind(cfg.kinds, random());
    const x = edge + random() * (world.width - edge * 2);
    const y = edge + random() * (world.height - edge * 2);

    if (Math.hypot(x - world.width / 2, y - world.height / 2) < cfg.clearRadius + kind.radius) continue;
    if (result.some((o) => Math.hypot(o.x - x, o.y - y) < o.radius + kind.radius + cfg.gap)) continue;

    result.push(new Obstacle(x, y, kind));
  }

  return result;
}

/** Выталкивает круг (игрока или врага) из всех препятствий. */
export function collideBody(body, obstacles) {
  for (const o of obstacles) {
    const dx = body.x - o.x;
    const dy = body.y - o.y;
    const min = o.radius + body.radius;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= min * min) continue;

    const distance = Math.sqrt(distanceSquared);
    // Центр точно в центре препятствия — выталкиваем вверх, а не делим на ноль.
    const nx = distance > 0.001 ? dx / distance : 0;
    const ny = distance > 0.001 ? dy / distance : -1;
    body.x = o.x + nx * min;
    body.y = o.y + ny * min;
  }
}

export function collideBodies(bodies, obstacles) {
  for (const body of bodies) collideBody(body, obstacles);
}

/** Снаряды гаснут о препятствия: из-за камня не постреляешь. */
export function blockShots(shots, obstacles) {
  for (const shot of shots) {
    for (const o of obstacles) {
      const min = o.radius + shot.radius * 0.5;
      if ((shot.x - o.x) ** 2 + (shot.y - o.y) ** 2 < min * min) {
        shot.spent = true;
        break;
      }
    }
  }
}
