import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SpatialGrid } from '../src/systems/grid.js';
import { mulberry32 } from '../src/systems/rng.js';

const item = (x, y, radius = 10) => ({ x, y, radius });

describe('SpatialGrid', () => {
  test('находит близкое и не тащит дальнее', () => {
    const near = item(100, 100);
    const far = item(900, 700);
    const grid = new SpatialGrid(1000, 800).rebuild([near, far]);
    const found = [...grid.query(110, 110, 30)];
    assert.ok(found.includes(near));
    assert.ok(!found.includes(far));
  });

  test('объект, сдвинутый на весь запас после постройки, всё ещё находится', () => {
    // Клетка 64, запас 24. Объект построен на левой кромке клетки 5 (x = 320),
    // потом отброшен на 24 влево — он уже в клетке 4, а лежит в списке клетки 5.
    const grid = new SpatialGrid(1000, 800, 64, 24);
    const o = item(320, 100, 10);
    grid.rebuild([o]);
    o.x -= 24;
    // Запрос слева касается его ровно по краю: 296 − 281 = 15 = range + radius.
    assert.ok(grid.query(281, 100, 5).includes(o));
  });

  test('размеры сетки покрывают мир целиком и не бывают нулевыми', () => {
    const grid = new SpatialGrid(1000, 800, 64);
    assert.equal(grid.cols, 16);
    assert.equal(grid.rows, 13);
    const tiny = new SpatialGrid(0, 0);
    assert.ok(tiny.cols >= 1 && tiny.rows >= 1);
  });

  test('крупные объекты попадают в любой запрос, даже издалека', () => {
    const boss = item(900, 700, 40);
    const grid = new SpatialGrid(1000, 800).rebuild([boss]);
    assert.deepEqual([...grid.query(10, 10, 5)], [boss]);
  });

  test('rebuild забывает прошлое', () => {
    const a = item(100, 100);
    const b = item(120, 120);
    const grid = new SpatialGrid(1000, 800).rebuild([a]);
    grid.rebuild([b]);
    const found = [...grid.query(110, 110, 50)];
    assert.deepEqual(found, [b]);
  });

  test('rebuild забывает и крупные объекты', () => {
    const grid = new SpatialGrid(1000, 800).rebuild([item(500, 400, 50)]);
    grid.rebuild([]);
    assert.equal(grid.query(500, 400, 100).length, 0);
  });

  test('объект за краем мира кладётся в крайнюю клетку и находится', () => {
    const outside = item(-30, -30);
    const beyond = item(1100, 900);
    const grid = new SpatialGrid(1000, 800).rebuild([outside, beyond]);
    assert.ok(grid.query(0, 0, 20).includes(outside));
    assert.ok(grid.query(999, 799, 20).includes(beyond));
  });

  test('запрос из-за края мира не падает', () => {
    const grid = new SpatialGrid(1000, 800).rebuild([item(10, 10)]);
    assert.doesNotThrow(() => grid.query(-500, -500, 30));
    assert.doesNotThrow(() => grid.query(5000, 5000, 30));
  });

  test('свой буфер out позволяет вкладывать запросы', () => {
    const a = item(100, 100);
    const b = item(500, 500);
    const grid = new SpatialGrid(1000, 800).rebuild([a, b]);
    const mine = [];
    const first = grid.query(100, 100, 20, mine);
    assert.equal(first, mine);
    grid.query(500, 500, 20); // общий буфер, мой остался нетронутым
    assert.deepEqual(mine, [a]);
  });

  test('без своего буфера ответ лежит в общем — старый ответ затирается', () => {
    const a = item(100, 100);
    const b = item(500, 500);
    const grid = new SpatialGrid(1000, 800).rebuild([a, b]);
    const first = grid.query(100, 100, 20);
    const second = grid.query(500, 500, 20);
    assert.equal(first, second);
  });

  describe('против перебора всех со всеми', () => {
    const world = { width: 1000, height: 800 };

    function scatter(count, random) {
      return Array.from({ length: count }, () => item(random() * world.width, random() * world.height, 6 + random() * 26));
    }

    const touching = (list, x, y, range) => list.filter((o) => Math.hypot(o.x - x, o.y - y) <= range + o.radius);

    test('сетка не пропускает ни одного касающегося объекта', () => {
      const random = mulberry32(2026);
      const items = scatter(400, random);
      const grid = new SpatialGrid(world.width, world.height).rebuild(items);

      for (let i = 0; i < 300; i += 1) {
        const x = random() * world.width;
        const y = random() * world.height;
        const range = 5 + random() * 140;
        const candidates = new Set(grid.query(x, y, range));
        for (const o of touching(items, x, y, range)) assert.ok(candidates.has(o), `пропущен объект (${o.x}, ${o.y})`);
      }
    });

    test('и после сдвигов в пределах запаса, пока сетку не перестроили', () => {
      const random = mulberry32(7);
      const items = scatter(300, random);
      const grid = new SpatialGrid(world.width, world.height, 64, 24).rebuild(items);

      for (const o of items) {
        const angle = random() * Math.PI * 2;
        const shift = random() * 24;
        o.x += Math.cos(angle) * shift;
        o.y += Math.sin(angle) * shift;
      }

      for (let i = 0; i < 300; i += 1) {
        const x = random() * world.width;
        const y = random() * world.height;
        const range = 5 + random() * 100;
        const candidates = new Set(grid.query(x, y, range));
        for (const o of touching(items, x, y, range)) assert.ok(candidates.has(o), `пропущен объект (${o.x}, ${o.y})`);
      }
    });

    test('сетка выигрывает: кандидатов заметно меньше, чем объектов', () => {
      const random = mulberry32(99);
      const items = scatter(500, random).map((o) => ({ ...o, radius: 10 }));
      const grid = new SpatialGrid(world.width, world.height).rebuild(items);
      assert.ok(grid.query(500, 400, 40).length < items.length / 5);
    });
  });
});
