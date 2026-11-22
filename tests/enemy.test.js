import './helpers/dom.js';
import { afterEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { Enemy, setHitListener } from '../src/entities/enemy.js';
import { ELITE, ELITE_MODIFIERS, eliteChance, rollModifier } from '../src/enemies/elites.js';
import { ENEMY_TYPES } from '../src/enemies/types.js';
import { CONFIG } from '../src/config.js';
import { seedRun, unseedRun } from '../src/systems/rng.js';

afterEach(() => {
  mock.restoreAll();
  setHitListener(null);
  unseedRun();
});

/** Криты выключены или включены наверняка: шанс сравнивается с Math.random(). */
const noCrits = () => mock.method(Math, 'random', () => 0.99);
const alwaysCrit = () => mock.method(Math, 'random', () => 0);

describe('характеристики врага', () => {
  test('обычный враг берёт всё у своего типа', () => {
    const type = ENEMY_TYPES.grunt;
    const enemy = new Enemy(10, 20, type);
    assert.equal(enemy.maxHp, type.hp);
    assert.equal(enemy.hp, type.hp);
    assert.equal(enemy.radius, type.radius);
    assert.equal(enemy.speed, type.speed);
    assert.equal(enemy.damage, type.damage);
    assert.equal(enemy.xp, type.xp);
    assert.equal(enemy.elite, false);
    assert.equal(enemy.alive, true);
  });

  test('здоровье растёт с множителем забега и округляется', () => {
    assert.equal(new Enemy(0, 0, ENEMY_TYPES.grunt, 1.5).maxHp, 60);
    assert.equal(new Enemy(0, 0, ENEMY_TYPES.grunt, 1.234).maxHp, Math.round(40 * 1.234));
  });

  test('по умолчанию враг — рядовой', () => {
    assert.equal(new Enemy(0, 0).type, ENEMY_TYPES.grunt);
  });

  test('элита крупнее, живучее и дороже по опыту', () => {
    const base = new Enemy(0, 0, ENEMY_TYPES.grunt);
    const elite = new Enemy(0, 0, ENEMY_TYPES.grunt, 1, ELITE_MODIFIERS.rich);
    assert.equal(elite.elite, true);
    assert.ok(elite.radius > base.radius);
    assert.equal(elite.spriteScale, Math.round(ENEMY_TYPES.grunt.spriteScale * ELITE.size));
    assert.equal(elite.maxHp, Math.round(base.maxHp * ELITE.hp));
    assert.equal(elite.xp, base.xp * ELITE.xp * ELITE_MODIFIERS.rich.xp);
    assert.equal(elite.mass, base.mass * 2);
  });

  test('модификаторы: бронированный, проворный, свирепый', () => {
    const base = new Enemy(0, 0, ENEMY_TYPES.grunt);
    const armored = new Enemy(0, 0, ENEMY_TYPES.grunt, 1, ELITE_MODIFIERS.armored);
    assert.equal(armored.maxHp, Math.round(base.maxHp * ELITE.hp * 2));
    assert.ok(armored.knockbackResist > base.knockbackResist);

    const swift = new Enemy(0, 0, ENEMY_TYPES.grunt, 1, ELITE_MODIFIERS.swift);
    assert.equal(swift.speed, base.speed * 1.5);

    const brutal = new Enemy(0, 0, ENEMY_TYPES.grunt, 1, ELITE_MODIFIERS.brutal);
    assert.equal(brutal.damage, Math.round(base.damage * 1.7));
  });

  test('сопротивление отбросу не выше 0.95: враг не становится несдвигаемым', () => {
    const armoredTank = new Enemy(0, 0, ENEMY_TYPES.tank, 1, ELITE_MODIFIERS.armored);
    assert.ok(armoredTank.knockbackResist <= 0.95);
  });
});

describe('элиты: шанс и модификаторы', () => {
  test('до определённой секунды элит нет', () => {
    assert.equal(eliteChance(0), 0);
    assert.equal(eliteChance(ELITE.from - 1), 0);
  });

  test('с первой секунды появления — стартовый шанс, дальше растёт и упирается в потолок', () => {
    assert.ok(Math.abs(eliteChance(ELITE.from) - ELITE.chance) < 1e-12);
    assert.ok(eliteChance(ELITE.from + 60) > eliteChance(ELITE.from));
    assert.equal(eliteChance(100000), ELITE.maxChance);
  });

  test('шанс не убывает со временем', () => {
    let last = 0;
    for (let t = 0; t <= 1800; t += 15) {
      const chance = eliteChance(t);
      assert.ok(chance >= last, `на ${t} с шанс упал`);
      last = chance;
    }
  });

  test('rollModifier отдаёт только известные модификаторы и все четыре встречаются', () => {
    seedRun(11);
    const seen = new Set();
    for (let i = 0; i < 200; i += 1) {
      const modifier = rollModifier();
      assert.ok(Object.values(ELITE_MODIFIERS).includes(modifier));
      seen.add(modifier.id);
    }
    assert.equal(seen.size, Object.keys(ELITE_MODIFIERS).length);
  });

  test('на одном сиде выбор повторяется — испытание дня у всех одно', () => {
    seedRun(5);
    const first = Array.from({ length: 20 }, () => rollModifier().id);
    seedRun(5);
    assert.deepEqual(Array.from({ length: 20 }, () => rollModifier().id), first);
  });
});

describe('takeHit', () => {
  test('снимает здоровье, красит вспышкой и отбрасывает по направлению удара', () => {
    noCrits();
    const enemy = new Enemy(100, 100, ENEMY_TYPES.grunt);
    const killed = enemy.takeHit(15, 1, 0);
    assert.equal(killed, false);
    assert.equal(enemy.hp, 25);
    assert.equal(enemy.flashFor, CONFIG.enemy.hitFlash);
    assert.ok(enemy.x > 100);
    assert.equal(enemy.y, 100);
  });

  test('смертельный удар возвращает true и убивает', () => {
    noCrits();
    const enemy = new Enemy(0, 0, ENEMY_TYPES.grunt);
    assert.equal(enemy.takeHit(1000, 1, 0), true);
    assert.equal(enemy.alive, false);
    assert.equal(enemy.hp, 0);
  });

  test('мёртвого не добить второй раз — убийство засчитывается один раз', () => {
    noCrits();
    const enemy = new Enemy(0, 0, ENEMY_TYPES.grunt);
    enemy.takeHit(1000, 1, 0);
    assert.equal(enemy.takeHit(1000, 1, 0), false);
  });

  test('под землёй враг неуязвим', () => {
    noCrits();
    const enemy = new Enemy(0, 0, ENEMY_TYPES.grunt);
    enemy.underground = true;
    assert.equal(enemy.takeHit(1000, 1, 0), false);
    assert.equal(enemy.hp, enemy.maxHp);
  });

  test('критический удар множит урон', () => {
    alwaysCrit();
    const enemy = new Enemy(0, 0, ENEMY_TYPES.grunt);
    enemy.takeHit(10, 1, 0);
    assert.equal(enemy.hp, enemy.maxHp - Math.round(10 * CONFIG.crit.multiplier));
  });

  test('слушатель попаданий получает врага, урон и признак крита', () => {
    const calls = [];
    setHitListener((enemy, damage, crit) => calls.push([damage, crit]));

    noCrits();
    new Enemy(0, 0, ENEMY_TYPES.grunt).takeHit(10, 1, 0);
    mock.restoreAll();
    alwaysCrit();
    new Enemy(0, 0, ENEMY_TYPES.grunt).takeHit(10, 1, 0);

    assert.deepEqual(calls, [
      [10, false],
      [Math.round(10 * CONFIG.crit.multiplier), true],
    ]);
  });

  test('отброс слабее у тяжёлых и при малом knockbackScale', () => {
    noCrits();
    const light = new Enemy(0, 0, ENEMY_TYPES.grunt);
    const heavy = new Enemy(0, 0, ENEMY_TYPES.tank);
    light.takeHit(1, 1, 0);
    heavy.takeHit(1, 1, 0);
    assert.ok(light.x > heavy.x, 'у танка сопротивление отбросу');

    const gentle = new Enemy(0, 0, ENEMY_TYPES.grunt);
    gentle.takeHit(1, 1, 0, 0.25);
    assert.ok(gentle.x < light.x);
    assert.ok(Math.abs(gentle.x - light.x * 0.25) < 1e-9);
  });

  test('урон никогда не уводит здоровье ниже нуля', () => {
    noCrits();
    const enemy = new Enemy(0, 0, ENEMY_TYPES.swarm);
    enemy.takeHit(5000, 0, 1);
    assert.equal(enemy.hp, 0);
  });
});

describe('движение врага', () => {
  test('бежит к цели со своей скоростью', () => {
    const enemy = new Enemy(0, 0, ENEMY_TYPES.grunt);
    enemy.update(1, { x: 1000, y: 0 });
    assert.ok(Math.abs(enemy.x - enemy.speed) < 1e-9);
    assert.ok(Math.abs(enemy.y) < 1e-9);
  });

  test('вплотную стоит на месте: нет деления на ноль', () => {
    const enemy = new Enemy(50, 50, ENEMY_TYPES.grunt);
    enemy.update(1, { x: 50, y: 50 });
    assert.equal(enemy.x, 50);
    assert.equal(enemy.y, 50);
    assert.ok(Number.isFinite(enemy.angle));
  });

  test('вспышка гаснет со временем', () => {
    noCrits();
    const enemy = new Enemy(0, 0, ENEMY_TYPES.grunt);
    enemy.takeHit(1, 1, 0);
    enemy.update(1, { x: 500, y: 0 });
    assert.equal(enemy.flashFor, 0);
  });

  test('клип зависит от состояния: ходьба, вспышка, прицел', () => {
    noCrits();
    const shooter = new Enemy(0, 0, ENEMY_TYPES.shooter);
    assert.equal(shooter.clipName, 'shooter.walk');
    shooter.aimLeft = 0.3;
    assert.equal(shooter.clipName, 'shooter.aim');
    shooter.takeHit(1, 1, 0);
    assert.equal(shooter.clipName, 'shooter.hit', 'вспышка важнее прицела');
  });

  describe('стрелок', () => {
    const shooter = () => {
      const enemy = new Enemy(0, 0, ENEMY_TYPES.shooter);
      enemy.shotCooldown = 0;
      return enemy;
    };
    const { keepDistance, windup } = ENEMY_TYPES.shooter.ranged;

    test('далеко от игрока подходит', () => {
      const enemy = shooter();
      enemy.update(0.1, { x: keepDistance * 3, y: 0 });
      assert.ok(enemy.x > 0);
    });

    test('слишком близко — пятится', () => {
      const enemy = shooter();
      enemy.update(0.1, { x: keepDistance * 0.3, y: 0 });
      assert.ok(enemy.x < 0);
    });

    test('на своей дистанции стоит и целится, потом стреляет в сторону игрока', () => {
      const enemy = shooter();
      const shots = [];
      const target = { x: keepDistance, y: 0 };

      enemy.update(0.01, target, shots);
      assert.equal(enemy.aiming, true, 'начал целиться');
      assert.equal(shots.length, 0);

      enemy.update(windup + 0.05, target, shots);
      assert.equal(shots.length, 1);
      assert.equal(enemy.aiming, false);
      assert.ok(shots[0].vx > 0, 'снаряд летит к игроку');
      assert.ok(Math.abs(shots[0].vy) < 1e-6);
    });

    test('издалека не целится: снаряд всё равно истёк бы', () => {
      const enemy = shooter();
      enemy.update(0.01, { x: keepDistance * 3, y: 0 }, []);
      assert.equal(enemy.aiming, false);
    });

    test('после выстрела перезаряжается', () => {
      const enemy = shooter();
      const shots = [];
      const target = { x: keepDistance, y: 0 };
      enemy.update(0.01, target, shots);
      enemy.update(windup + 0.05, target, shots);
      enemy.update(0.01, target, shots);
      assert.equal(enemy.aiming, false);
      assert.ok(enemy.shotCooldown > 0);
    });
  });
});
