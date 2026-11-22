import './helpers/dom.js';
import { afterEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPickup,
  buildCrates,
  crateLoot,
  enemyDrop,
  hitCrates,
  removeBroken,
  rollEliteDrop,
  updatePickups,
} from '../src/systems/items.js';
import { Crate } from '../src/entities/crate.js';
import { Pickup } from '../src/entities/pickup.js';
import { Enemy } from '../src/entities/enemy.js';
import { ENEMY_TYPES } from '../src/enemies/types.js';
import { seedRun, unseedRun } from '../src/systems/rng.js';

afterEach(() => {
  mock.restoreAll();
  unseedRun();
});

const WORLD = { width: 2880, height: 1800 };

describe('ящики на карте', () => {
  test('расставляются по миру в нужном количестве', () => {
    seedRun(1);
    const crates = buildCrates(WORLD, []);
    assert.equal(crates.length, 16);
  });

  test('не у краёв, не на старте, не внутри препятствий и не друг на друге', () => {
    seedRun(2);
    const obstacles = [{ x: 1000, y: 800, radius: 60 }, { x: 1800, y: 1000, radius: 40 }];
    const crates = buildCrates(WORLD, obstacles);
    for (const crate of crates) {
      assert.ok(crate.x >= 120 && crate.x <= WORLD.width - 120 && crate.y >= 120 && crate.y <= WORLD.height - 120);
      assert.ok(Math.hypot(crate.x - WORLD.width / 2, crate.y - WORLD.height / 2) >= 220, 'на старте героя');
      for (const o of obstacles) assert.ok(Math.hypot(o.x - crate.x, o.y - crate.y) >= o.radius + 40, 'в препятствии');
    }
    for (let i = 0; i < crates.length; i += 1) {
      for (let j = i + 1; j < crates.length; j += 1) {
        assert.ok(Math.hypot(crates[i].x - crates[j].x, crates[i].y - crates[j].y) >= 120, 'ящики слиплись');
      }
    }
  });

  test('на одном сиде — та же расстановка', () => {
    seedRun(3);
    const first = buildCrates(WORLD, []).map((c) => [c.x, c.y]);
    seedRun(3);
    assert.deepEqual(buildCrates(WORLD, []).map((c) => [c.x, c.y]), first);
  });
});

describe('ящики и снаряды', () => {
  const shot = (x, y, overrides = {}) => ({ x, y, radius: 5, pierce: 0, expired: false, spent: false, ...overrides });

  test('ящик ломается с трёх попаданий', () => {
    const crate = new Crate(100, 100);
    const shots = [shot(100, 100), shot(100, 100), shot(100, 100)];
    assert.deepEqual(hitCrates(shots, [crate]), [crate]);
    assert.equal(crate.alive, false);
  });

  test('одно попадание не ломает', () => {
    const crate = new Crate(100, 100);
    assert.deepEqual(hitCrates([shot(100, 100)], [crate]), []);
    assert.equal(crate.hp, crate.maxHp - 1);
  });

  test('снаряд бьёт один и тот же ящик не больше раза', () => {
    const crate = new Crate(100, 100);
    const s = shot(100, 100, { pierce: 5 });
    hitCrates([s], [crate]);
    hitCrates([s], [crate]);
    assert.equal(crate.hp, crate.maxHp - 1);
  });

  test('снаряд без пробития расходуется, с пробитием летит дальше', () => {
    const a = new Crate(100, 100);
    const b = new Crate(110, 100);
    const plain = shot(105, 100);
    hitCrates([plain], [a, b]);
    assert.equal(plain.spent, true);
    assert.equal(a.hp + b.hp, a.maxHp * 2 - 1);

    const c = new Crate(100, 100);
    const d = new Crate(110, 100);
    const piercing = shot(105, 100, { pierce: 1 });
    hitCrates([piercing], [c, d]);
    assert.equal(c.hp + d.hp, c.maxHp * 2 - 2);
  });

  test('отжившие снаряды ящики не бьют', () => {
    const crate = new Crate(100, 100);
    hitCrates([shot(100, 100, { expired: true })], [crate]);
    assert.equal(crate.hp, crate.maxHp);
  });

  test('removeBroken убирает разбитые', () => {
    const live = new Crate(0, 0);
    const broken = new Crate(1, 1);
    broken.hp = 0;
    const list = [live, broken];
    removeBroken(list);
    assert.deepEqual(list, [live]);
  });
});

describe('лут', () => {
  test('из ящика выпадает только известное, и всё встречается', () => {
    seedRun(4);
    const seen = new Set();
    for (let i = 0; i < 300; i += 1) seen.add(crateLoot());
    assert.deepEqual([...seen].sort(), ['bomb', 'gem', 'heal', 'magnet']);
  });

  test('награда элиты — всегда предмет, не кристалл', () => {
    seedRun(5);
    for (let i = 0; i < 200; i += 1) assert.ok(['heal', 'magnet', 'bomb'].includes(rollEliteDrop()));
  });

  test('из врага предмет выпадает редко: у Math.random 0.01 — выпал, 0.5 — нет', () => {
    mock.method(Math, 'random', () => 0.01);
    assert.ok(['heal', 'magnet', 'bomb'].includes(enemyDrop()));
    mock.restoreAll();
    mock.method(Math, 'random', () => 0.5);
    assert.equal(enemyDrop(), null);
  });
});

describe('подбор предметов', () => {
  const player = (overrides = {}) => ({ x: 100, y: 100, radius: 14, hp: 20, maxHp: 100, ...overrides });

  test('аптечка лечит на 30 % от максимума, но не выше него', () => {
    const p = player();
    applyPickup({ kind: 'heal' }, { player: p, gems: [], enemies: [] });
    assert.equal(p.hp, 50);
    const full = player({ hp: 90 });
    applyPickup({ kind: 'heal' }, { player: full, gems: [], enemies: [] });
    assert.equal(full.hp, 100);
  });

  test('магнит притягивает все кристаллы', () => {
    const gems = [{ pulled: false }, { pulled: false }];
    applyPickup({ kind: 'magnet' }, { player: player(), gems, enemies: [] });
    assert.ok(gems.every((g) => g.pulled));
  });

  test('бомба бьёт всех, но не босса и не подземных, и возвращает убитых', () => {
    mock.method(Math, 'random', () => 0.99);
    const weak = new Enemy(0, 0, ENEMY_TYPES.swarm);
    const tough = new Enemy(0, 0, ENEMY_TYPES.tank);
    const buried = new Enemy(0, 0, ENEMY_TYPES.swarm);
    buried.underground = true;
    const boss = new Enemy(0, 0, ENEMY_TYPES.tank);
    const dead = new Enemy(0, 0, ENEMY_TYPES.swarm);
    dead.alive = false;

    const killed = applyPickup({ kind: 'bomb' }, { player: player(), gems: [], enemies: [weak, tough, buried, boss, dead], boss });

    assert.deepEqual(killed, [weak]);
    assert.ok(tough.hp < tough.maxHp && tough.alive);
    assert.equal(buried.hp, buried.maxHp);
    assert.equal(boss.hp, boss.maxHp);
  });
});

describe('updatePickups', () => {
  test('подобранное возвращается, из списка уходит', () => {
    const near = new Pickup(100, 100, 'heal');
    const far = new Pickup(900, 900, 'bomb');
    const list = [near, far];
    const taken = updatePickups(list, { x: 100, y: 100, radius: 14 }, 0.016);
    assert.deepEqual(taken, [near]);
    assert.deepEqual(list, [far]);
  });

  test('просроченное тихо исчезает, ничего не отдавая', () => {
    const old = new Pickup(900, 900, 'magnet');
    old.life = 0.01;
    const list = [old];
    const taken = updatePickups(list, { x: 0, y: 0, radius: 14 }, 0.1);
    assert.deepEqual(taken, []);
    assert.deepEqual(list, []);
  });
});
