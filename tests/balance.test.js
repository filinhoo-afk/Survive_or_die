/**
 * Таблицы баланса (src/balance/*.json). JSON не проверяет себя сам: опечатка в
 * имени поля тихо даёт undefined, а дальше NaN вместо здоровья или урона. Здесь
 * ловятся такие опечатки и расхождения с тем, что повторяет те же числа, —
 * текстами в словарях и проверкой рекордов на сервере.
 */
import './helpers/dom.js';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BALANCE, applyChange, weaponLevels } from '../src/balance/index.js';
import { ENEMY_TYPES } from '../src/enemies/types.js';
import { ELITE_MODIFIERS } from '../src/enemies/elites.js';
import { Player } from '../src/entities/player.js';
import { setLanguage } from '../src/i18n/index.js';
import { LOCATIONS } from '../src/locations/index.js';
import { HEROES, applyHero } from '../src/systems/heroes.js';
import { META_UPGRADES } from '../src/systems/meta.js';
import { PASSIVES } from '../src/systems/upgrades.js';
import { Weapon } from '../src/systems/weapons.js';
import { EVOLUTIONS, WEAPONS } from '../src/weapons/index.js';

/** Копия таблиц до того, как их кто-то трогал. */
const PRISTINE = structuredClone(BALANCE);

/** Поля объекта — ровно `required`, плюс любые из `optional`. */
function assertKeys(object, required, where, optional = []) {
  const keys = Object.keys(object);
  for (const key of required) assert.ok(keys.includes(key), `${where}: нет поля ${key}`);
  for (const key of keys) {
    assert.ok(required.includes(key) || optional.includes(key), `${where}: лишнее поле ${key}`);
  }
}

const sameIds = (table, list, where) =>
  assert.deepEqual(Object.keys(table).sort(), list.map((item) => item.id ?? item).sort(), where);

const words = (text) => text.split(' ');

describe('таблицы баланса: форма', () => {
  test('во всех таблицах только конечные неотрицательные числа (кроме добавок add)', () => {
    const walk = (value, where) => {
      if (typeof value === 'number') {
        assert.ok(Number.isFinite(value), `${where} = ${value}`);
        if (!where.includes('.add')) assert.ok(value >= 0, `${where} = ${value}`);
      } else if (value && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) walk(inner, `${where}.${key}`);
      } else {
        assert.ok(value === null || ['string', 'boolean'].includes(typeof value), `${where}: ${typeof value}`);
      }
    };
    walk(BALANCE, 'BALANCE');
  });

  test('игрок', () => {
    const { player } = BALANCE;
    assertKeys(player, words('hero xp crit maxWeapons'), 'player');
    assertKeys(player.hero, words('radius speed maxHp invulnerability'), 'player.hero');
    assertKeys(player.xp, words('base step magnetRadius pullAcceleration maxPullSpeed'), 'player.xp');
    assertKeys(player.crit, words('chance multiplier'), 'player.crit');
    assert.ok(player.crit.chance <= 1);
  });

  test('враги: у каждого типа игры есть строка, и лишних строк нет', () => {
    const { enemies } = BALANCE;
    assertKeys(enemies, words('knockback shot types'), 'enemies');
    assertKeys(enemies.shot, words('radius speed lifetime damage'), 'enemies.shot');
    sameIds(enemies.types, Object.keys(ENEMY_TYPES), 'типы врагов');
    for (const [id, row] of Object.entries(enemies.types)) {
      const common = words('hp speed damage radius xp mass knockbackResist');
      if (ENEMY_TYPES[id].boss) assertKeys(row, common, id);
      else assertKeys(row, [...common, ...words('from weight pack wobble')], id, ['ranged']);
      if (row.ranged) assertKeys(row.ranged, words('keepDistance cooldown windup damage speed'), `${id}.ranged`);
    }
  });

  test('элиты', () => {
    const { elite, modifiers } = BALANCE.elites;
    assertKeys(elite, words('size hp xp mass from chance chancePerMinute maxChance'), 'elite');
    assert.ok(elite.chance <= elite.maxChance && elite.maxChance <= 1);
    sameIds(modifiers, Object.keys(ELITE_MODIFIERS), 'модификаторы');
    for (const [id, row] of Object.entries(modifiers)) {
      assertKeys(row, [], id, words('hp speed damage xp knockbackResist drop'));
      assert.ok(Object.keys(row).length > 0, `${id}: модификатор ничего не меняет`);
    }
  });

  test('спавнер', () => {
    assertKeys(BALANCE.spawner, words('interval waveSize maxEnemies margin ramp'), 'spawner');
    assertKeys(
      BALANCE.spawner.ramp,
      words('waveSizeEvery intervalShrinkPerMinute minInterval maxEnemiesPerMinute hpPerMinute'),
      'spawner.ramp',
    );
    assert.ok(BALANCE.spawner.ramp.minInterval > 0, 'нулевой интервал — волна в каждом кадре');
    assert.ok(BALANCE.spawner.ramp.waveSizeEvery > 0);
  });

  test('локации', () => {
    sameIds(BALANCE.locations, Object.keys(LOCATIONS), 'локации');
    for (const [id, row] of Object.entries(BALANCE.locations)) assertKeys(row, words('duration enemies'), id);
  });

  test('предметы', () => {
    const { items } = BALANCE;
    assertKeys(items, words('crates pickups enemyDropChance loot'), 'items');
    assertKeys(items.crates, words('count hp gemValue'), 'items.crates');
    assertKeys(items.pickups, words('lifetime reach healRatio bombDamage'), 'items.pickups');
    assertKeys(items.loot, words('heal magnet bomb gem'), 'items.loot');
    assert.ok(items.enemyDropChance <= 1 && items.pickups.healRatio <= 1);
  });

  test('золото и магазин', () => {
    assertKeys(BALANCE.meta, words('gold upgrades'), 'meta');
    assertKeys(BALANCE.meta.gold, words('killsPerGold secondsPerGold victoryBonus'), 'meta.gold');
    assert.ok(BALANCE.meta.gold.killsPerGold > 0 && BALANCE.meta.gold.secondsPerGold > 0);
    sameIds(BALANCE.meta.upgrades, META_UPGRADES, 'улучшения магазина');
    for (const [id, row] of Object.entries(BALANCE.meta.upgrades)) assertKeys(row, words('max cost step'), id);
  });

  test('пассивки: у каждой потолок ранга и ровно одно из mul и add', () => {
    assertKeys(BALANCE.upgrades, words('cardWeight passives'), 'upgrades');
    assertKeys(BALANCE.upgrades.cardWeight, words('newWeapon weaponLevel passive'), 'cardWeight');
    sameIds(BALANCE.upgrades.passives, PASSIVES, 'пассивки');
    for (const [id, row] of Object.entries(BALANCE.upgrades.passives)) {
      assertKeys(row, ['maxRank'], id, ['mul', 'add']);
      assert.equal(('mul' in row) !== ('add' in row), true, `${id}: нужно что-то одно`);
      assert.ok(Number.isInteger(row.maxRank) && row.maxRank > 0, id);
    }
  });

  test('герои: оружие из списка, меняются только настоящие характеристики игрока', () => {
    sameIds(BALANCE.heroes, HEROES, 'герои');
    const player = new Player(0, 0);
    for (const [id, row] of Object.entries(BALANCE.heroes)) {
      assertKeys(row, ['weapon'], id, ['mul', 'add']);
      assert.ok(WEAPONS.some((w) => w.id === row.weapon), `${id}: нет оружия ${row.weapon}`);
      for (const key of Object.keys({ ...row.mul, ...row.add })) {
        assert.equal(typeof player[key], 'number', `${id}: у игрока нет характеристики ${key}`);
      }
    }
  });

  test('оружие: уровни меняют существующие характеристики и показывают изменённую', () => {
    const { weapons, projectile } = BALANCE.weapons;
    assertKeys(projectile, words('radius speed lifetime damage'), 'projectile');
    const base = {
      cannon: words('cooldown damage range speed count pierce'),
      knife: words('cooldown damage speed lifetime count pierce spread'),
      orbit: words('count damage radius orbSize rotation hitInterval'),
      aura: words('radius damage cooldown knockback'),
    };
    sameIds(weapons, WEAPONS, 'оружие');
    for (const [id, row] of Object.entries(weapons)) {
      assertKeys(row, words('base levels'), id);
      assertKeys(row.base, base[id], `${id}.base`);
      row.levels.forEach((level, i) => {
        const where = `${id}, уровень ${i + 2}`;
        assertKeys(level, ['show'], where, ['mul', 'add']);
        const changed = [...Object.keys(level.mul ?? {}), ...Object.keys(level.add ?? {})];
        assert.equal(new Set(changed).size, changed.length, `${where}: характеристика и в mul, и в add`);
        for (const key of changed) assert.ok(key in row.base, `${where}: нет характеристики ${key}`);
        assert.ok(changed.includes(level.show), `${where}: show «${level.show}» не меняется`);
      });
    }
  });

  test('эволюции: все характеристики исходного оружия на месте', () => {
    const extra = { thunder: ['shotRadius'], blades: [], bastion: ['blocksShots'], sanctum: ['heal'] };
    sameIds(BALANCE.weapons.evolutions, EVOLUTIONS, 'эволюции');
    for (const [id, row] of Object.entries(BALANCE.weapons.evolutions)) {
      assertKeys(row, words('from requires base'), id);
      const source = BALANCE.weapons.weapons[row.from];
      assert.ok(source, `${id}: нет оружия ${row.from}`);
      assert.ok(row.requires in BALANCE.upgrades.passives, `${id}: нет пассивки ${row.requires}`);
      assertKeys(row.base, [...Object.keys(source.base), ...extra[id]], `${id}.base`);
    }
  });
});

describe('таблицы баланса: боссы', () => {
  const shot = words('damage speed radius lifetime');
  const PHASE_KEYS = {
    guardian: words('until speed cooldown windup shot ring fan'),
    necromancer: words('until speed keep summon teleport ring shot'),
    iceworm: words('until speed surface dive telegraph strike spikes spike ring shot'),
    abyssal: words('until speed cooldown windup shot ring fan teleport summon rifts'),
  };
  const NESTED = {
    guardian: { shot },
    necromancer: { shot, summon: words('count cooldown windup'), teleport: words('cooldown distance') },
    iceworm: { shot, strike: words('radius damage'), spike: words('radius damage') },
    abyssal: {
      shot,
      teleport: words('cooldown distance'),
      summon: words('type count'),
      rifts: words('count cooldown telegraph radius damage'),
    },
  };

  test('строка есть у каждого босса игры', () => {
    sameIds(BALANCE.bosses, Object.keys(ENEMY_TYPES).filter((id) => ENEMY_TYPES[id].boss), 'боссы');
  });

  test('фазы описаны целиком', () => {
    for (const [id, boss] of Object.entries(BALANCE.bosses)) {
      assertKeys(boss, ['phases'], id, ['summonLimit']);
      boss.phases.forEach((phase, i) => {
        const where = `${id}, фаза ${i + 1}`;
        assertKeys(phase, PHASE_KEYS[id], where, ['spread']);
        if (phase.fan > 0) assert.ok(phase.fan > 1 && phase.spread > 0, `${where}: вееру нужны spread и два снаряда`);
        for (const [key, keys] of Object.entries(NESTED[id])) {
          if (phase[key]) assertKeys(phase[key], keys, `${where}.${key}`);
        }
        if (phase.ring > 0 && 'shot' in phase) assert.ok(phase.shot, `${where}: залп без снаряда`);
        const type = phase.summon?.type;
        if (type) assert.ok(ENEMY_TYPES[type] && !ENEMY_TYPES[type].boss, `${where}: призывает ${type}`);
      });
    }
  });

  test('пороги фаз убывают до нуля, а скорость первой совпадает со скоростью босса', () => {
    for (const [id, { phases }] of Object.entries(BALANCE.bosses)) {
      const until = phases.map((p) => p.until);
      assert.deepEqual(until, [...until].sort((a, b) => b - a), id);
      assert.equal(until.at(-1), 0, id);
      assert.equal(phases[0].speed, ENEMY_TYPES[id].speed, id);
    }
  });
});

describe('applyChange и уровни из таблицы', () => {
  test('сначала множитель, потом добавка', () => {
    assert.deepEqual(applyChange({ a: 10, b: 1 }, { mul: { a: 2 }, add: { a: 1, b: -1 } }), { a: 21, b: 0 });
  });

  test('без mul и add ничего не меняется', () => {
    assert.deepEqual(applyChange({ a: 10 }, {}), { a: 10 });
  });

  test('уровень оружия меняет переданные характеристики', () => {
    const [level] = weaponLevels([{ show: 'damage', mul: { damage: 3 } }]);
    const stats = { damage: 5 };
    level.apply(stats);
    assert.equal(level.show, 'damage');
    assert.equal(stats.damage, 15);
  });

  test('прокачка не портит сами таблицы: следующий забег начинается с тех же чисел', () => {
    for (const definition of [...WEAPONS, ...EVOLUTIONS]) {
      const weapon = new Weapon(definition);
      while (weapon.canLevelUp) weapon.levelUp();
    }
    const player = new Player(0, 0);
    for (const hero of HEROES) applyHero(hero, player);
    for (const passive of PASSIVES) passive.set(player, passive.next(passive.get(player)));
    assert.deepEqual(BALANCE, PRISTINE);
  });
});

describe('тексты с цифрами совпадают с таблицами', () => {
  afterEach(() => setLanguage('ru'));

  const numbers = (text) => (text.match(/\d+(\.\d+)?/g) ?? []).map(Number).sort((a, b) => a - b);
  const percent = (factor) => Math.round(Math.abs(factor - 1) * 100);
  const share = (value) => Math.round(Math.abs(value) * 100);

  /** Проверяет на обоих языках, что в тексте стоят именно эти числа. */
  function assertNumbers(read, expected, where) {
    for (const language of ['ru', 'en']) {
      setLanguage(language);
      assert.deepEqual(numbers(read()), [...expected].sort((a, b) => a - b), `${where} (${language}): «${read()}»`);
    }
  }

  test('пассивки', () => {
    const rows = BALANCE.upgrades.passives;
    const expected = {
      speed: [percent(rows.speed.mul)],
      vitality: [rows.vitality.add, rows.vitality.add],
      might: [share(rows.might.add)],
      haste: [share(rows.haste.add)],
      area: [share(rows.area.add)],
      regen: [rows.regen.add],
      armor: [rows.armor.add],
      magnet: [percent(rows.magnet.mul)],
    };
    for (const passive of PASSIVES) assertNumbers(() => passive.text, expected[passive.id], passive.id);
  });

  test('улучшения магазина', () => {
    for (const upgrade of META_UPGRADES) {
      // Здоровье прибавляется числом, остальное — долей.
      const value = upgrade.id === 'vitality' ? upgrade.step : share(upgrade.step);
      assertNumbers(() => upgrade.desc, [value], upgrade.id);
    }
  });

  test('герои', () => {
    for (const hero of HEROES) {
      const { mul = {}, add = {} } = BALANCE.heroes[hero.id];
      const expected = [...Object.values(mul).map(percent), ...Object.values(add).map(Math.abs)];
      assertNumbers(() => hero.desc, expected, hero.id);
    }
  });

  test('уровни оружия: проценты в тексте — из множителей уровня', () => {
    for (const weapon of WEAPONS) {
      BALANCE.weapons.weapons[weapon.id].levels.forEach((row, i) => {
        const allowed = Object.values(row.mul ?? {}).map(percent);
        for (const language of ['ru', 'en']) {
          setLanguage(language);
          const { text } = weapon.levels[i];
          const where = `${weapon.id}, уровень ${i + 2} (${language}): «${text}»`;
          assert.equal(numbers(text).length > 0, allowed.length > 0, where);
          for (const value of numbers(text)) assert.ok(allowed.includes(value), where);
        }
      });
    }
  });
});

describe('проверка рекордов на сервере считает по тем же числам', () => {
  const sql = readFileSync(new URL('../supabase/migrations/002_plausibility.sql', import.meta.url), 'utf8')
    .replace(/\s+/g, ' ');
  const hint = 'поправь supabase/migrations/002_plausibility.sql и выполни его в Supabase';
  const contains = (fragment) => assert.ok(sql.includes(fragment), `в SQL нет «${fragment}» — ${hint}`);

  const { spawner, elites, enemies, items, player } = BALANCE;
  const types = Object.values(ENEMY_TYPES);

  test('локации: секунда выхода босса, его здоровье, стаи и здоровье врагов', () => {
    for (const location of Object.values(LOCATIONS)) {
      const row = sql.match(
        new RegExp(
          `when '${location.id}' then boss_at := (\\w+); boss_hp := (\\d+); max_pack := (\\d+); min_hp := (\\d+); max_hp := (\\d+);`,
        ),
      );
      assert.ok(row, `в SQL нет локации ${location.id} — ${hint}`);
      const local = location.enemies.map((id) => ENEMY_TYPES[id]);
      assert.deepEqual(
        row.slice(1),
        [
          location.duration,
          location.boss ? ENEMY_TYPES[location.boss].hp : 0,
          Math.max(...local.map((type) => type.pack)),
          Math.min(...local.map((type) => type.hp)),
          Math.max(...local.map((type) => type.hp)),
        ].map(String),
        `${location.id} — ${hint}`,
      );
    }
  });

  test('волны и кривая сложности', () => {
    const { interval, waveSize, maxEnemies, ramp } = spawner;
    contains(`least(${waveSize} * max_pack, ${maxEnemies})`);
    contains(`greatest(${ramp.minInterval}, ${interval} - ${ramp.intervalShrinkPerMinute} * t / 60)`);
    contains(
      `least((${waveSize} + floor(t / ${ramp.waveSizeEvery})) * max_pack, ceil(${maxEnemies} + ${ramp.maxEnemiesPerMinute} * t / 60))`,
    );
    contains(`max_alive := ${maxEnemies} + ${ramp.maxEnemiesPerMinute} * minutes`);
  });

  test('потолок урона: самая живучая элита и рост здоровья', () => {
    const toughest = elites.elite.hp * Math.max(...Object.values(elites.modifiers).map((m) => m.hp ?? 1));
    contains(`max_hp * ${toughest} * (1 + ${spawner.ramp.hpPerMinute} * minutes)`);
  });

  test('потолок уровня: опыт от врагов, босса и ящиков', () => {
    // Формула суммы в SQL верна, только пока первый уровень стоит столько же, сколько надбавка.
    assert.equal(player.xp.base, player.xp.step, `изменилась формула опыта — ${hint}`);
    const regular = Math.max(...types.filter((t) => !t.boss).map((t) => t.xp));
    const richest = elites.elite.xp * Math.max(...Object.values(elites.modifiers).map((m) => m.xp ?? 1));
    const boss = Math.max(...types.filter((t) => t.boss).map((t) => enemies.types[t.id].xp));
    const crates = items.crates.count * items.crates.gemValue;
    contains(
      `${player.xp.step / 2} * (p_level - 1)::numeric * p_level > ${regular * richest} * p_kills::numeric + ${boss} + ${crates}`,
    );
  });
});
