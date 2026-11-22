import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Weapon, pruneProjectiles } from '../src/systems/weapons.js';
import { Pool } from '../src/systems/pool.js';
import { near } from './helpers/storage.js';

/** Оружие-пустышка: описание, как у настоящих, но без спрайтов и снарядов. */
function definition(overrides = {}) {
  return {
    id: 'test',
    base: { damage: 10, cooldown: 1, radius: 50, orbSize: 8, count: 1 },
    levels: [
      { text: 'Урон ×2', show: 'damage', apply: (s) => { s.damage *= 2; } },
      { text: 'Ещё один', show: 'count', apply: (s) => { s.count += 1; } },
    ],
    ...overrides,
  };
}

const mods = (overrides = {}) => ({ damage: 1, cooldown: 1, area: 1, ...overrides });

describe('Weapon: уровни', () => {
  test('начинает с первого уровня и базовых характеристик', () => {
    const weapon = new Weapon(definition());
    assert.equal(weapon.level, 1);
    assert.equal(weapon.maxLevel, 3);
    assert.deepEqual(weapon.stats, { damage: 10, cooldown: 1, radius: 50, orbSize: 8, count: 1 });
  });

  test('характеристики — копия: прокачка не портит определение', () => {
    const def = definition();
    const weapon = new Weapon(def);
    weapon.levelUp();
    assert.equal(weapon.stats.damage, 20);
    assert.equal(def.base.damage, 10);
    assert.equal(new Weapon(def).stats.damage, 10);
  });

  test('levelUp применяет описание уровня и повышает номер', () => {
    const weapon = new Weapon(definition());
    weapon.levelUp();
    weapon.levelUp();
    assert.equal(weapon.level, 3);
    assert.equal(weapon.stats.count, 2);
  });

  test('на максимуме повышать нечего, и вызов ничего не ломает', () => {
    const weapon = new Weapon(definition());
    weapon.levelUp();
    weapon.levelUp();
    assert.equal(weapon.canLevelUp, false);
    assert.equal(weapon.nextLevel, null);
    weapon.levelUp();
    assert.equal(weapon.level, 3);
    assert.equal(weapon.stats.damage, 20);
  });

  test('nextLevel — описание следующего уровня', () => {
    const weapon = new Weapon(definition());
    assert.equal(weapon.nextLevel.text, 'Урон ×2');
    weapon.levelUp();
    assert.equal(weapon.nextLevel.text, 'Ещё один');
  });

  test('previewNextStats показывает будущее и ничего не меняет', () => {
    const weapon = new Weapon(definition());
    assert.equal(weapon.previewNextStats().damage, 20);
    assert.equal(weapon.stats.damage, 10);
    assert.equal(weapon.level, 1);
  });

  test('у оружия без уровней (эволюции) повышать нечего с самого начала', () => {
    const weapon = new Weapon(definition({ levels: [] }));
    assert.equal(weapon.canLevelUp, false);
    assert.deepEqual(weapon.previewNextStats(), weapon.stats);
  });

  test('createState получает определение и даёт своё состояние каждому экземпляру', () => {
    const def = definition({ createState: (d) => ({ from: d.id, hits: 0 }) });
    const a = new Weapon(def);
    const b = new Weapon(def);
    a.state.hits += 1;
    assert.equal(a.state.from, 'test');
    assert.equal(b.state.hits, 0);
  });
});

describe('Weapon: effectiveStats', () => {
  test('без пассивок — те же числа', () => {
    assert.deepEqual(new Weapon(definition()).effectiveStats(undefined), new Weapon(definition()).stats);
  });

  test('«Сила» умножает урон, «Спешка» — перезарядку, «Размах» — радиус и размер шара', () => {
    const weapon = new Weapon(definition());
    const stats = weapon.effectiveStats(mods({ damage: 1.5, cooldown: 0.8, area: 1.2 }));
    assert.equal(stats.damage, 15);
    assert.ok(near(stats.cooldown, 0.8));
    assert.ok(near(stats.radius, 60));
    assert.ok(near(stats.orbSize, 9.6));
    assert.equal(stats.count, 1, 'число снарядов пассивки не трогают');
  });

  test('бонусы накладываются при чтении, а не вшиваются в характеристики', () => {
    const weapon = new Weapon(definition());
    weapon.effectiveStats(mods({ damage: 3 }));
    assert.equal(weapon.stats.damage, 10);
  });

  test('характеристика, которой у оружия нет, не появляется', () => {
    const weapon = new Weapon(definition({ base: { cooldown: 1 } }));
    const stats = weapon.effectiveStats(mods({ damage: 2, area: 2 }));
    assert.deepEqual(Object.keys(stats), ['cooldown']);
  });

  test('можно посчитать для чужих характеристик (карточка «станет»)', () => {
    const weapon = new Weapon(definition());
    const after = weapon.effectiveStats(mods({ damage: 2 }), weapon.previewNextStats());
    assert.equal(after.damage, 40);
  });
});

describe('Weapon: update', () => {
  const scene = (m = mods()) => ({ player: { mods: m } });

  test('стреляет, как только перезарядка прошла, и ждёт cooldown', () => {
    let shots = 0;
    const weapon = new Weapon(definition({ fire: () => { shots += 1; return true; } }));
    weapon.update(0.1, scene());
    assert.equal(shots, 1, 'первый залп сразу');
    weapon.update(0.5, scene());
    assert.equal(shots, 1);
    weapon.update(0.5, scene());
    assert.equal(shots, 2);
  });

  test('холостой выстрел не тратит перезарядку', () => {
    let canHit = false;
    let calls = 0;
    const weapon = new Weapon(definition({ fire: () => { calls += 1; return canHit; } }));
    weapon.update(0.1, scene());
    weapon.update(0.1, scene());
    assert.equal(calls, 2, 'оружие пробует каждый кадр');
    canHit = true;
    weapon.update(0.1, scene());
    assert.equal(calls, 3);
    assert.ok(weapon.timer > 0.9);
  });

  test('перезарядка считается по действующим характеристикам', () => {
    const weapon = new Weapon(definition({ fire: () => true }));
    weapon.update(0.1, scene(mods({ cooldown: 0.5 })));
    assert.ok(near(weapon.timer, 0.5));
  });

  test('fire и tick получают характеристики с бонусами', () => {
    const seen = {};
    const weapon = new Weapon(
      definition({
        fire: (stats) => { seen.fire = stats.damage; return true; },
        tick: (_w, _dt, _scene, stats) => { seen.tick = stats.damage; },
      }),
    );
    weapon.update(0.1, scene(mods({ damage: 2 })));
    assert.equal(seen.fire, 20);
    assert.equal(seen.tick, 20);
  });

  test('оружие без fire (только tick) работает каждый кадр', () => {
    let ticks = 0;
    const weapon = new Weapon(definition({ tick: () => { ticks += 1; } }));
    weapon.update(0.016, scene());
    weapon.update(0.016, scene());
    assert.equal(ticks, 2);
  });

  test('без игрока в сцене не падает', () => {
    const weapon = new Weapon(definition({ fire: () => true }));
    assert.doesNotThrow(() => weapon.update(0.1, {}));
  });
});

describe('pruneProjectiles', () => {
  const world = { width: 1000, height: 800 };
  const shot = (x, y, expired = false) => ({ x, y, expired });

  test('убирает отжившие и улетевшие за мир, остальные оставляет', () => {
    const pool = new Pool(() => ({}));
    const keep = [shot(10, 10), shot(500, 400), shot(1000, 800)];
    const list = [...keep, shot(500, 400, true), shot(-1, 10), shot(10, 801), shot(1001, 10), shot(10, -5)];
    pruneProjectiles(list, world, pool);
    assert.equal(list.length, 3);
    for (const k of keep) assert.ok(list.includes(k));
    assert.equal(pool.free.length, 5);
  });
});
