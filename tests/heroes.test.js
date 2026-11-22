import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { HEROES, applyHero, loadHeroIndex, saveHeroIndex } from '../src/systems/heroes.js';
import { dropStorage, useStorage } from './helpers/storage.js';

const freshPlayer = () => ({ maxHp: 100, hp: 30, speed: 200 });
const hero = (id) => HEROES.find((h) => h.id === id);

describe('выбор героя', () => {
  beforeEach(() => useStorage());
  afterEach(dropStorage);

  test('без сохранения — первый герой', () => {
    assert.equal(loadHeroIndex(), 0);
  });

  test('выбор запоминается', () => {
    saveHeroIndex(2);
    assert.equal(loadHeroIndex(), 2);
  });

  test('неизвестный герой в сохранении — первый', () => {
    useStorage({ 'survive-or-die:save': JSON.stringify({ version: 1, hero: 'dragon' }) });
    assert.equal(loadHeroIndex(), 0);
  });
});

describe('applyHero', () => {
  test('Стрелок: характеристики не меняются, здоровье полное', () => {
    const player = freshPlayer();
    applyHero(hero('gunner'), player);
    assert.deepEqual(player, { maxHp: 100, hp: 100, speed: 200 });
  });

  test('Метатель быстрее, но хрупче', () => {
    const player = freshPlayer();
    applyHero(hero('thrower'), player);
    assert.equal(player.maxHp, 85);
    assert.equal(player.hp, 85);
    assert.ok(Math.abs(player.speed - 220) < 1e-9);
  });

  test('Страж крепче, но медленнее', () => {
    const player = freshPlayer();
    applyHero(hero('warden'), player);
    assert.equal(player.maxHp, 130);
    assert.equal(player.hp, 130);
    assert.ok(player.speed < 200);
  });
});

describe('данные героев', () => {
  test('у каждого есть уникальный id и стартовое оружие', async () => {
    await import('./helpers/dom.js');
    const { WEAPONS_BY_ID } = await import('../src/weapons/index.js');
    assert.equal(new Set(HEROES.map((h) => h.id)).size, HEROES.length);
    for (const { id, weapon } of HEROES) assert.ok(WEAPONS_BY_ID[weapon], `у героя ${id} нет оружия ${weapon}`);
  });
});
