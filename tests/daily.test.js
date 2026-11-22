import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_HEROES,
  DAILY_LOCATIONS,
  dailyChallenge,
  dayNumber,
  isDateString,
  todayUtc,
} from '../src/systems/daily.js';
import { LOCATIONS } from '../src/locations/index.js';
import { HEROES } from '../src/systems/heroes.js';

describe('todayUtc', () => {
  test('дата по UTC, а не по местному времени', () => {
    // 23:30 в Нью-Йорке — уже следующие сутки по Гринвичу.
    assert.equal(todayUtc(new Date('2026-11-22T23:30:00-05:00')), '2026-11-23');
    assert.equal(todayUtc(new Date('2026-11-22T00:00:00Z')), '2026-11-22');
    assert.equal(todayUtc(new Date('2026-11-22T23:59:59.999Z')), '2026-11-22');
  });
});

describe('isDateString', () => {
  test('настоящие даты', () => {
    for (const date of ['2026-11-22', '1970-01-01', '2024-02-29']) assert.equal(isDateString(date), true, date);
  });

  test('несуществующие и кривые', () => {
    const bad = ['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-10', '2026-2-3', '20261122', '', ' 2026-11-22'];
    for (const date of bad) assert.equal(isDateString(date), false, date);
  });

  test('не строки', () => {
    for (const value of [null, undefined, 20261122, {}, ['2026-11-22']]) assert.equal(isDateString(value), false);
  });
});

describe('dayNumber', () => {
  test('считает сутки от 1970-01-01', () => {
    assert.equal(dayNumber('1970-01-01'), 0);
    assert.equal(dayNumber('1970-01-02'), 1);
    assert.equal(dayNumber('2000-01-01'), 10957);
    assert.equal(dayNumber('2026-11-22'), 20779);
  });

  test('соседние даты — соседние числа, в том числе через границу года и високосный день', () => {
    assert.equal(dayNumber('2024-03-01') - dayNumber('2024-02-29'), 1);
    assert.equal(dayNumber('2025-01-01') - dayNumber('2024-12-31'), 1);
  });
});

describe('dailyChallenge', () => {
  test('значения заморожены: сервер (004_daily.sql) считает по той же формуле', () => {
    const expected = {
      '1970-01-01': { seed: 0, locationId: 'wasteland', heroId: 'gunner' },
      '1970-01-02': { seed: 2654435761, locationId: 'glacier', heroId: 'thrower' },
      '2026-11-22': { seed: 550662587, locationId: 'ruins', heroId: 'thrower' },
      '2026-11-23': { seed: 3205098348, locationId: 'wasteland', heroId: 'gunner' },
    };
    for (const [date, challenge] of Object.entries(expected)) {
      assert.deepEqual(dailyChallenge(date), { date, ...challenge });
    }
  });

  test('одна дата — одно испытание', () => {
    assert.deepEqual(dailyChallenge('2026-05-05'), dailyChallenge('2026-05-05'));
  });

  test('сид — целое 32-битное беззнаковое', () => {
    for (let day = 0; day < 400; day += 1) {
      const date = new Date(day * 86400000).toISOString().slice(0, 10);
      const { seed } = dailyChallenge(date);
      assert.ok(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32, `${date}: ${seed}`);
    }
  });

  test('соседние дни не дают одинаковых сидов', () => {
    const seeds = new Set();
    for (let day = 20000; day < 20400; day += 1) {
      seeds.add(dailyChallenge(new Date(day * 86400000).toISOString().slice(0, 10)).seed);
    }
    assert.equal(seeds.size, 400);
  });

  test('за год выпадают все локации и все герои, и ни одна не занимает всё время', () => {
    const locations = new Map();
    const heroes = new Map();
    for (let day = 20000; day < 20365; day += 1) {
      const { locationId, heroId } = dailyChallenge(new Date(day * 86400000).toISOString().slice(0, 10));
      locations.set(locationId, (locations.get(locationId) ?? 0) + 1);
      heroes.set(heroId, (heroes.get(heroId) ?? 0) + 1);
    }
    assert.deepEqual([...locations.keys()].sort(), [...DAILY_LOCATIONS].sort());
    assert.deepEqual([...heroes.keys()].sort(), [...DAILY_HEROES].sort());
    for (const count of locations.values()) assert.ok(count > 365 * 0.1, `локация выпала ${count} раз`);
    for (const count of heroes.values()) assert.ok(count > 365 * 0.2, `герой выпал ${count} раз`);
  });

  test('по умолчанию берёт сегодняшнюю дату', () => {
    assert.equal(dailyChallenge().date, todayUtc());
  });
});

describe('списки испытания', () => {
  test('совпадают с локациями и героями игры — иначе испытание запустило бы несуществующее', () => {
    for (const id of DAILY_LOCATIONS) assert.ok(LOCATIONS[id], `нет локации ${id}`);
    for (const id of DAILY_HEROES) assert.ok(HEROES.some((hero) => hero.id === id), `нет героя ${id}`);
  });
});
