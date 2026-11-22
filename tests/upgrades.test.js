import './helpers/dom.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { PASSIVES, UpgradeState } from '../src/systems/upgrades.js';
import { Arsenal } from '../src/systems/arsenal.js';
import { EVOLUTIONS, WEAPONS } from '../src/weapons/index.js';
import { near } from './helpers/storage.js';

function newPlayer() {
  return { speed: 200, maxHp: 100, hp: 100, regen: 0, armor: 0, magnetRadius: 100, mods: { damage: 1, cooldown: 1, area: 1 } };
}

function setup({ weapons = ['cannon'], maxWeapons } = {}) {
  const arsenal = new Arsenal(maxWeapons);
  for (const id of weapons) arsenal.add(id);
  const player = newPlayer();
  return { arsenal, player, state: new UpgradeState(arsenal, player) };
}

const card = (state, id) => state.candidates().find((c) => c.id === id);
const ids = (cards) => cards.map((c) => c.id);

/** Берёт пассивку нужное число раз: карточку каждый раз собираем заново, ранг зашит в неё. */
function takePassive(state, id, times = 1) {
  for (let i = 0; i < times; i += 1) card(state, `passive:${id}`).apply();
}

function maxOut(weapon) {
  while (weapon.canLevelUp) weapon.levelUp();
}

describe('пассивки', () => {
  const player = () => newPlayer();
  const passive = (id) => PASSIVES.find((p) => p.id === id);
  const apply = (id, p = player()) => {
    const def = passive(id);
    def.set(p, def.next(def.get(p)));
    return p;
  };

  test('«Лёгкие ботинки» +10 % скорости', () => assert.ok(near(apply('speed').speed, 220)));
  test('«Сила» +0.1 к множителю урона', () => assert.ok(near(apply('might').mods.damage, 1.1)));
  test('«Спешка» −0.08 к перезарядке', () => assert.ok(near(apply('haste').mods.cooldown, 0.92)));
  test('«Размах» +0.1 к площади', () => assert.ok(near(apply('area').mods.area, 1.1)));
  test('«Регенерация» +0.4 в секунду', () => assert.ok(near(apply('regen').regen, 0.4)));
  test('«Броня» +1', () => assert.equal(apply('armor').armor, 1));
  test('«Магнит» +35 % радиуса', () => assert.ok(near(apply('magnet').magnetRadius, 135)));

  test('«Крепкое сердце» повышает максимум и лечит на 20, но не выше максимума', () => {
    const hurt = { ...player(), hp: 50 };
    apply('vitality', hurt);
    assert.equal(hurt.maxHp, 120);
    assert.equal(hurt.hp, 70);

    const nearlyFull = { ...player(), hp: 95 };
    apply('vitality', nearlyFull);
    assert.equal(nearlyFull.hp, 115);

    // Полное здоровье остаётся полным: максимум вырос на 20, и лечение догоняет его.
    const full = apply('vitality');
    assert.equal(full.hp, full.maxHp);
  });

  test('у каждой пассивки есть всё нужное для карточки', () => {
    for (const p of PASSIVES) {
      for (const key of ['id', 'title', 'text', 'color', 'icon', 'maxRank', 'get', 'next', 'set', 'format']) {
        assert.ok(key in p, `${p.id}: нет ${key}`);
      }
      assert.equal(typeof p.format(p.get(player())), 'string', p.id);
    }
    assert.equal(new Set(PASSIVES.map((p) => p.id)).size, PASSIVES.length);
  });

  test('«Спешка» на максимуме не обнуляет перезарядку и не делает её отрицательной', () => {
    const p = player();
    const haste = passive('haste');
    for (let i = 0; i < haste.maxRank; i += 1) haste.set(p, haste.next(haste.get(p)));
    assert.ok(p.mods.cooldown > 0.5, `${p.mods.cooldown}`);
  });
});

describe('UpgradeState: карточки-кандидаты', () => {
  test('с одной пушкой: уровень пушки, три новых оружия и все пассивки', () => {
    const { state } = setup();
    const got = ids(state.candidates());
    assert.ok(got.includes('level:cannon'));
    for (const id of ['knife', 'orbit', 'aura']) assert.ok(got.includes(`new:${id}`), id);
    assert.ok(!got.includes('new:cannon'), 'пушка у игрока уже есть');
    for (const { id } of PASSIVES) assert.ok(got.includes(`passive:${id}`), id);
    assert.equal(got.length, 1 + 3 + PASSIVES.length);
  });

  test('когда мест под оружие нет, новое не предлагается', () => {
    const { state } = setup({ weapons: ['cannon', 'knife'], maxWeapons: 2 });
    assert.ok(!ids(state.candidates()).some((id) => id.startsWith('new:')));
  });

  test('оружие на максимуме не предлагают прокачать', () => {
    const { arsenal, state } = setup();
    maxOut(arsenal.weapons[0]);
    assert.ok(!ids(state.candidates()).includes('level:cannon'));
  });

  test('пассивка, взятая до максимального ранга, исчезает из выбора', () => {
    const { state } = setup();
    const max = PASSIVES.find((p) => p.id === 'armor').maxRank;
    takePassive(state, 'armor', max - 1);
    assert.ok(ids(state.candidates()).includes('passive:armor'));
    takePassive(state, 'armor');
    assert.ok(!ids(state.candidates()).includes('passive:armor'));
    assert.equal(state.rank('armor'), max);
  });

  test('в пустом наборе без свободных мест и пассивок предлагать нечего', () => {
    const arsenal = new Arsenal(0);
    const state = new UpgradeState(arsenal, newPlayer(), { passives: [], weapons: WEAPONS, evolutions: [] });
    assert.deepEqual(state.candidates(), []);
    assert.deepEqual(state.roll(3), []);
  });
});

describe('UpgradeState: карточки', () => {
  test('карточка оружия действует: берёт оружие в арсенал', () => {
    const { arsenal, state } = setup();
    card(state, 'new:knife').apply();
    assert.ok(arsenal.has('knife'));
  });

  test('карточка уровня повышает оружие', () => {
    const { arsenal, state } = setup();
    card(state, 'level:cannon').apply();
    assert.equal(arsenal.weapons[0].level, 2);
  });

  test('карточка уровня показывает «было → станет» с учётом пассивок игрока', () => {
    const { player, state } = setup();
    assert.deepEqual(card(state, 'level:cannon').preview, ['20', '25']);
    player.mods.damage = 1.5;
    assert.deepEqual(card(state, 'level:cannon').preview, ['30', '38']);
  });

  test('карточки уровней у всего оружия собираются на каждом уровне — формат характеристики известен', () => {
    for (const definition of WEAPONS) {
      const { arsenal, state } = setup({ weapons: [definition.id] });
      const weapon = arsenal.weapons[0];
      while (weapon.canLevelUp) {
        const level = card(state, `level:${definition.id}`);
        assert.equal(level.preview.length, 2, `${definition.id} уровень ${weapon.level}`);
        assert.ok(level.preview.every((text) => typeof text === 'string' && !text.includes('undefined') && !text.includes('NaN')), `${definition.id}: ${level.preview}`);
        weapon.levelUp();
      }
    }
  });

  test('карточка пассивки: «новое», потом «ранг 1 → 2»', () => {
    const { state } = setup();
    assert.equal(card(state, 'passive:speed').badge, 'новое');
    takePassive(state, 'speed');
    assert.equal(card(state, 'passive:speed').badge, 'ранг 1 → 2');
  });

  test('карточка пассивки показывает «было → станет»', () => {
    const { state } = setup();
    assert.deepEqual(card(state, 'passive:armor').preview, ['0', '1']);
    assert.deepEqual(card(state, 'passive:might').preview, ['+0%', '+10%']);
  });

  test('первый ранг пассивки, нужной для эволюции, помечен ключом', () => {
    const { state } = setup();
    const might = card(state, 'passive:might');
    assert.equal(might.badge, 'ключ к эволюции');
    assert.ok(might.badgeColor);
    assert.equal(card(state, 'passive:speed').badge, 'новое', 'для пушки нужна только «Сила»');

    takePassive(state, 'might');
    assert.equal(card(state, 'passive:might').badge, 'ранг 1 → 2');
  });
});

describe('эволюции', () => {
  test('готова, когда оружие на максимуме и есть пассивка', () => {
    const { arsenal, state } = setup();
    assert.deepEqual(state.readyEvolutions(), []);

    maxOut(arsenal.weapons[0]);
    assert.deepEqual(state.readyEvolutions(), [], 'пассивки ещё нет');

    takePassive(state, 'might');
    assert.deepEqual(ids(state.readyEvolutions()), ['evolve:cannon']);
  });

  test('не готова, если оружие не дотянуто до максимума', () => {
    const { state } = setup();
    takePassive(state, 'might');
    assert.deepEqual(state.readyEvolutions(), []);
  });

  test('не готова с чужой пассивкой', () => {
    const { arsenal, state } = setup();
    maxOut(arsenal.weapons[0]);
    takePassive(state, 'haste');
    assert.deepEqual(state.readyEvolutions(), []);
  });

  test('карточка эволюции заменяет оружие', () => {
    const { arsenal, state } = setup();
    maxOut(arsenal.weapons[0]);
    takePassive(state, 'might');
    state.readyEvolutions()[0].apply();
    assert.deepEqual(arsenal.weapons.map((w) => w.id), ['thunder']);
    assert.deepEqual(state.readyEvolutions(), [], 'эволюционировавшее оружие второй раз не превращается');
  });

  test('рецепты: пушка+Сила, нож+Спешка, щит+Броня, аура+Регенерация', () => {
    const recipes = {
      cannon: ['might', 'thunder'],
      knife: ['haste', 'blades'],
      orbit: ['armor', 'bastion'],
      aura: ['regen', 'sanctum'],
    };
    for (const [weaponId, [passiveId, evolutionId]] of Object.entries(recipes)) {
      const { arsenal, state } = setup({ weapons: [weaponId] });
      maxOut(arsenal.weapons[0]);
      takePassive(state, passiveId);
      state.readyEvolutions()[0].apply();
      assert.deepEqual(arsenal.weapons.map((w) => w.id), [evolutionId], weaponId);
    }
  });

  test('готовая эволюция попадает в выбор всегда, и первой', () => {
    const { arsenal, state } = setup();
    maxOut(arsenal.weapons[0]);
    takePassive(state, 'might');
    for (const seed of [0, 0.3, 0.7, 0.999]) {
      const picked = state.roll(3, () => seed);
      assert.equal(picked[0].id, 'evolve:cannon', `random=${seed}`);
      assert.equal(picked.length, 3);
    }
  });
});

describe('UpgradeState.roll', () => {
  test('возвращает столько разных карточек, сколько просили', () => {
    const { state } = setup();
    for (let i = 0; i < 50; i += 1) {
      const picked = ids(state.roll(3));
      assert.equal(picked.length, 3);
      assert.equal(new Set(picked).size, 3, `повтор: ${picked}`);
    }
  });

  test('карточек меньше, чем просили, — отдаёт сколько есть', () => {
    const arsenal = new Arsenal(0);
    const state = new UpgradeState(arsenal, newPlayer(), { passives: PASSIVES.slice(0, 2), weapons: [], evolutions: [] });
    assert.equal(state.roll(3).length, 2);
  });

  test('выбор взвешен: при нуле берётся первая карточка, при почти единице — последняя', () => {
    const { state } = setup();
    const all = ids(state.candidates());
    assert.equal(state.roll(1, () => 0)[0].id, all[0]);
    assert.equal(state.roll(1, () => 0.999999)[0].id, all.at(-1));
  });

  test('оружейные карточки выпадают чаще пассивок — у них вес выше', () => {
    const { state } = setup();
    let seed = 1;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    let weaponCards = 0;
    let passiveCards = 0;
    for (let i = 0; i < 3000; i += 1) {
      const [first] = state.roll(1, random);
      if (first.id.startsWith('passive:')) passiveCards += 1;
      else weaponCards += 1;
    }
    // Оружейных карточек 4 по весу 3 (=12), пассивок 8 по весу 1 (=8): ожидаем 60 % на 40 %.
    const share = weaponCards / (weaponCards + passiveCards);
    assert.ok(share > 0.55 && share < 0.65, `доля оружейных ${share}`);
  });
});

describe('summary', () => {
  test('оружие с уровнями и пассивки с рангами', () => {
    const { arsenal, state } = setup({ weapons: ['cannon', 'knife'] });
    arsenal.weapons[0].levelUp();
    takePassive(state, 'armor', 2);
    assert.equal(state.summary(), 'Пушка 2 · Нож 1 · Броня 2');
  });

  test('у эволюции уровня нет — только название', () => {
    const { arsenal, state } = setup();
    maxOut(arsenal.weapons[0]);
    takePassive(state, 'might');
    state.readyEvolutions()[0].apply();
    assert.equal(state.summary(), 'Громобой · Сила 1');
  });

  test('без пассивок их нет в сводке', () => {
    assert.equal(setup().state.summary(), 'Пушка 1');
  });
});

describe('данные оружия и эволюций', () => {
  test('у эволюции есть исходное оружие и существующая пассивка, и нет уровней', () => {
    const weaponIds = WEAPONS.map((w) => w.id);
    const passiveIds = PASSIVES.map((p) => p.id);
    for (const evolution of EVOLUTIONS) {
      assert.ok(weaponIds.includes(evolution.evolvesFrom), `${evolution.id}: нет оружия ${evolution.evolvesFrom}`);
      assert.ok(passiveIds.includes(evolution.requires), `${evolution.id}: нет пассивки ${evolution.requires}`);
      assert.deepEqual(evolution.levels, [], `${evolution.id}: у эволюции уровней нет`);
    }
  });

  test('одно оружие превращается только в одну эволюцию', () => {
    const from = EVOLUTIONS.map((e) => e.evolvesFrom);
    assert.equal(new Set(from).size, from.length);
  });

  test('id оружия и эволюций не пересекаются', () => {
    const all = [...WEAPONS, ...EVOLUTIONS].map((w) => w.id);
    assert.equal(new Set(all).size, all.length);
  });

  test('у всякого оружия есть название, описание, цвет, иконка и базовые характеристики', () => {
    for (const weapon of [...WEAPONS, ...EVOLUTIONS]) {
      for (const key of ['id', 'title', 'description', 'color', 'icon', 'base', 'levels']) {
        assert.ok(weapon[key] !== undefined, `${weapon.id}: нет ${key}`);
      }
      assert.ok(weapon.fire || weapon.tick, `${weapon.id}: оружие ничего не делает`);
    }
  });

  test('каждый уровень описан текстом и показывает существующую характеристику', () => {
    for (const weapon of WEAPONS) {
      const stats = { ...weapon.base };
      weapon.levels.forEach((level, i) => {
        assert.ok(level.text, `${weapon.id} уровень ${i + 2}: нет текста`);
        assert.equal(typeof level.apply, 'function');
        assert.ok(level.show in stats, `${weapon.id} уровень ${i + 2}: show «${level.show}» нет среди характеристик`);
        level.apply(stats);
        for (const [key, value] of Object.entries(stats)) {
          assert.ok(Number.isFinite(value), `${weapon.id} уровень ${i + 2}: ${key} = ${value}`);
        }
      });
    }
  });

  test('прокачка идёт на пользу: урон и частота не падают, перезарядка не растёт', () => {
    for (const weapon of WEAPONS) {
      const stats = { ...weapon.base };
      for (const level of weapon.levels) {
        const before = { ...stats };
        level.apply(stats);
        if ('damage' in stats) assert.ok(stats.damage >= before.damage, `${weapon.id}: урон упал`);
        if ('cooldown' in stats) assert.ok(stats.cooldown <= before.cooldown, `${weapon.id}: перезарядка выросла`);
      }
    }
  });
});
