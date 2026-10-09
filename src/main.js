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
import { Gem } from './entities/gem.js';
import { updateGems } from './systems/pickups.js';
import { UpgradeState } from './systems/upgrades.js';
import { cardAt, drawUpgradeScreen } from './ui/upgradeScreen.js';
import { pruneProjectiles } from './systems/weapons.js';
import { Arsenal } from './systems/arsenal.js';
import * as audio from './engine/audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.width;
canvas.height = CONFIG.height;

const world = CONFIG.world;
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

/** Режим игры: меню, забег или пауза (поражение — это !player.alive). */
let mode = 'menu';

/** Собирает мир с нуля — и для первого запуска, и для рестарта. */
function newRun() {
  player = new Player(world.width / 2, world.height / 2);
  camera = new Camera(canvas.width, canvas.height, world, CONFIG.camera.smoothing);
  enemies = [];
  projectiles = [];
  enemyShots = [];
  gems = [];
  spawner = new Spawner(world);
  arsenal = new Arsenal();
  arsenal.add('cannon');
  effects = new Effects();
  setHitListener((enemy, amount, crit) => {
    effects.damageNumber(enemy.x, enemy.y - enemy.radius, amount, crit);
    if (crit) camera.addShake(CONFIG.shake.crit);
  });
  upgrades = new UpgradeState(arsenal, player);
  pendingLevels = 0;
  offers = null;
  hoveredCard = -1;
  elapsed = 0;
  kills = 0;

  // Первая волна сразу, чтобы игра не начиналась с пустого ожидания.
  spawner.spawnWave(enemies, camera);
  camera.snapTo(player);
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

function startRun() {
  newRun();
  mode = 'playing';
  audio.play('start');
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

  if (mode === 'menu') {
    if (event.code === 'Enter' || event.code === 'Space') startRun();
    return;
  }

  if (!player.alive) {
    if (event.code === 'KeyR' || event.code === 'Enter') startRun();
    else if (event.code === 'Escape') setMode('menu');
    return;
  }

  if (offers) {
    if (event.code in CHOICE_KEYS) pickCard(CHOICE_KEYS[event.code]);
    return;
  }

  if (event.code === 'Escape' || event.code === 'KeyP') {
    setMode(mode === 'paused' ? 'playing' : 'paused');
  } else if (mode === 'paused' && event.code === 'KeyR') {
    startRun();
  } else if (mode === 'paused' && event.code === 'KeyM') {
    setMode('menu');
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
  if (mode === 'menu') {
    startRun();
    return;
  }
  if (mode === 'paused') {
    setMode('playing');
    return;
  }
  if (!player.alive) {
    startRun();
    return;
  }
  if (!offers) return;
  const { x, y } = canvasPoint(event);
  pickCard(cardAt(x, y, offers.length, canvas));
  canvas.style.cursor = 'default';
});

let elapsed = 0;
let kills = 0;

/** Секунды в «м:сс» — для таймера забега. */
function formatTime(seconds) {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// Мир нужен уже в меню — он рисуется на фоне.
newRun();

function update(dt) {
  // Тряска доигрывает и после смерти игрока, но замирает вместе с миром на паузе.
  if (mode === 'playing' && !offers) camera.updateShake(dt, CONFIG.shake);

  // В меню, на паузе, после смерти и на экране выбора мир замирает целиком.
  if (mode !== 'playing' || !player.alive || offers) return;

  elapsed += dt;
  player.update(dt, input, world);

  spawner.update(dt, enemies, camera);

  for (const enemy of enemies) enemy.update(dt, player, enemyShots);
  separate(enemies);
  const hpBefore = player.hp;
  applyContactDamage(player, enemies);

  for (const shot of enemyShots) shot.update(dt);
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
  killed.push(...resolveProjectileHits(projectiles, enemies));

  kills += killed.length;
  if (killed.length > 0) {
    audio.play('kill');
    camera.addShake(CONFIG.shake.enemyDeath * Math.min(killed.length, 4));
  }
  for (const enemy of killed) {
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
}

/** Музыка тише, когда мир стоит: меню, пауза, выбор апгрейда, смерть. */
function syncMusic() {
  const active = mode === 'playing' && player.alive && !offers;
  audio.setMusicLevel(active ? 1 : 0.35);
}

function render() {
  syncMusic();
  // Фон за пределами мира — чтобы край был виден, а не обрывался в пустоту.
  ctx.fillStyle = CONFIG.colors.outside;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  camera.apply(ctx);

  drawWorld();
  for (const gem of gems) gem.draw(ctx);
  const scene = { player, enemies };
  arsenal.draw(ctx, scene, 'under');
  for (const enemy of enemies) enemy.draw(ctx);
  effects.draw(ctx);
  for (const shot of projectiles) shot.draw(ctx);
  for (const shot of enemyShots) shot.draw(ctx);
  player.draw(ctx);
  arsenal.draw(ctx, scene, 'over');

  ctx.restore();

  if (mode === 'menu') drawMenu();
  else {
    drawHud();
    if (mode === 'paused') drawPause();
  }
}

function drawWorld() {
  ctx.fillStyle = CONFIG.colors.background;
  ctx.fillRect(0, 0, world.width, world.height);

  drawGrid();

  ctx.strokeStyle = CONFIG.colors.border;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, world.width - 3, world.height - 3);
}

/** Рисует только те линии сетки, которые попадают в кадр. */
function drawGrid() {
  const { size, majorEvery } = CONFIG.grid;
  const view = camera.viewport;

  const firstCol = Math.max(0, Math.floor(view.left / size));
  const lastCol = Math.min(Math.ceil(world.width / size), Math.ceil(view.right / size));
  const firstRow = Math.max(0, Math.floor(view.top / size));
  const lastRow = Math.min(Math.ceil(world.height / size), Math.ceil(view.bottom / size));

  ctx.lineWidth = 1;

  for (const major of [false, true]) {
    ctx.strokeStyle = major ? CONFIG.colors.gridMajor : CONFIG.colors.grid;
    ctx.beginPath();

    for (let col = firstCol; col <= lastCol; col += 1) {
      if ((col % majorEvery === 0) !== major) continue;
      const x = col * size + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, world.height);
    }

    for (let row = firstRow; row <= lastRow; row += 1) {
      if ((row % majorEvery === 0) !== major) continue;
      const y = row * size + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(world.width, y);
    }

    ctx.stroke();
  }
}

function drawHud() {
  ctx.save();

  drawHealthBar();

  drawXpBar();

  ctx.fillStyle = CONFIG.colors.hud;
  ctx.font = '14px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(
    `Уровень ${player.level} · опыт ${player.xp} / ${player.xpToNext}`,
    16,
    60,
  );
  ctx.fillText(`Время: ${formatTime(elapsed)} · убийств: ${kills}`, 16, 80);
  ctx.fillText(`Врагов: ${enemies.length} · кристаллов: ${gems.length}`, 16, 100);
  ctx.fillText(
    `Волна ${spawner.wave} · следующая через ${spawner.timeToNextWave.toFixed(1)} с`,
    16,
    120,
  );

  const taken = upgrades.summary();
  if (taken) {
    ctx.fillStyle = CONFIG.colors.hud;
    ctx.fillText(taken, 16, 140);
  }

  drawMinimap();
  if (!player.alive) drawDefeat();
  if (offers) {
    drawUpgradeScreen(ctx, canvas, {
      offers,
      hovered: hoveredCard,
      level: player.level - pendingLevels + 1,
    });
  }

  ctx.restore();
}

/** Полоса опыта во всю ширину по верхнему краю экрана. */
function drawXpBar() {
  const height = 6;
  ctx.fillStyle = CONFIG.colors.hpBarBack;
  ctx.fillRect(0, 0, canvas.width, height);
  ctx.fillStyle = CONFIG.colors.xpBar;
  ctx.fillRect(0, 0, canvas.width * player.xpRatio, height);
}

function drawHealthBar() {
  const x = 16;
  const y = 16;
  const width = 220;
  const height = 16;
  const ratio = player.hpRatio;

  ctx.fillStyle = CONFIG.colors.hpBarBack;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle =
    ratio > 0.5
      ? CONFIG.colors.hpBar
      : ratio > 0.25
        ? CONFIG.colors.hpBarLow
        : CONFIG.colors.hpBarCritical;
  ctx.fillRect(x, y, width * ratio, height);

  ctx.strokeStyle = CONFIG.colors.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

  ctx.fillStyle = CONFIG.colors.hud;
  ctx.font = '14px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, x + width + 12, y + 13);
}

function drawDefeat() {
  ctx.fillStyle = 'rgba(8, 10, 16, 0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';

  ctx.fillStyle = CONFIG.colors.enemy;
  ctx.font = 'bold 36px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Вы погибли', canvas.width / 2, canvas.height / 2);

  ctx.fillStyle = CONFIG.colors.hud;
  ctx.font = '15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(
    `Продержались ${formatTime(elapsed)} · убийств ${kills} · уровень ${player.level}`,
    canvas.width / 2,
    canvas.height / 2 + 32,
  );
  ctx.fillText(
    'R / Enter / клик — заново · Esc — в меню',
    canvas.width / 2,
    canvas.height / 2 + 60,
  );

  ctx.textAlign = 'left';
}

/** Затемняет экран и рисует крупный заголовок с подсказками под ним. */
function drawOverlay(title, lines) {
  ctx.fillStyle = 'rgba(8, 10, 16, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = CONFIG.colors.hud;
  ctx.font = 'bold 40px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);

  ctx.font = '16px "Segoe UI", system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, canvas.height / 2 + 20 + i * 26);
  });
  ctx.textAlign = 'left';
}

function drawMenu() {
  drawOverlay('Survive or Die', [
    'Enter / Пробел / клик — начать',
    'WASD / стрелки — движение, оружие стреляет само',
  ]);
}

function drawPause() {
  drawOverlay('Пауза', ['Esc / P / клик — продолжить', 'R — заново · M — в меню']);
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
  ctx.strokeStyle = CONFIG.colors.border;
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
