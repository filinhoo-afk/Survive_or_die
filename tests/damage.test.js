import './helpers/dom.js';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { applyContactDamage, removeDead, resolveEnemyShotHits, resolveProjectileHits } from '../src/systems/damage.js';
import { nearestEnemies } from '../src/systems/targeting.js';
import { SpatialGrid } from '../src/systems/grid.js';
import { Enemy } from '../src/entities/enemy.js';
import { Player } from '../src/entities/player.js';
import { ENEMY_TYPES } from '../src/enemies/types.js';
import { CONFIG } from '../src/config.js';

beforeEach(() => mock.method(Math, 'random', () => 0.99)); // криты выключены
afterEach(() => mock.restoreAll());

const gridOf = (enemies) => new SpatialGrid(2000, 2000).rebuild(enemies);
const enemyAt = (x, y, type = ENEMY_TYPES.grunt) => new Enemy(x, y, type);

function shot(x, y, overrides = {}) {
  return {
    x, y, radius: 5, vx: 100, vy: 0, damage: 10, pierce: 0,
    hitEnemies: new Set(), expired: false, spent: false,
    ...overrides,
  };
}

describe('касание врагов', () => {
  test('враг вплотную бьёт игрока на свой урон', () => {
    const player = new Player(500, 500);
    const enemy = enemyAt(510, 500);
    assert.equal(applyContactDamage(player, gridOf([enemy])), enemy);
    assert.equal(player.hp, CONFIG.player.maxHp - enemy.damage);
  });

  test('враг рядом, но не касается — урона нет', () => {
    const player = new Player(500, 500);
    const enemy = enemyAt(500 + player.radius + ENEMY_TYPES.grunt.radius + 5, 500);
    assert.equal(applyContactDamage(player, gridOf([enemy])), null);
    assert.equal(player.hp, player.maxHp);
  });

  test('граница касания включительно', () => {
    const player = new Player(500, 500);
    const enemy = enemyAt(500 + player.radius + ENEMY_TYPES.grunt.radius, 500);
    assert.equal(applyContactDamage(player, gridOf([enemy])), enemy);
  });

  test('во время неуязвимости не бьёт', () => {
    const player = new Player(500, 500);
    player.invulnerableFor = 0.5;
    assert.equal(applyContactDamage(player, gridOf([enemyAt(500, 500)])), null);
    assert.equal(player.hp, player.maxHp);
  });

  test('мёртвого игрока не бьёт', () => {
    const player = new Player(500, 500);
    player.alive = false;
    assert.equal(applyContactDamage(player, gridOf([enemyAt(500, 500)])), null);
  });

  test('враг под землёй не касается', () => {
    const player = new Player(500, 500);
    const enemy = enemyAt(500, 500);
    enemy.underground = true;
    assert.equal(applyContactDamage(player, gridOf([enemy])), null);
  });

  test('толпа бьёт один раз за кадр: дальше неуязвимость', () => {
    const player = new Player(500, 500);
    const crowd = [enemyAt(500, 500), enemyAt(505, 500), enemyAt(500, 505)];
    const grid = gridOf(crowd);
    applyContactDamage(player, grid);
    applyContactDamage(player, grid);
    assert.equal(player.hp, player.maxHp - crowd[0].damage);
  });
});

describe('вражеские снаряды', () => {
  const enemyShot = (x, y, overrides = {}) => ({ x, y, radius: 6, damage: 10, expired: false, spent: false, ...overrides });

  test('попадание: урон игроку, снаряд израсходован', () => {
    const player = new Player(500, 500);
    const s = enemyShot(505, 500);
    resolveEnemyShotHits([s], player);
    assert.equal(player.hp, player.maxHp - 10);
    assert.equal(s.spent, true);
  });

  test('мимо — ничего', () => {
    const player = new Player(500, 500);
    const s = enemyShot(600, 500);
    resolveEnemyShotHits([s], player);
    assert.equal(player.hp, player.maxHp);
    assert.equal(s.spent, false);
  });

  test('во время неуязвимости снаряд пролетает насквозь', () => {
    const player = new Player(500, 500);
    player.invulnerableFor = 0.4;
    const s = enemyShot(500, 500);
    resolveEnemyShotHits([s], player);
    assert.equal(player.hp, player.maxHp);
    assert.equal(s.spent, false);
  });

  test('отжившие снаряды игнорируются', () => {
    const player = new Player(500, 500);
    resolveEnemyShotHits([enemyShot(500, 500, { expired: true })], player);
    assert.equal(player.hp, player.maxHp);
  });

  test('игрок мёртв — снаряды не трогают', () => {
    const player = new Player(500, 500);
    player.alive = false;
    const s = enemyShot(500, 500);
    resolveEnemyShotHits([s], player);
    assert.equal(s.spent, false);
  });
});

describe('попадания снарядов во врагов', () => {
  test('снаряд бьёт врага и исчезает', () => {
    const enemy = enemyAt(500, 500);
    const s = shot(500, 500);
    const killed = resolveProjectileHits([s], gridOf([enemy]));
    assert.equal(enemy.hp, enemy.maxHp - 10);
    assert.equal(s.spent, true);
    assert.deepEqual(killed, []);
  });

  test('возвращает убитых', () => {
    const weak = enemyAt(500, 500, ENEMY_TYPES.swarm);
    const killed = resolveProjectileHits([shot(500, 500, { damage: 999 })], gridOf([weak]));
    assert.deepEqual(killed, [weak]);
    assert.equal(weak.alive, false);
  });

  test('мимо — враг цел, снаряд летит дальше', () => {
    const enemy = enemyAt(500, 500);
    const s = shot(700, 500);
    resolveProjectileHits([s], gridOf([enemy]));
    assert.equal(enemy.hp, enemy.maxHp);
    assert.equal(s.spent, false);
  });

  test('пробивающий снаряд проходит насквозь столько врагов, сколько умеет, и ещё одного, на котором гаснет', () => {
    const line = [enemyAt(500, 500), enemyAt(505, 500), enemyAt(510, 500), enemyAt(515, 500)];
    const s = shot(505, 500, { pierce: 2 });
    resolveProjectileHits([s], gridOf(line));
    const hit = line.filter((e) => e.hp < e.maxHp);
    assert.equal(hit.length, 3, 'пробитие 2 = три попадания');
    assert.equal(s.spent, true);
  });

  test('каждого врага снаряд задевает один раз, даже за несколько кадров', () => {
    const enemy = enemyAt(500, 500);
    const s = shot(500, 500, { pierce: 5 });
    const grid = gridOf([enemy]);
    resolveProjectileHits([s], grid);
    resolveProjectileHits([s], grid);
    resolveProjectileHits([s], grid);
    assert.equal(enemy.hp, enemy.maxHp - 10);
    assert.equal(s.pierce, 4);
  });

  test('отжившие снаряды и мёртвые враги не участвуют', () => {
    const dead = enemyAt(500, 500);
    dead.alive = false;
    const live = enemyAt(900, 900);
    const ghostShot = shot(900, 900, { expired: true });
    resolveProjectileHits([shot(500, 500), ghostShot], gridOf([dead, live]));
    assert.equal(live.hp, live.maxHp);
  });

  test('враги под землёй неуязвимы для снарядов', () => {
    const enemy = enemyAt(500, 500);
    enemy.underground = true;
    const s = shot(500, 500);
    resolveProjectileHits([s], gridOf([enemy]));
    assert.equal(enemy.hp, enemy.maxHp);
    assert.equal(s.spent, false);
  });

  test('отброс идёт по направлению полёта', () => {
    const enemy = enemyAt(500, 500);
    resolveProjectileHits([shot(500, 500, { vx: 0, vy: -50 })], gridOf([enemy]));
    assert.ok(enemy.y < 500);
    assert.equal(enemy.x, 500);
  });

  test('неподвижный снаряд (скорость 0) не даёт NaN', () => {
    const enemy = enemyAt(500, 500);
    resolveProjectileHits([shot(500, 500, { vx: 0, vy: 0 })], gridOf([enemy]));
    assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.y));
  });
});

describe('removeDead', () => {
  test('убирает мёртвых, живых не трогает', () => {
    const a = enemyAt(0, 0);
    const b = enemyAt(1, 1);
    const c = enemyAt(2, 2);
    b.alive = false;
    const list = [a, b, c];
    removeDead(list);
    assert.equal(list.length, 2);
    assert.ok(list.includes(a) && list.includes(c));
  });

  test('если мёртв последний или все — тоже работает', () => {
    const list = [enemyAt(0, 0), enemyAt(1, 1)];
    list[1].alive = false;
    removeDead(list);
    assert.equal(list.length, 1);
    list[0].alive = false;
    removeDead(list);
    assert.equal(list.length, 0);
  });
});

describe('nearestEnemies', () => {
  const from = { x: 500, y: 500 };

  test('ближайшие, от ближнего к дальнему, не больше count', () => {
    const e1 = enemyAt(500, 600);
    const e2 = enemyAt(500, 520);
    const e3 = enemyAt(500, 560);
    const found = nearestEnemies(from, gridOf([e1, e2, e3]), 300, 2);
    assert.deepEqual(found, [e2, e3]);
  });

  test('за пределами радиуса не берёт', () => {
    assert.deepEqual(nearestEnemies(from, gridOf([enemyAt(500, 900)]), 300, 5), []);
  });

  test('мёртвых и подземных пропускает', () => {
    const dead = enemyAt(500, 510);
    dead.alive = false;
    const buried = enemyAt(500, 520);
    buried.underground = true;
    const live = enemyAt(500, 530);
    assert.deepEqual(nearestEnemies(from, gridOf([dead, buried, live]), 300, 3), [live]);
  });

  test('пустая сетка — пустой ответ', () => {
    assert.deepEqual(nearestEnemies(from, gridOf([]), 300, 3), []);
  });
});
