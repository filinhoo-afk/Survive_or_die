/**
 * Проверки данных: локации, враги и спрайты связаны по строковым id, и опечатка
 * в одном месте ломает игру только при заходе в нужную локацию или на нужной
 * минуте забега. Здесь такие опечатки ловятся сразу.
 */
import './helpers/dom.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { atlas } from '../src/art/index.js';
import { ENEMY_TYPES } from '../src/enemies/types.js';
import { LOCATIONS, LOCATION_LIST } from '../src/locations/index.js';
import { PASSIVES } from '../src/systems/upgrades.js';
import { EVOLUTIONS, WEAPONS } from '../src/weapons/index.js';
import { DAILY_LOCATIONS } from '../src/systems/daily.js';
import { CONFIG } from '../src/config.js';

const hasClip = (name) => Object.hasOwn(atlas.clips, name);

describe('атлас', () => {
  test('каждый клип разобран: есть кадры и прямоугольники', () => {
    for (const [name, clip] of Object.entries(atlas.clips)) {
      assert.ok(clip.rects.length > 0, `${name}: нет кадров`);
      for (const rect of clip.rects) {
        assert.ok(rect && rect.w > 0 && rect.h > 0, `${name}: пустой кадр`);
      }
    }
  });

  test('кадры в атласе не налезают друг на друга', () => {
    const rects = new Map();
    for (const clip of Object.values(atlas.clips)) {
      for (const r of clip.rects) rects.set(`${r.x},${r.y},${r.w},${r.h}`, r);
    }
    const list = [...rects.values()];
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.ok(!overlap, `кадры налезают: ${JSON.stringify(a)} и ${JSON.stringify(b)}`);
      }
    }
  });

  test('у героя есть ходьба, стойка и урон в трёх направлениях', () => {
    for (const state of ['idle', 'walk', 'hurt']) {
      for (const side of ['down', 'up', 'side']) assert.ok(hasClip(`hero.${state}.${side}`), `hero.${state}.${side}`);
    }
  });
});

describe('враги', () => {
  const types = Object.values(ENEMY_TYPES);

  test('ключ записи совпадает с id', () => {
    for (const [key, type] of Object.entries(ENEMY_TYPES)) assert.equal(type.id, key);
  });

  test('у каждого есть клипы ходьбы, вспышки и смерти', () => {
    for (const { id } of types) {
      for (const state of ['walk', 'hit', 'death']) assert.ok(hasClip(`${id}.${state}`), `${id}.${state}`);
    }
  });

  test('у стрелков и боссов есть клип прицела — клипы зовутся из кода', () => {
    for (const type of types.filter((t) => t.ranged || t.boss)) assert.ok(hasClip(`${type.id}.aim`), `${type.id}.aim`);
  });

  test('числа осмысленны: здоровье, скорость, урон, радиус положительны', () => {
    for (const type of types) {
      for (const key of ['hp', 'speed', 'damage', 'radius', 'xp', 'mass']) {
        assert.ok(Number.isFinite(type[key]) && type[key] > 0, `${type.id}.${key} = ${type[key]}`);
      }
      assert.ok(type.knockbackResist >= 0 && type.knockbackResist < 1, `${type.id}: сопротивление отбросу`);
      assert.ok(type.pack >= 1 && Number.isInteger(type.pack), `${type.id}.pack`);
    }
  });

  test('обычные враги не крупнее maxRadius из конфига — по нему спавнер держит отступ от края', () => {
    for (const type of types.filter((t) => !t.boss)) {
      assert.ok(type.radius <= CONFIG.enemy.maxRadius, `${type.id}: радиус ${type.radius}`);
    }
  });

  test('боссы не попадают в обычный спавн: from бесконечно и вес нулевой', () => {
    for (const type of types.filter((t) => t.boss)) {
      assert.equal(type.from, Infinity, type.id);
      assert.equal(type.weight, 0, type.id);
    }
  });

  test('стрелок описан целиком: дистанция, перезарядка, прицеливание, снаряд', () => {
    for (const type of types.filter((t) => t.ranged)) {
      for (const key of ['keepDistance', 'cooldown', 'windup', 'damage', 'speed']) {
        assert.ok(type.ranged[key] > 0, `${type.id}.ranged.${key}`);
      }
    }
  });
});

describe('локации', () => {
  test('ключи списка совпадают с id, id не повторяются', () => {
    for (const [key, location] of Object.entries(LOCATIONS)) assert.equal(location.id, key);
    assert.equal(new Set(LOCATION_LIST.map((l) => l.id)).size, LOCATION_LIST.length);
  });

  test('первая локация — Пустошь, без босса и без конца', () => {
    assert.equal(LOCATION_LIST[0].id, 'wasteland');
    assert.equal(LOCATION_LIST[0].duration, null);
    assert.equal(LOCATION_LIST[0].boss, undefined);
  });

  test('враги локации существуют, не боссы, и есть те, что открыты с самого начала', () => {
    for (const location of LOCATION_LIST) {
      assert.ok(location.enemies.length > 0, location.id);
      for (const id of location.enemies) {
        assert.ok(ENEMY_TYPES[id], `${location.id}: нет врага ${id}`);
        assert.ok(!ENEMY_TYPES[id].boss, `${location.id}: босс ${id} в обычном списке`);
      }
      assert.ok(
        location.enemies.some((id) => ENEMY_TYPES[id].from === 0),
        `${location.id}: на нулевой секунде выходить некому`,
      );
    }
  });

  test('босс и длительность идут парой: есть босс — есть таймер, и босс существует', () => {
    for (const location of LOCATION_LIST) {
      if (location.boss) {
        assert.ok(ENEMY_TYPES[location.boss]?.boss, `${location.id}: ${location.boss} — не босс`);
        assert.ok(location.duration > 0, `${location.id}: босс без таймера`);
      } else {
        assert.equal(location.duration, null, `${location.id}: таймер без босса`);
      }
    }
  });

  test('мир не меньше кадра, цвета заданы', () => {
    for (const location of LOCATION_LIST) {
      assert.ok(location.world.width >= CONFIG.width && location.world.height >= CONFIG.height, location.id);
      assert.ok(location.colors.outside && location.colors.border, location.id);
    }
  });

  test('земля: плитки четырёх вариантов, весь декор и препятствия — клипы из атласа', () => {
    for (const location of LOCATION_LIST) {
      for (let i = 0; i < 4; i += 1) assert.ok(hasClip(`ground.${location.id}.${i}`), `ground.${location.id}.${i}`);
      for (const { clip, weight } of location.ground.decor) {
        assert.ok(hasClip(clip), `${location.id}: нет декора ${clip}`);
        assert.ok(weight > 0);
      }
      const cfg = location.obstacles;
      if (!cfg) continue;
      for (const { clip, radius, scale, weight } of [...cfg.kinds, ...(cfg.wall ? [cfg.wall] : [])]) {
        assert.ok(hasClip(clip), `${location.id}: нет препятствия ${clip}`);
        assert.ok(radius > 0 && scale > 0, `${location.id}: ${clip}`);
        if (weight !== undefined) assert.ok(weight > 0);
      }
    }
  });

  test('палитра земли — четыре цвета a, b, c, d', () => {
    for (const location of LOCATION_LIST) {
      assert.deepEqual(Object.keys(location.ground.palette).sort(), ['a', 'b', 'c', 'd'], location.id);
    }
  });

  test('локации испытания дня — настоящие локации', () => {
    for (const id of DAILY_LOCATIONS) assert.ok(LOCATIONS[id], id);
    assert.equal(DAILY_LOCATIONS.length, LOCATION_LIST.length, 'новая локация должна попасть и в расписание, и в SQL');
  });
});

describe('иконки', () => {
  test('у всякого оружия, эволюции и пассивки иконка есть в атласе', () => {
    for (const { id, icon } of [...WEAPONS, ...EVOLUTIONS, ...PASSIVES]) {
      assert.ok(hasClip(`icon.${icon}`), `${id}: нет иконки icon.${icon}`);
    }
  });
});

describe('оружие в атласе', () => {
  test('клипы снарядов и шаров, которые называет эволюция, существуют', () => {
    for (const evolution of EVOLUTIONS) {
      for (const key of ['shotClip', 'ballClip']) {
        if (evolution[key]) assert.ok(hasClip(evolution[key]), `${evolution.id}.${key}: ${evolution[key]}`);
      }
    }
  });
});
