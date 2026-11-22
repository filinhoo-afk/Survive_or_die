import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from '../src/systems/pool.js';

const make = () => {
  let made = 0;
  return new Pool(() => ({ id: (made += 1), recycled: 0, recycle() { this.recycled += 1; } }), 4);
};

describe('Pool', () => {
  test('пока свободных нет, создаёт новые и считает их', () => {
    const pool = make();
    const a = pool.obtain();
    const b = pool.obtain();
    assert.notEqual(a, b);
    assert.equal(pool.created, 2);
    assert.equal(pool.reused, 0);
  });

  test('возвращённый объект выдаётся снова', () => {
    const pool = make();
    const a = pool.obtain();
    pool.release(a);
    assert.equal(pool.obtain(), a);
    assert.equal(pool.created, 1);
    assert.equal(pool.reused, 1);
  });

  test('при возврате зовёт recycle — объект не держит ссылок, пока ждёт', () => {
    const pool = make();
    const a = pool.obtain();
    pool.release(a);
    assert.equal(a.recycled, 1);
  });

  test('объект без recycle тоже принимается', () => {
    const pool = new Pool(() => ({}));
    assert.doesNotThrow(() => pool.release(pool.obtain()));
  });

  test('лишнее сверх лимита уходит сборщику, но recycle всё равно зовётся', () => {
    const pool = make();
    const items = Array.from({ length: 6 }, () => pool.obtain());
    for (const it of items) pool.release(it);
    assert.equal(pool.free.length, 4);
    assert.ok(items.every((it) => it.recycled === 1));
  });

  test('releaseAll возвращает всё и очищает массив', () => {
    const pool = make();
    const list = [pool.obtain(), pool.obtain(), pool.obtain()];
    pool.releaseAll(list);
    assert.equal(list.length, 0);
    assert.equal(pool.free.length, 3);
  });

  describe('sweep', () => {
    test('убирает отмеченное и отдаёт в пул, остальное не трогает', () => {
      const pool = make();
      const list = Array.from({ length: 6 }, () => pool.obtain());
      const dead = new Set([list[1], list[4]]);
      const alive = list.filter((it) => !dead.has(it));

      pool.sweep(list, (it) => dead.has(it));

      assert.equal(list.length, 4);
      assert.deepEqual([...list].sort((a, b) => a.id - b.id), alive);
      assert.equal(pool.free.length, 2);
      assert.ok([...dead].every((it) => it.recycled === 1));
    });

    test('убирает всё подряд, включая последний и первый', () => {
      const pool = make();
      const list = [pool.obtain(), pool.obtain(), pool.obtain()];
      pool.sweep(list, () => true);
      assert.equal(list.length, 0);
    });

    test('ничего не убирает, если никто не умер', () => {
      const pool = make();
      const list = [pool.obtain(), pool.obtain()];
      const before = [...list];
      pool.sweep(list, () => false);
      assert.deepEqual(list, before);
      assert.equal(pool.free.length, 0);
    });

    test('пустой массив — не беда', () => {
      assert.doesNotThrow(() => make().sweep([], () => true));
    });
  });
});
