import { afterEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, random, seedLabel, seedRun, unseedRun } from '../src/systems/rng.js';

const take = (next, count) => Array.from({ length: count }, () => next());

describe('mulberry32', () => {
  test('один сид — одна и та же последовательность', () => {
    assert.deepEqual(take(mulberry32(42), 20), take(mulberry32(42), 20));
  });

  test('разные сиды дают разные последовательности', () => {
    assert.notDeepEqual(take(mulberry32(1), 5), take(mulberry32(2), 5));
  });

  test('значения лежат в [0, 1)', () => {
    for (const value of take(mulberry32(7), 5000)) {
      assert.ok(value >= 0 && value < 1, `вышло за границы: ${value}`);
    }
  });

  test('сид читается как 32-битное беззнаковое: -1 и 0xFFFFFFFF — одно и то же', () => {
    assert.deepEqual(take(mulberry32(-1), 5), take(mulberry32(0xffffffff), 5));
  });

  test('числа разбросаны ровно: средняя около 0.5, десять корзин почти одинаковы', () => {
    const values = take(mulberry32(2024), 10000);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    assert.ok(Math.abs(mean - 0.5) < 0.02, `среднее ${mean}`);

    const buckets = new Array(10).fill(0);
    for (const v of values) buckets[Math.floor(v * 10)] += 1;
    for (const count of buckets) assert.ok(count > 850 && count < 1150, `корзина ${count}`);
  });

  test('формула заморожена: от неё зависит испытание дня, у всех игроков мир должен совпасть', () => {
    const next = mulberry32(1);
    assert.deepEqual(take(next, 3), [0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  });
});

describe('потоки забега', () => {
  afterEach(() => {
    unseedRun();
    mock.restoreAll();
  });

  test('один сид — одни и те же числа в обоих потоках', () => {
    seedRun(99);
    const first = [take(() => random('spawn'), 10), take(() => random('world'), 10)];
    seedRun(99);
    const second = [take(() => random('spawn'), 10), take(() => random('world'), 10)];
    assert.deepEqual(first, second);
  });

  test('потоки не повторяют друг друга', () => {
    seedRun(99);
    assert.notDeepEqual(take(() => random('spawn'), 8), take(() => random('world'), 8));
  });

  test('поток по умолчанию — world', () => {
    seedRun(5);
    const viaDefault = take(() => random(), 5);
    seedRun(5);
    assert.deepEqual(viaDefault, take(() => random('world'), 5));
  });

  test('траты одного потока не сдвигают другой: волны не зависят от действий игрока', () => {
    seedRun(7);
    const quiet = take(() => random('spawn'), 10);

    seedRun(7);
    random('world');
    random('world');
    random('world');
    assert.deepEqual(take(() => random('spawn'), 10), quiet);
  });

  test('unseedRun возвращает обычную случайность', () => {
    mock.method(Math, 'random', () => 0.123);
    seedRun(1);
    assert.notEqual(random('spawn'), 0.123);
    unseedRun();
    assert.equal(random('spawn'), 0.123);
    assert.equal(random('world'), 0.123);
  });

  test('без сида числа берутся из Math.random', () => {
    mock.method(Math, 'random', () => 0.5);
    assert.equal(random(), 0.5);
  });
});

describe('seedLabel', () => {
  test('восемь шестнадцатеричных цифр, заглавными', () => {
    assert.equal(seedLabel(0), '00000000');
    assert.equal(seedLabel(255), '000000FF');
    assert.equal(seedLabel(0xdeadbeef), 'DEADBEEF');
  });

  test('отрицательное число читается как беззнаковое', () => {
    assert.equal(seedLabel(-1), 'FFFFFFFF');
  });
});
