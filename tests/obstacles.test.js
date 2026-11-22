import './helpers/dom.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { blockShots, buildObstacles, collideBodies, collideBody } from '../src/systems/obstacles.js';
import { SpatialGrid } from '../src/systems/grid.js';
import { LOCATION_LIST } from '../src/locations/index.js';
import { CONFIG } from '../src/config.js';

const withObstacles = LOCATION_LIST.filter((location) => location.obstacles);

/** Сколько блоков стен строится первыми — по той же формуле, что и в buildObstacles. */
function wallBlocks(cfg) {
  return (cfg.walls ?? []).reduce((sum, wall) => {
    const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
    return sum + Math.max(1, Math.round(length / cfg.wall.step)) + 1;
  }, 0);
}

describe('расстановка препятствий по локациям', () => {
  test('у локации без препятствий их нет', () => {
    assert.deepEqual(buildObstacles({ world: { width: 100, height: 100 } }), []);
  });

  for (const location of withObstacles) {
    describe(location.title, () => {
      const cfg = location.obstacles;
      const obstacles = buildObstacles(location);
      const centerX = location.world.width / 2;
      const centerY = location.world.height / 2;

      test('расстановка одна и та же в каждом забеге', () => {
        const again = buildObstacles(location);
        assert.deepEqual(again.map((o) => [o.x, o.y, o.radius]), obstacles.map((o) => [o.x, o.y, o.radius]));
      });

      test('случайных препятствий ровно столько, сколько задано, и все внутри мира', () => {
        assert.equal(obstacles.length, cfg.count + wallBlocks(cfg));
        for (const o of obstacles) {
          assert.ok(o.x >= 0 && o.x <= location.world.width && o.y >= 0 && o.y <= location.world.height, `(${o.x}, ${o.y})`);
        }
      });

      test('на старте у героя пусто: он не рождается внутри камня', () => {
        for (const o of obstacles) {
          const gap = Math.hypot(o.x - centerX, o.y - centerY) - o.radius - CONFIG.player.radius;
          assert.ok(gap > 0, `препятствие (${o.x}, ${o.y}) накрывает старт`);
        }
      });

      test('вокруг старта свободный круг заданного радиуса: край любого случайного препятствия не ближе', () => {
        for (const o of obstacles.slice(wallBlocks(cfg))) {
          const edge = Math.hypot(o.x - centerX, o.y - centerY) - o.radius;
          assert.ok(edge >= cfg.clearRadius - 1e-9, `край в ${edge.toFixed(1)} от центра при clearRadius ${cfg.clearRadius}`);
        }
      });

      test('случайные препятствия не слипаются: между краями зазор', () => {
        const random = obstacles.slice(wallBlocks(cfg));
        for (let i = 0; i < random.length; i += 1) {
          for (let j = i + 1; j < random.length; j += 1) {
            const a = random[i];
            const b = random[j];
            const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
            assert.ok(gap >= cfg.gap - 1e-9, `зазор ${gap.toFixed(1)} < ${cfg.gap}`);
          }
        }
      });

      test('у каждого есть спрайт из атласа и конечные размеры', () => {
        for (const o of obstacles) {
          assert.ok(o.clip, 'нет клипа');
          assert.ok(Number.isFinite(o.radius) && o.radius > 0);
          assert.ok(Number.isFinite(o.footY));
        }
      });
    });
  }

  test('стены строятся первыми и идут цепочкой вдоль отрезка', () => {
    const ruins = LOCATION_LIST.find((l) => l.id === 'ruins');
    const obstacles = buildObstacles(ruins);
    const [wall] = ruins.obstacles.walls;
    assert.deepEqual([obstacles[0].x, obstacles[0].y], [wall.x1, wall.y1]);
    const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
    const blocks = Math.max(1, Math.round(length / ruins.obstacles.wall.step)) + 1;
    assert.deepEqual([obstacles[blocks - 1].x, obstacles[blocks - 1].y], [wall.x2, wall.y2]);
  });

  test('блоки стены стоят не реже шага: между соседними нет дыры', () => {
    const ruins = LOCATION_LIST.find((l) => l.id === 'ruins');
    const obstacles = buildObstacles(ruins);
    const [wall] = ruins.obstacles.walls;
    const blocks = Math.max(1, Math.round(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) / ruins.obstacles.wall.step)) + 1;
    for (let i = 1; i < blocks; i += 1) {
      const gap = Math.hypot(obstacles[i].x - obstacles[i - 1].x, obstacles[i].y - obstacles[i - 1].y);
      assert.ok(gap <= ruins.obstacles.wall.radius * 2, `дыра в стене: ${gap.toFixed(1)}`);
    }
  });
});

describe('столкновения', () => {
  const rock = (x, y, radius = 20) => ({ x, y, radius });
  const gridOf = (list) => new SpatialGrid(1000, 1000).rebuild(list);

  test('тело внутри препятствия выталкивается наружу, вдоль линии от центра', () => {
    const body = { x: 110, y: 100, radius: 10 };
    collideBody(body, gridOf([rock(100, 100)]));
    assert.ok(Math.abs(body.x - 130) < 1e-9);
    assert.equal(body.y, 100);
  });

  test('после выталкивания тело ровно касается, а не въезжает', () => {
    const body = { x: 105, y: 108, radius: 12 };
    const obstacle = rock(100, 100, 25);
    collideBody(body, gridOf([obstacle]));
    assert.ok(Math.abs(Math.hypot(body.x - obstacle.x, body.y - obstacle.y) - 37) < 1e-9);
  });

  test('тело снаружи не двигается', () => {
    const body = { x: 200, y: 100, radius: 10 };
    collideBody(body, gridOf([rock(100, 100)]));
    assert.deepEqual([body.x, body.y], [200, 100]);
  });

  test('касание по самой границе — без движения', () => {
    const body = { x: 130, y: 100, radius: 10 };
    collideBody(body, gridOf([rock(100, 100)]));
    assert.equal(body.x, 130);
  });

  test('точно в центре — выталкивает вверх, а не делит на ноль', () => {
    const body = { x: 100, y: 100, radius: 10 };
    collideBody(body, gridOf([rock(100, 100)]));
    assert.ok(Number.isFinite(body.x) && Number.isFinite(body.y));
    assert.equal(body.x, 100);
    assert.equal(body.y, 70);
  });

  test('несколько препятствий подряд учитываются', () => {
    const body = { x: 100, y: 100, radius: 10 };
    collideBody(body, gridOf([rock(100, 100), rock(105, 100)]));
    for (const o of [rock(100, 100), rock(105, 100)]) {
      assert.ok(Number.isFinite(body.x + body.y + o.x));
    }
  });

  test('collideBodies: призраки проходят сквозь камень, остальные нет', () => {
    const grid = gridOf([rock(100, 100)]);
    const walker = { x: 105, y: 100, radius: 10, type: { ghost: false } };
    const ghost = { x: 105, y: 100, radius: 10, type: { ghost: true } };
    const plain = { x: 105, y: 100, radius: 10 };
    collideBodies([walker, ghost, plain], grid);
    assert.ok(walker.x > 105);
    assert.equal(ghost.x, 105);
    assert.ok(plain.x > 105, 'без типа — обычное тело (игрок)');
  });

  test('снаряд гаснет о препятствие и пролетает мимо', () => {
    const grid = gridOf([rock(100, 100)]);
    const hit = { x: 105, y: 100, radius: 5, spent: false };
    const miss = { x: 300, y: 100, radius: 5, spent: false };
    blockShots([hit, miss], grid);
    assert.equal(hit.spent, true);
    assert.equal(miss.spent, false);
  });

  test('снаряд, лишь чиркнувший краем, проходит: гасится при заходе на половину радиуса', () => {
    const grid = gridOf([rock(100, 100, 20)]);
    const grazing = { x: 100 + 20 + 5, y: 100, radius: 5, spent: false }; // касается краем
    blockShots([grazing], grid);
    assert.equal(grazing.spent, false);
  });
});
