import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { META_UPGRADES, addGold, applyMeta, buy, levelOf, loadMeta, priceOf, runGold } from '../src/systems/meta.js';
import { readSave, resetSaveCache } from '../src/systems/save.js';
import { dropStorage, near, useStorage } from './helpers/storage.js';

const upgrade = (id) => META_UPGRADES.find((u) => u.id === id);

describe('loadMeta', () => {
  beforeEach(() => useStorage());
  afterEach(dropStorage);

  test('без сохранения — пустая казна', () => {
    assert.deepEqual(loadMeta(), { gold: 0, levels: {} });
  });

  test('испорченные данные очищаются', () => {
    useStorage({
      'survive-or-die:save': JSON.stringify({
        version: 1,
        meta: { gold: 12.7, levels: { vitality: 99, might: 2.5, swiftness: -1, unknown: 3, greed: 2 } },
      }),
    });
    const meta = loadMeta();
    assert.equal(meta.gold, 12);
    assert.deepEqual(meta.levels, { vitality: upgrade('vitality').max, greed: 2 });
  });

  test('отрицательное и нечисловое золото — ноль', () => {
    for (const gold of [-5, 'много', NaN, null]) {
      useStorage({ 'survive-or-die:save': JSON.stringify({ version: 1, meta: { gold } }) });
      assert.equal(loadMeta().gold, 0, String(gold));
    }
  });
});

describe('priceOf', () => {
  test('цена растёт с уровнем', () => {
    const might = upgrade('might');
    assert.equal(priceOf({ gold: 0, levels: {} }, might), might.cost);
    assert.equal(priceOf({ gold: 0, levels: { might: 2 } }, might), might.cost * 3);
  });

  test('выкуплено до упора — цены нет', () => {
    const might = upgrade('might');
    assert.equal(priceOf({ gold: 0, levels: { might: might.max } }, might), null);
  });
});

describe('buy', () => {
  beforeEach(() => useStorage());
  afterEach(dropStorage);

  test('покупка списывает золото, повышает уровень и сохраняется', () => {
    const meta = { gold: 100, levels: {} };
    const next = buy(meta, 'vitality');
    assert.deepEqual(next, { gold: 100 - upgrade('vitality').cost, levels: { vitality: 1 } });
    assert.deepEqual(readSave().meta, next);
    resetSaveCache();
    assert.deepEqual(loadMeta(), next);
  });

  test('исходное состояние не меняется', () => {
    const meta = { gold: 100, levels: { vitality: 1 } };
    buy(meta, 'vitality');
    assert.deepEqual(meta, { gold: 100, levels: { vitality: 1 } });
  });

  test('не хватает золота — отказ, и ничего не пишется', () => {
    assert.equal(buy({ gold: upgrade('vitality').cost - 1, levels: {} }, 'vitality'), null);
    assert.equal(readSave().meta, null);
  });

  test('ровно хватает — покупка проходит', () => {
    const next = buy({ gold: upgrade('vitality').cost, levels: {} }, 'vitality');
    assert.equal(next.gold, 0);
  });

  test('неизвестное улучшение — отказ', () => {
    assert.equal(buy({ gold: 9999, levels: {} }, 'nope'), null);
  });

  test('выше максимума не купить, сколько бы ни было золота', () => {
    const max = upgrade('might').max;
    assert.equal(buy({ gold: 99999, levels: { might: max } }, 'might'), null);
  });

  test('купить всё подряд до упора можно, и уровень не уходит за максимум', () => {
    let meta = { gold: 1e9, levels: {} };
    for (const { id, max } of META_UPGRADES) {
      for (let i = 0; i < max + 3; i += 1) meta = buy(meta, id) ?? meta;
      assert.equal(levelOf(meta, id), max);
    }
  });
});

describe('runGold', () => {
  const none = { gold: 0, levels: {} };

  test('за убийства и время', () => {
    assert.equal(runGold(none, { kills: 40, time: 60 }, false), 12); // 40/4 + 60/30
    assert.equal(runGold(none, { kills: 0, time: 0 }, false), 0);
    assert.equal(runGold(none, { kills: 1, time: 10 }, false), 0);
    // Округляется сумма, а не каждое слагаемое: 0.75 + 0.97 = 1.72.
    assert.equal(runGold(none, { kills: 3, time: 29 }, false), 1);
  });

  test('победа над боссом — плюс 50', () => {
    assert.equal(runGold(none, { kills: 40, time: 60 }, true), 62);
  });

  test('«Жадность» прибавляет по 10 % за уровень', () => {
    const greedy = { gold: 0, levels: { greed: 3 } };
    assert.equal(runGold(greedy, { kills: 40, time: 60 }, true), Math.floor(62 * 1.3));
  });
});

describe('addGold', () => {
  beforeEach(() => useStorage());
  afterEach(dropStorage);

  test('кладёт в казну и сохраняет', () => {
    const next = addGold({ gold: 10, levels: { might: 1 } }, 25);
    assert.deepEqual(next, { gold: 35, levels: { might: 1 } });
    assert.equal(readSave().meta.gold, 35);
  });
});

describe('applyMeta', () => {
  const freshPlayer = () => ({ maxHp: 100, hp: 40, speed: 200, magnetRadius: 100, mods: { damage: 1 } });

  test('без улучшений игрок почти не меняется, но здоровье полное', () => {
    const player = freshPlayer();
    applyMeta({ gold: 0, levels: {} }, player);
    assert.equal(player.maxHp, 100);
    assert.equal(player.hp, 100);
    assert.equal(player.speed, 200);
  });

  test('каждое улучшение действует на свою характеристику', () => {
    const player = freshPlayer();
    applyMeta({ gold: 0, levels: { vitality: 2, might: 2, swiftness: 1, magnetism: 2 } }, player);
    assert.equal(player.maxHp, 120);
    assert.equal(player.hp, 120);
    assert.ok(near(player.mods.damage, 1.1));
    assert.ok(near(player.speed, 208));
    assert.ok(near(player.magnetRadius, 130));
  });
});
