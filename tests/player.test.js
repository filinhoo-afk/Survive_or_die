import './helpers/dom.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Player, xpForLevel } from '../src/entities/player.js';
import { CONFIG } from '../src/config.js';
import { near } from './helpers/storage.js';

const WORLD = { width: 1000, height: 800 };
const input = (x = 0, y = 0) => ({ getAxis: () => ({ x, y }) });

describe('опыт и уровни', () => {
  test('каждый следующий уровень дороже на step', () => {
    assert.equal(xpForLevel(1), CONFIG.xp.base);
    assert.equal(xpForLevel(2), CONFIG.xp.base + CONFIG.xp.step);
    assert.equal(xpForLevel(10), CONFIG.xp.base + 9 * CONFIG.xp.step);
  });

  test('опыта не хватает — уровень тот же', () => {
    const player = new Player(0, 0);
    assert.equal(player.gainXp(player.xpToNext - 1), 0);
    assert.equal(player.level, 1);
    assert.equal(player.xp, player.xpToNext - 1);
  });

  test('хватает ровно — уровень, и полоса пуста', () => {
    const player = new Player(0, 0);
    const need = player.xpToNext;
    assert.equal(player.gainXp(need), 1);
    assert.equal(player.level, 2);
    assert.equal(player.xp, 0);
    assert.equal(player.xpToNext, xpForLevel(2));
  });

  test('остаток переходит на следующий уровень', () => {
    const player = new Player(0, 0);
    player.gainXp(player.xpToNext + 2);
    assert.equal(player.xp, 2);
  });

  test('крупная порция даёт несколько уровней разом', () => {
    const player = new Player(0, 0);
    const total = xpForLevel(1) + xpForLevel(2) + xpForLevel(3);
    assert.equal(player.gainXp(total), 3);
    assert.equal(player.level, 4);
    assert.equal(player.xp, 0);
  });

  test('xpRatio — доля полосы', () => {
    const player = new Player(0, 0);
    player.gainXp(2);
    assert.ok(near(player.xpRatio, 2 / xpForLevel(1)));
  });
});

describe('урон игроку', () => {
  test('отнимает здоровье и включает неуязвимость', () => {
    const player = new Player(0, 0);
    assert.equal(player.takeDamage(12), true);
    assert.equal(player.hp, CONFIG.player.maxHp - 12);
    assert.equal(player.invulnerableFor, CONFIG.player.invulnerability);
    assert.ok(player.hurtFor > 0);
  });

  test('во время неуязвимости удар не проходит', () => {
    const player = new Player(0, 0);
    player.takeDamage(10);
    assert.equal(player.takeDamage(10), false);
    assert.equal(player.hp, CONFIG.player.maxHp - 10);
  });

  test('неуязвимость проходит со временем', () => {
    const player = new Player(500, 400);
    player.takeDamage(10);
    player.update(CONFIG.player.invulnerability + 0.01, input(), WORLD);
    assert.equal(player.invulnerableFor, 0);
    assert.equal(player.takeDamage(10), true);
  });

  test('броня смягчает удар, но не обнуляет его: минимум 1', () => {
    const player = new Player(0, 0);
    player.armor = 4;
    player.takeDamage(10);
    assert.equal(player.hp, CONFIG.player.maxHp - 6);

    const heavy = new Player(0, 0);
    heavy.armor = 50;
    heavy.takeDamage(5);
    assert.equal(heavy.hp, CONFIG.player.maxHp - 1);
  });

  test('здоровье не уходит ниже нуля, игрок гибнет', () => {
    const player = new Player(0, 0);
    player.takeDamage(1000);
    assert.equal(player.hp, 0);
    assert.equal(player.alive, false);
  });

  test('мёртвого не бьют', () => {
    const player = new Player(0, 0);
    player.takeDamage(1000);
    player.invulnerableFor = 0;
    assert.equal(player.takeDamage(10), false);
  });

  test('hpRatio — доля здоровья', () => {
    const player = new Player(0, 0);
    player.takeDamage(25);
    assert.ok(near(player.hpRatio, 0.75));
  });

  test('мигание: пока неуязвим, кадры чередуются, потом игрок виден всегда', () => {
    const player = new Player(500, 400);
    assert.equal(player.visible, true);
    player.takeDamage(1);
    assert.equal(player.visible, true, 'первый период — виден');
    player.update(CONFIG.player.blinkPeriod * 1.01, input(), WORLD);
    assert.equal(player.visible, false, 'второй период — скрыт');
    player.update(CONFIG.player.invulnerability, input(), WORLD);
    assert.equal(player.visible, true);
  });
});

describe('движение', () => {
  test('идёт со скоростью игрока в сторону оси', () => {
    const player = new Player(500, 400);
    player.update(0.5, input(1, 0), WORLD);
    assert.ok(near(player.x, 500 + player.speed * 0.5));
    assert.equal(player.y, 400);
    assert.equal(player.moving, true);
    assert.deepEqual(player.facing, { x: 1, y: 0 });
  });

  test('стоя на месте, помнит, куда смотрел', () => {
    const player = new Player(500, 400);
    player.update(0.1, input(-1, 0), WORLD);
    player.update(0.1, input(0, 0), WORLD);
    assert.equal(player.moving, false);
    assert.deepEqual(player.facing, { x: -1, y: 0 });
  });

  test('не выходит за границы мира', () => {
    const player = new Player(10, 10);
    player.update(5, input(-1, -1), WORLD);
    assert.equal(player.x, player.radius);
    assert.equal(player.y, player.radius);

    player.update(100, input(1, 1), WORLD);
    assert.equal(player.x, WORLD.width - player.radius);
    assert.equal(player.y, WORLD.height - player.radius);
  });

  test('на льду скорость нарастает и спадает не сразу', () => {
    const player = new Player(500, 400);
    player.update(0.1, input(1, 0), WORLD, 3);
    assert.ok(player.vx > 0 && player.vx < player.speed, `vx = ${player.vx}`);

    for (let i = 0; i < 100; i += 1) player.update(0.1, input(1, 0), WORLD, 3);
    assert.ok(near(player.vx, player.speed, 1), 'в конце разгоняется до полной');

    const speed = player.vx;
    player.update(0.1, input(0, 0), WORLD, 3);
    assert.ok(player.vx > 0 && player.vx < speed, 'скользит по инерции');
  });

  test('без льда скорость мгновенная', () => {
    const player = new Player(500, 400);
    player.update(0.016, input(1, 0), WORLD);
    assert.equal(player.vx, player.speed);
    player.update(0.016, input(0, 0), WORLD);
    assert.equal(player.vx, 0);
  });

  test('регенерация лечит, но не выше максимума', () => {
    const player = new Player(500, 400);
    player.regen = 2;
    player.hp = 50;
    player.update(1, input(), WORLD);
    assert.ok(near(player.hp, 52));
    player.update(100, input(), WORLD);
    assert.equal(player.hp, player.maxHp);
  });

  test('мёртвый не лечится', () => {
    const player = new Player(500, 400);
    player.regen = 5;
    player.takeDamage(1000);
    player.update(10, input(), WORLD);
    assert.equal(player.hp, 0);
  });
});
