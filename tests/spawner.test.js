import './helpers/dom.js';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Spawner } from '../src/systems/spawner.js';
import { CONFIG } from '../src/config.js';
import { ELITE } from '../src/enemies/elites.js';
import { seedRun, unseedRun } from '../src/systems/rng.js';
import { near } from './helpers/storage.js';

afterEach(unseedRun);

const WORLD = { width: 2880, height: 1800 };
const VIEW_W = 960;
const VIEW_H = 540;
const camera = (x = 960, y = 630) => ({
  viewport: { left: x, top: y, right: x + VIEW_W, bottom: y + VIEW_H },
});
const spawner = (ids = ['grunt', 'swarm'], world = WORLD) => new Spawner(world, ids);
const insideView = ({ x, y }, view) => x > view.left && x < view.right && y > view.top && y < view.bottom;

describe('кривая сложности', () => {
  const { ramp } = CONFIG.spawner;

  test('в начале забега — стартовые значения из конфига', () => {
    const s = spawner();
    assert.equal(s.interval, CONFIG.spawner.interval);
    assert.equal(s.waveSize, CONFIG.spawner.waveSize);
    assert.equal(s.maxEnemies, CONFIG.spawner.maxEnemies);
    assert.equal(s.hpScale, 1);
  });

  test('со временем всё растёт линейно', () => {
    const s = spawner();
    s.time = 120;
    assert.ok(near(s.interval, CONFIG.spawner.interval - ramp.intervalShrinkPerMinute * 2));
    assert.equal(s.waveSize, CONFIG.spawner.waveSize + Math.floor(120 / ramp.waveSizeEvery));
    assert.equal(s.maxEnemies, CONFIG.spawner.maxEnemies + ramp.maxEnemiesPerMinute * 2);
    assert.ok(near(s.hpScale, 1 + ramp.hpPerMinute * 2));
  });

  test('интервал не короче минимума, сколько бы ни прошло времени', () => {
    const s = spawner();
    s.time = 100000;
    assert.equal(s.interval, ramp.minInterval);
  });

  test('ничего из кривой не убывает во времени', () => {
    const s = spawner();
    let last = { waveSize: 0, maxEnemies: 0, hpScale: 0, interval: Infinity };
    for (let t = 0; t <= 1800; t += 10) {
      s.time = t;
      assert.ok(s.waveSize >= last.waveSize);
      assert.ok(s.maxEnemies >= last.maxEnemies);
      assert.ok(s.hpScale >= last.hpScale);
      assert.ok(s.interval <= last.interval);
      last = { waveSize: s.waveSize, maxEnemies: s.maxEnemies, hpScale: s.hpScale, interval: s.interval };
    }
  });
});

describe('update: когда выходит волна', () => {
  test('до конца интервала ничего не появляется', () => {
    const s = spawner();
    const enemies = [];
    assert.equal(s.update(1, enemies, camera()), 0);
    assert.equal(enemies.length, 0);
    assert.equal(s.wave, 0);
  });

  test('по истечении интервала выходит волна', () => {
    const s = spawner(['grunt']);
    const enemies = [];
    const spawned = s.update(s.interval, enemies, camera());
    assert.equal(spawned, s.waveSize);
    assert.equal(enemies.length, spawned);
    assert.equal(s.wave, 1);
  });

  test('излишек времени не пропадает: таймер вычитается, а не обнуляется', () => {
    const s = spawner(['grunt']);
    const dt = s.interval + 1.5;
    s.update(dt, [], camera());
    // Интервал считается уже на новом времени забега — он чуть короче.
    assert.ok(near(s.timer, dt - s.interval));
    assert.ok(s.timer > 1.4, `таймер ${s.timer}`);
  });

  test('время забега идёт, пока волн нет', () => {
    const s = spawner();
    s.update(0.5, [], camera());
    s.update(0.5, [], camera());
    assert.ok(near(s.time, 1));
    assert.ok(near(s.minutes, 1 / 60));
  });

  test('timeToNextWave — сколько осталось и не ниже нуля', () => {
    const s = spawner();
    s.update(2, [], camera());
    assert.ok(near(s.timeToNextWave, s.interval - 2));
    s.timer = 100;
    assert.equal(s.timeToNextWave, 0);
  });
});

describe('какие враги выходят', () => {
  test('в первые секунды только те, что открыты с нуля', () => {
    const s = spawner(['grunt', 'swarm']); // рой открывается с 20-й секунды
    seedRun(1);
    for (let i = 0; i < 300; i += 1) assert.equal(s.pickType().id, 'grunt');
  });

  test('когда тип открылся, он начинает выпадать, и в пропорции своих весов', () => {
    const s = spawner(['grunt', 'swarm']);
    s.time = 100;
    seedRun(1);
    let swarms = 0;
    const picks = 8000;
    for (let i = 0; i < picks; i += 1) if (s.pickType().id === 'swarm') swarms += 1;
    // Вес рядового 6, роя 2: рой — четверть.
    const share = swarms / picks;
    assert.ok(share > 0.22 && share < 0.28, `доля роя ${share}`);
  });

  test('враги другой локации не появятся: только свой список', () => {
    const s = spawner(['wolf']);
    s.time = 1000;
    seedRun(2);
    for (let i = 0; i < 100; i += 1) assert.equal(s.pickType().id, 'wolf');
  });
});

describe('где выходят', () => {
  test('всегда за краем экрана и внутри мира', () => {
    const s = spawner();
    seedRun(3);
    const inset = CONFIG.enemy.maxRadius;
    for (const cam of [camera(960, 630), camera(0, 0), camera(WORLD.width - VIEW_W, WORLD.height - VIEW_H), camera(0, 900)]) {
      for (let i = 0; i < 200; i += 1) {
        const point = s.pickSpawnPoint(cam);
        assert.ok(!insideView(point, cam.viewport), `точка (${point.x}, ${point.y}) в кадре`);
        assert.ok(point.x >= inset && point.x <= WORLD.width - inset, `x = ${point.x}`);
        assert.ok(point.y >= inset && point.y <= WORLD.height - inset, `y = ${point.y}`);
      }
    }
  });

  test('рядом с кадром, а не на другом конце мира', () => {
    const s = spawner();
    seedRun(4);
    const cam = camera(960, 630);
    for (let i = 0; i < 100; i += 1) {
      const { x, y } = s.pickSpawnPoint(cam);
      assert.ok(x >= cam.viewport.left - CONFIG.spawner.margin - 1 && x <= cam.viewport.right + CONFIG.spawner.margin + 1);
      assert.ok(y >= cam.viewport.top - CONFIG.spawner.margin - 1 && y <= cam.viewport.bottom + CONFIG.spawner.margin + 1);
    }
  });

  test('мир меньше кадра — точку прижимает к границе, а не уводит за мир', () => {
    const tiny = { width: 300, height: 200 };
    const s = spawner(['grunt'], tiny);
    seedRun(5);
    for (let i = 0; i < 50; i += 1) {
      const { x, y } = s.pickSpawnPoint(camera(-330, -170));
      assert.ok(x >= CONFIG.enemy.maxRadius && x <= tiny.width - CONFIG.enemy.maxRadius);
      assert.ok(y >= CONFIG.enemy.maxRadius && y <= tiny.height - CONFIG.enemy.maxRadius);
    }
  });
});

describe('волна', () => {
  test('потолок врагов не превышается', () => {
    const s = spawner(['grunt']);
    seedRun(6);
    const enemies = [];
    for (let i = 0; i < 100; i += 1) s.spawnWave(enemies, camera());
    assert.equal(enemies.length, s.maxEnemies);
  });

  test('когда место есть только на одного — выходит один', () => {
    const s = spawner(['grunt']);
    const enemies = Array.from({ length: s.maxEnemies - 1 }, () => ({}));
    assert.equal(s.spawnWave(enemies, camera()), 1);
    assert.equal(enemies.length, s.maxEnemies);
  });

  test('при полном потолке волна пуста', () => {
    const s = spawner(['grunt']);
    const enemies = Array.from({ length: s.maxEnemies }, () => ({}));
    assert.equal(s.spawnWave(enemies, camera()), 0);
  });

  test('стая роя выходит кучкой: пять разом, рядом друг с другом', () => {
    const s = spawner(['swarm']);
    s.time = 30;
    seedRun(7);
    const enemies = [];
    s.spawnWave(enemies, camera());
    assert.equal(enemies.length, s.waveSize * 5);
    const [first, ...rest] = enemies.slice(0, 5);
    for (const mate of rest) assert.ok(Math.hypot(mate.x - first.x, mate.y - first.y) <= 28 + 1e-9);
  });

  test('здоровье новых врагов растёт вместе с забегом', () => {
    const s = spawner(['grunt']);
    s.time = 600;
    seedRun(8);
    const enemies = [];
    s.spawnWave(enemies, camera());
    for (const enemy of enemies.filter((e) => !e.elite)) assert.equal(enemy.maxHp, Math.round(40 * s.hpScale));
  });

  test('до появления элит все враги обычные', () => {
    const s = spawner(['grunt']);
    s.time = ELITE.from - 1;
    seedRun(9);
    for (let i = 0; i < 50; i += 1) {
      const enemies = [];
      s.spawnWave(enemies, camera());
      assert.ok(enemies.every((e) => !e.elite));
    }
  });

  test('позже элиты встречаются, и доля около шанса', () => {
    const s = spawner(['grunt']);
    s.time = 1200; // шанс упёрся в потолок
    seedRun(10);
    let elites = 0;
    let total = 0;
    for (let i = 0; i < 400; i += 1) {
      const enemies = [];
      s.spawnWave(enemies, camera());
      total += enemies.length;
      elites += enemies.filter((e) => e.elite).length;
    }
    const share = elites / total;
    assert.ok(Math.abs(share - ELITE.maxChance) < 0.04, `доля элит ${share}`);
  });

  test('из стаи роя элит не бывает', () => {
    const s = spawner(['swarm']);
    s.time = 1200;
    seedRun(11);
    for (let i = 0; i < 50; i += 1) {
      const enemies = [];
      s.spawnWave(enemies, camera());
      assert.ok(enemies.every((e) => !e.elite));
    }
  });

  test('враги не оказываются за краем мира', () => {
    const s = spawner(['grunt', 'swarm']);
    s.time = 100;
    seedRun(12);
    for (let i = 0; i < 100; i += 1) {
      const enemies = [];
      s.spawnWave(enemies, camera(0, 0));
      for (const e of enemies) {
        assert.ok(e.x >= 0 && e.x <= WORLD.width && e.y >= 0 && e.y <= WORLD.height);
      }
    }
  });
});

describe('испытание дня: один сид — один и тот же мир', () => {
  function playRun(seed) {
    seedRun(seed);
    const s = spawner(['grunt', 'swarm', 'tank', 'shooter']);
    const out = [];
    // Десять минут забега по секунде; каждая волна пишется целиком — с типом, местом и элитностью.
    for (let step = 0; step < 600; step += 1) {
      const batch = [];
      s.update(1, batch, camera());
      for (const e of batch) out.push([step, e.type.id, Math.round(e.x), Math.round(e.y), e.elite, e.modifier?.id ?? null]);
    }
    return out;
  }

  test('два забега на одном сиде выпускают одних и тех же врагов в одних и тех же местах', () => {
    const first = playRun(2026);
    const second = playRun(2026);
    assert.ok(first.length > 100);
    assert.deepEqual(first, second);
  });

  test('на другом сиде — другие', () => {
    assert.notDeepEqual(playRun(2026), playRun(2027));
  });
});
