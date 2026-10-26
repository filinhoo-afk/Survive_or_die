import { CONFIG } from './config.js';
import { createLoop } from './engine/loop.js';
import { createInput } from './engine/input.js';
import { Camera } from './engine/camera.js';
import { Player } from './entities/player.js';
import { separate, setHitListener } from './entities/enemy.js';
import { Spawner } from './systems/spawner.js';
import {
  applyContactDamage,
  removeDead,
  resolveEnemyShotHits,
  resolveProjectileHits,
} from './systems/damage.js';
import { Effects } from './systems/effects.js';
import { Boss } from './entities/boss.js';
import { ENEMY_TYPES } from './enemies/types.js';
import { Gem } from './entities/gem.js';
import { updateGems } from './systems/pickups.js';
import { UpgradeState } from './systems/upgrades.js';
import { cardAt, drawUpgradeScreen } from './ui/upgradeScreen.js';
import { pruneProjectiles } from './systems/weapons.js';
import { Arsenal } from './systems/arsenal.js';
import * as audio from './engine/audio.js';
import { loadRecord, submitRun } from './systems/records.js';
import { drawSummaryScreen } from './ui/summaryScreen.js';
import { formatTime } from './ui/format.js';
import { drawMenuScreen, drawPauseScreen } from './ui/menuScreens.js';
import { createTransition } from './ui/transition.js';
import { atlas } from './art/index.js';
import { Animator } from './gfx/animator.js';
import { DEFAULT_LOCATION, LOCATION_LIST } from './locations/index.js';
import { bakeGround } from './gfx/ground.js';
import { createLighting } from './gfx/lighting.js';
import { drawShadow, sortByDepth } from './gfx/shadows.js';
import { blockShots, buildObstacles, collideBodies, collideBody } from './systems/obstacles.js';
import { drawText, textHeight, wrapText } from './gfx/font.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.width;
canvas.height = CONFIG.height;

/** Текущая локация: мир, земля и враги берутся из её данных. */
let location;
let world;
let groundImage;
let obstacles;

/** Переключает локацию: перепекает землю и расставляет препятствия заново. */
function setLocation(next) {
  location = next;
  world = location.world;
  groundImage = bakeGround(atlas, location, CONFIG.ground.pixelScale);
  obstacles = buildObstacles(location);
}

setLocation(DEFAULT_LOCATION);
const lighting = createLighting(canvas.width, canvas.height, CONFIG.lighting);
const input = createInput();

let player;
let camera;
let enemies;
let projectiles;
let enemyShots;
let gems;
let spawner;
let arsenal;
let effects;
let upgrades;
/** Босс текущего забега: null, пока не вышел. */
let boss;

/** Режим игры: меню, забег или пауза (поражение — это !player.alive). */
let mode = 'menu';

/** Собирает мир с нуля — и для первого запуска, и для рестарта. */
function newRun() {
  player = new Player(world.width / 2, world.height / 2);
  camera = new Camera(canvas.width, canvas.height, world, CONFIG.camera.smoothing);
  enemies = [];
  boss = null;
  projectiles = [];
  enemyShots = [];
  gems = [];
  spawner = new Spawner(world, location.enemies);
  arsenal = new Arsenal();
  arsenal.add('cannon');
  effects = new Effects();
  setHitListener((enemy, amount, crit) => {
    // В итоги идёт урон, который враг реально потерял, без перебора на добивании.
    damageDealt += Math.min(amount, enemy.hp);
    if (crit) crits += 1;
    effects.damageNumber(enemy.x, enemy.y - enemy.radius, amount, crit);
    if (crit) camera.addShake(CONFIG.shake.crit);
  });
  upgrades = new UpgradeState(arsenal, player);
  pendingLevels = 0;
  offers = null;
  hoveredCard = -1;
  elapsed = 0;
  kills = 0;
  killsByType = {};
  damageDealt = 0;
  crits = 0;
  summary = null;

  // Первая волна сразу, чтобы игра не начиналась с пустого ожидания.
  spawner.spawnWave(enemies, camera);
  camera.snapTo(player);
}

/** Босс выходит из-за края кадра, как и обычные враги. */
function spawnBoss() {
  const point = spawner.pickSpawnPoint(camera);
  boss = new Boss(point.x, point.y, ENEMY_TYPES[location.boss]);
  enemies.push(boss);
  audio.play('levelUp');
  camera.addShake(CONFIG.shake.playerHit);
}

/** Сколько повышений ещё не разыграно — за раз их может прийти несколько. */
let pendingLevels = 0;
/** Карточки на экране выбора; пока не null, мир стоит на паузе. */
let offers = null;
let hoveredCard = -1;

function openChoice() {
  offers = upgrades.roll(3);
  hoveredCard = -1;
  // Всё прокачано до упора — выбирать не из чего, играем дальше.
  if (offers.length === 0) {
    offers = null;
    pendingLevels = 0;
  }
}

function pickCard(index) {
  if (!offers || index < 0 || index >= offers.length) return;
  offers[index].apply();
  audio.play('pick');
  pendingLevels -= 1;
  offers = null;
  if (pendingLevels > 0) openChoice();
}

const CHOICE_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 };

const transition = createTransition();

const MENU_SHIFT = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };

/** Выбор локации в меню: листаем список по кругу и пересобираем мир на фоне. */
function shiftLocation(step) {
  const index = LOCATION_LIST.indexOf(location);
  setLocation(LOCATION_LIST[(index + step + LOCATION_LIST.length) % LOCATION_LIST.length]);
  newRun();
  audio.play('pick');
}

function startRun() {
  newRun();
  mode = 'playing';
  audio.play('start');
}

/** Старт забега и выход в меню идут через затемнение. */
function startRunFaded() {
  transition.go(startRun);
}

function menuFaded() {
  transition.go(() => setMode('menu'));
}

function setMode(next) {
  if (mode === next) return;
  if (next === 'paused') audio.play('pause');
  mode = next;
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;

  // Браузер включает звук только после жеста игрока — первое нажатие и есть он.
  audio.unlock();
  audio.startMusic();
  if (event.code === 'KeyN') {
    audio.toggleMute();
    return;
  }

  if (transition.busy) return;

  if (mode === 'menu') {
    if (event.code === 'Enter' || event.code === 'Space') startRunFaded();
    else if (event.code in MENU_SHIFT) shiftLocation(MENU_SHIFT[event.code]);
    return;
  }

  if (!player.alive) {
    if (event.code === 'KeyR' || event.code === 'Enter') startRunFaded();
    else if (event.code === 'Escape') menuFaded();
    return;
  }

  if (offers) {
    if (event.code in CHOICE_KEYS) pickCard(CHOICE_KEYS[event.code]);
    return;
  }

  if (event.code === 'Escape' || event.code === 'KeyP') {
    setMode(mode === 'paused' ? 'playing' : 'paused');
  } else if (mode === 'paused' && event.code === 'KeyR') {
    startRunFaded();
  } else if (mode === 'paused' && event.code === 'KeyM') {
    menuFaded();
  }
});

// Пауза сама включается, когда вкладка теряет фокус.
window.addEventListener('blur', () => {
  if (mode === 'playing' && player.alive && !offers) setMode('paused');
});

/** Канвас растягивается стилями, поэтому переводим координаты мыши в его пиксели. */
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * canvas.width) / rect.width,
    y: ((event.clientY - rect.top) * canvas.height) / rect.height,
  };
}

canvas.addEventListener('mousemove', (event) => {
  if (!offers) return;
  const { x, y } = canvasPoint(event);
  hoveredCard = cardAt(x, y, offers.length, canvas);
  canvas.style.cursor = hoveredCard >= 0 ? 'pointer' : 'default';
});

canvas.addEventListener('click', (event) => {
  audio.unlock();
  audio.startMusic();
  if (transition.busy) return;
  if (mode === 'menu') {
    startRunFaded();
    return;
  }
  if (mode === 'paused') {
    setMode('playing');
    return;
  }
  if (!player.alive) {
    startRunFaded();
    return;
  }
  if (!offers) return;
  const { x, y } = canvasPoint(event);
  pickCard(cardAt(x, y, offers.length, canvas));
  canvas.style.cursor = 'default';
});

let elapsed = 0;
let kills = 0;
let killsByType = {};
let damageDealt = 0;
let crits = 0;
/** Итоги забега: собираются один раз в момент смерти, до этого null. */
let summary = null;
/** Лучшие показатели — для главного меню. */
let record = loadRecord();

/** Фиксирует итоги забега и обновляет рекорд. */
function finishRun() {
  const stats = {
    time: elapsed,
    kills,
    level: player.level,
    damage: damageDealt,
    wave: spawner.wave,
    crits,
    killsByType,
    build: upgrades.summary(),
  };
  const result = submitRun(stats);
  record = result.record;
  summary = { stats, result };
  if (result.beaten.size > 0) audio.play('record');
}

// Мир нужен уже в меню — он рисуется на фоне.
newRun();

/** В меню герой стоит и идёт — показываем оба клипа рядом. */
const menuHeroes = [new Animator(atlas, 'hero.idle.down'), new Animator(atlas, 'hero.walk.down')];

function update(dt) {
  transition.update(dt);
  if (mode === 'menu') for (const hero of menuHeroes) hero.update(dt);

  // Тряска доигрывает и после смерти игрока, но замирает вместе с миром на паузе.
  if (mode === 'playing' && !offers) camera.updateShake(dt, CONFIG.shake);

  // В меню, на паузе, после смерти и на экране выбора мир замирает целиком.
  if (mode !== 'playing' || !player.alive || offers) return;

  elapsed += dt;
  player.update(dt, input, world);
  collideBody(player, obstacles);

  // Когда время локации вышло, выходит босс, а обычные волны прекращаются.
  if (location.boss && !boss && elapsed >= location.duration) spawnBoss();
  if (!boss) spawner.update(dt, enemies, camera);

  for (const enemy of enemies) enemy.update(dt, player, enemyShots);
  separate(enemies);
  collideBodies(enemies, obstacles);
  const hpBefore = player.hp;
  applyContactDamage(player, enemies);

  for (const shot of enemyShots) shot.update(dt);
  blockShots(enemyShots, obstacles);
  resolveEnemyShotHits(enemyShots, player);
  if (player.hp < hpBefore) {
    audio.play(player.alive ? 'hit' : 'death');
    camera.addShake(player.alive ? CONFIG.shake.playerHit : CONFIG.shake.playerDeath);
  }

  // Щит и аура убивают без снарядов — кладут жертв в тот же список.
  const killed = [];
  const shotsBefore = projectiles.length;
  arsenal.update(dt, { player, enemies, projectiles, killed });
  if (projectiles.length > shotsBefore) audio.play('shot');
  for (const shot of projectiles) shot.update(dt);
  blockShots(projectiles, obstacles);
  killed.push(...resolveProjectileHits(projectiles, enemies));

  kills += killed.length;
  for (const enemy of killed) killsByType[enemy.type.id] = (killsByType[enemy.type.id] ?? 0) + 1;
  if (killed.length > 0) {
    audio.play('kill');
    camera.addShake(CONFIG.shake.enemyDeath * Math.min(killed.length, 4));
  }
  for (const enemy of killed) {
    effects.corpse(enemy);
    effects.deathBurst(enemy.x, enemy.y, enemy.color, enemy.radius / 13);
    gems.push(new Gem(enemy.x, enemy.y, enemy.xp));
  }

  const xpGained = updateGems(gems, player, dt);
  if (xpGained > 0) audio.play('gem');
  const levelsGained = player.gainXp(xpGained);
  if (levelsGained > 0) audio.play('levelUp');
  for (let i = 0; i < levelsGained; i += 1) {
    effects.levelUp(player.x, player.y, player.level - levelsGained + i + 1);
  }
  pendingLevels += levelsGained;
  if (pendingLevels > 0 && player.alive) openChoice();

  removeDead(enemies);
  pruneProjectiles(projectiles, world);
  pruneProjectiles(enemyShots, world);
  effects.update(dt);

  camera.follow(player, dt);

  if (!player.alive && !summary) finishRun();
}

/** Музыка тише, когда мир стоит: меню, пауза, выбор апгрейда, смерть. */
function syncMusic() {
  const active = mode === 'playing' && player.alive && !offers;
  audio.setMusicLevel(active ? 1 : 0.35);
}

function render() {
  syncMusic();
  // Фон за пределами мира — чтобы край был виден, а не обрывался в пустоту.
  ctx.fillStyle = location.colors.outside;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  camera.apply(ctx);

  drawWorld();
  drawShadows();
  for (const gem of gems) gem.draw(ctx);
  const scene = { player, enemies };
  arsenal.draw(ctx, scene, 'under');
  effects.draw(ctx);
  // Враги и игрок — в одном списке: кто ниже на экране, тот рисуется поверх.
  for (const body of sortByDepth([player, ...enemies, ...obstacles])) body.draw(ctx);
  for (const shot of projectiles) shot.draw(ctx);
  for (const shot of enemyShots) shot.draw(ctx);
  arsenal.draw(ctx, scene, 'over');

  ctx.restore();

  drawLighting();

  if (mode === 'menu') drawMenu();
  else {
    drawHud();
    if (mode === 'paused') drawPauseScreen(ctx, canvas);
  }
  transition.draw(ctx, canvas);
}

/** Собирает источники света сцены и накладывает тьму поверх мира. */
function drawLighting() {
  const cfg = CONFIG.lighting;
  const lights = [{ x: player.x, y: player.y, ...cfg.player }];
  for (const shot of projectiles) lights.push({ x: shot.x, y: shot.y, ...cfg.projectile });
  for (const shot of enemyShots) lights.push({ x: shot.x, y: shot.y, ...cfg.enemyShot });
  for (const gem of gems) lights.push({ x: gem.x, y: gem.y, ...cfg.gem });
  lighting.draw(
    ctx,
    lights,
    Math.round(camera.x + camera.shakeX),
    Math.round(camera.y + camera.shakeY),
  );
}

/** Тени всех, кто стоит на земле, — одним слоем под спрайтами. */
function drawShadows() {
  const cfg = CONFIG.shadows;
  for (const gem of gems) drawShadow(ctx, gem.x, gem.y + 8, cfg.gemRadius, cfg);
  for (const o of obstacles) drawShadow(ctx, o.x, o.footY, o.radius * 1.2, cfg);
  for (const enemy of enemies) drawShadow(ctx, enemy.x, enemy.footY, enemy.radius, cfg);
  if (player.visible) drawShadow(ctx, player.x, player.footY, player.radius, cfg);
}

function drawWorld() {
  const view = camera.viewport;
  const left = Math.max(0, Math.floor(view.left));
  const top = Math.max(0, Math.floor(view.top));
  const width = Math.min(world.width, Math.ceil(view.right)) - left;
  const height = Math.min(world.height, Math.ceil(view.bottom)) - top;
  ctx.drawImage(groundImage, left, top, width, height, left, top, width, height);

  ctx.strokeStyle = location.colors.border;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, world.width - 3, world.height - 3);
}

function drawHud() {
  ctx.save();

  drawXpBar();
  drawHealthBar();
  drawStats();

  // Таймер забега по центру под полосой опыта.
  const colors = CONFIG.colors;
  drawText(ctx, formatTime(elapsed), canvas.width / 2, 16, {
    scale: 4,
    align: 'center',
    color: colors.hudText,
    shadow: colors.hudShadow,
  });

  // До босса остаётся обратный отсчёт; без босса таймер просто идёт вверх.
  if (boss?.alive) {
    drawBossBar();
  } else if (boss) {
    drawText(ctx, `${boss.type.title.toUpperCase()} ПОВЕРЖЕН`, canvas.width / 2, 52, {
      scale: 2,
      align: 'center',
      color: colors.hudText,
      shadow: colors.hudShadow,
    });
  } else if (location.duration !== null) {
    const left = Math.max(0, location.duration - elapsed);
    drawText(ctx, `БОСС ЧЕРЕЗ ${formatTime(left)}`, canvas.width / 2, 52, {
      scale: 2,
      align: 'center',
      color: colors.hudDim,
      shadow: colors.hudShadow,
    });
  }

  drawMinimap();
  if (summary) drawSummaryScreen(ctx, canvas, summary);
  if (offers) {
    drawUpgradeScreen(ctx, canvas, {
      offers,
      hovered: hoveredCard,
      level: player.level - pendingLevels + 1,
    });
  }

  ctx.restore();
}

/** Рамка полосы: тёмная подложка, цветная заливка и светлая окантовка в пиксель. */
function drawBar(x, y, width, height, ratio, fill) {
  const colors = CONFIG.colors;
  ctx.fillStyle = colors.playerOutline;
  ctx.fillRect(x - 2, y - 2, width + 4, height + 4);
  ctx.fillStyle = colors.hpBarBack;
  ctx.fillRect(x, y, width, height);

  const filled = Math.round(width * Math.max(0, Math.min(1, ratio)));
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, filled, height);
  // Блик сверху придаёт полосе объём.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fillRect(x, y, filled, 2);

  ctx.strokeStyle = colors.hudBevel;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 1.5, y - 1.5, width + 3, height + 3);
}

/** Здоровье босса: широкая полоса снизу, на второй фазе краснеет. */
function drawBossBar() {
  const width = 520;
  const height = 18;
  const x = (canvas.width - width) / 2;
  const y = canvas.height - 48;
  drawBar(x, y, width, height, boss.hp / boss.maxHp, boss.phaseNumber === 1 ? '#5fbf6a' : '#e0452f');
  drawText(ctx, boss.type.title.toUpperCase(), canvas.width / 2, y - 22, {
    scale: 2,
    align: 'center',
    color: CONFIG.colors.hudText,
    shadow: CONFIG.colors.hudShadow,
  });
}

/** Полоса опыта во всю ширину по верхнему краю экрана. */
function drawXpBar() {
  const height = 6;
  ctx.fillStyle = CONFIG.colors.hpBarBack;
  ctx.fillRect(0, 0, canvas.width, height);
  const filled = Math.round(canvas.width * player.xpRatio);
  ctx.fillStyle = CONFIG.colors.xpBar;
  ctx.fillRect(0, 0, filled, height);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(0, 0, filled, 2);
  ctx.fillStyle = CONFIG.colors.playerOutline;
  ctx.fillRect(0, height, canvas.width, 2);
}

function drawHealthBar() {
  const colors = CONFIG.colors;
  const x = 18;
  const y = 22;
  const width = 220;
  const height = 20;
  const ratio = player.hpRatio;
  const fill =
    ratio > 0.5 ? colors.hpBar : ratio > 0.25 ? colors.hpBarLow : colors.hpBarCritical;

  drawBar(x, y, width, height, ratio, fill);
  drawText(ctx, `${Math.ceil(player.hp)}/${player.maxHp}`, x + width / 2, y + 3, {
    scale: 2,
    align: 'center',
    color: colors.hudText,
    shadow: colors.hudShadow,
  });
}

/** Столбец текста под здоровьем: уровень, убийства, волна и собранный билд. */
function drawStats() {
  const colors = CONFIG.colors;
  const scale = 2;
  const lineHeight = textHeight(scale) + 6;
  const x = 18;
  let y = 56;

  const rows = [
    [`УР ${player.level}`, `ОПЫТ ${player.xp}/${player.xpToNext}`],
    [`УБИЙСТВ ${kills}`, `ВРАГОВ ${enemies.length}`],
    [`ВОЛНА ${spawner.wave}`, `ЧЕРЕЗ ${spawner.timeToNextWave.toFixed(1)} С`],
  ];
  for (const [main, extra] of rows) {
    drawText(ctx, main, x, y, { scale, color: colors.hudText, shadow: colors.hudShadow });
    drawText(ctx, extra, x + 130, y, { scale, color: colors.hudDim, shadow: colors.hudShadow });
    y += lineHeight;
  }

  const taken = upgrades.summary();
  if (taken) {
    y += 4;
    for (const line of wrapText(taken, 300, 2)) {
      drawText(ctx, line, x, y, { scale: 2, color: colors.hudDim, shadow: colors.hudShadow });
      y += textHeight(2) + 4;
    }
  }
}

function drawMenu() {
  drawMenuScreen(ctx, canvas, record, location, LOCATION_LIST.length > 1);
  menuHeroes.forEach((hero, i) => {
    hero.draw(ctx, canvas.width / 2 + (i === 0 ? -40 : 40), 150, { scale: 4 });
  });
}

/** Миникарта в углу: где игрок и куда смотрит камера. */
function drawMinimap() {
  const width = 120;
  const height = width * (world.height / world.width);
  const x = canvas.width - width - 16;
  const y = 16;
  const scale = width / world.width;

  ctx.fillStyle = 'rgba(8, 10, 16, 0.75)';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = location.colors.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

  const view = camera.viewport;
  ctx.strokeStyle = CONFIG.colors.hud;
  ctx.strokeRect(
    x + view.left * scale,
    y + view.top * scale,
    canvas.width * scale,
    canvas.height * scale,
  );

  ctx.fillStyle = '#4a5368';
  for (const o of obstacles) ctx.fillRect(x + o.x * scale - 1, y + o.y * scale - 1, 2, 2);

  for (const enemy of enemies) {
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(x + enemy.x * scale, y + enemy.y * scale, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = CONFIG.colors.player;
  ctx.beginPath();
  ctx.arc(x + player.x * scale, y + player.y * scale, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

createLoop(update, render).start();
