import './helpers/dom.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Arsenal } from '../src/systems/arsenal.js';
import { EVOLUTIONS, WEAPONS } from '../src/weapons/index.js';
import { CONFIG } from '../src/config.js';

const evolution = (id) => EVOLUTIONS.find((e) => e.id === id);

describe('Arsenal', () => {
  test('вместимость по умолчанию — из конфига', () => {
    assert.equal(new Arsenal().maxWeapons, CONFIG.arsenal.maxWeapons);
  });

  test('add кладёт оружие первого уровня', () => {
    const arsenal = new Arsenal();
    const weapon = arsenal.add('cannon');
    assert.equal(weapon.id, 'cannon');
    assert.equal(weapon.level, 1);
    assert.deepEqual(arsenal.weapons, [weapon]);
  });

  test('одно и то же оружие дважды не берётся', () => {
    const arsenal = new Arsenal();
    arsenal.add('cannon');
    assert.equal(arsenal.add('cannon'), null);
    assert.equal(arsenal.weapons.length, 1);
  });

  test('больше вместимости не взять', () => {
    const arsenal = new Arsenal(2);
    assert.ok(arsenal.add('cannon'));
    assert.equal(arsenal.hasFreeSlot, true);
    assert.ok(arsenal.add('knife'));
    assert.equal(arsenal.hasFreeSlot, false);
    assert.equal(arsenal.add('orbit'), null);
  });

  test('has видит и само оружие, и его эволюцию', () => {
    const arsenal = new Arsenal();
    const cannon = arsenal.add('cannon');
    assert.equal(arsenal.has('cannon'), true);
    assert.equal(arsenal.has('knife'), false);

    arsenal.evolve(cannon, evolution('thunder'));
    assert.equal(arsenal.has('cannon'), true, 'после эволюции пушку второй раз не предложат');
    assert.equal(arsenal.has('thunder'), true);
    assert.equal(arsenal.add('cannon'), null);
  });

  test('эволюция встаёт на то же место, а не в конец', () => {
    const arsenal = new Arsenal();
    arsenal.add('knife');
    const cannon = arsenal.add('cannon');
    arsenal.add('orbit');

    const evolved = arsenal.evolve(cannon, evolution('thunder'));

    assert.deepEqual(arsenal.weapons.map((w) => w.id), ['knife', 'thunder', 'orbit']);
    assert.equal(arsenal.weapons[1], evolved);
    assert.equal(evolved.level, 1);
  });

  test('чужое оружие эволюционировать нельзя', () => {
    const arsenal = new Arsenal();
    arsenal.add('cannon');
    const stranger = new Arsenal().add('cannon');
    assert.equal(arsenal.evolve(stranger, evolution('thunder')), null);
    assert.deepEqual(arsenal.weapons.map((w) => w.id), ['cannon']);
  });

  test('update обходит всё оружие', () => {
    const arsenal = new Arsenal();
    const calls = [];
    for (const id of ['cannon', 'knife']) {
      arsenal.add(id).update = (dt) => calls.push([id, dt]);
    }
    arsenal.update(0.5, {});
    assert.deepEqual(calls, [['cannon', 0.5], ['knife', 0.5]]);
  });

  test('draw рисует только оружие нужного слоя; по умолчанию слой — «над врагами»', () => {
    const arsenal = new Arsenal();
    const drawn = [];
    for (const id of ['cannon', 'aura']) {
      const weapon = arsenal.add(id);
      weapon.draw = () => drawn.push(`${id}:${weapon.definition.layer ?? 'over'}`);
    }
    arsenal.draw(null, {}, 'under');
    arsenal.draw(null, {}, 'over');
    assert.deepEqual(drawn, ['aura:under', 'cannon:over']);
  });

  test('можно взять любое оружие игры', () => {
    for (const { id } of WEAPONS) {
      assert.ok(new Arsenal().add(id), id);
    }
  });
});
