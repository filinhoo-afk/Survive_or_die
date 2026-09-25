import { CONFIG } from './config.js';
import { createLoop } from './engine/loop.js';
import { createInput } from './engine/input.js';
import { Camera } from './engine/camera.js';
import { Player } from './entities/player.js';
import { separate } from './entities/enemy.js';
import { Spawner } from './systems/spawner.js';
import { applyContactDamage } from './systems/damage.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.width;
canvas.height = CONFIG.height;

const world = CONFIG.world;
const input = createInput();
const player = new Player(world.width / 2, world.height / 2);
const camera = new Camera(canvas.width, canvas.height, world, CONFIG.camera.smoothing);

const enemies = [];
const spawner = new Spawner(world);

// Первая волна сразу, чтобы игра не начиналась с пустого ожидания.
spawner.spawnWave(enemies, camera);

camera.snapTo(player);

let elapsed = 0;

function update(dt) {
  // После смерти мир замирает: таймер, волны и враги останавливаются.
  if (!player.alive) return;

  elapsed += dt;
  player.update(dt, input, world);

  spawner.update(dt, enemies, camera);

  for (const enemy of enemies) enemy.update(dt, player);
  separate(enemies);
  applyContactDamage(player, enemies);

  camera.follow(player, dt);
}

function render() {
  // Фон за пределами мира — чтобы край был виден, а не обрывался в пустоту.
  ctx.fillStyle = CONFIG.colors.outside;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  camera.apply(ctx);

  drawWorld();
  for (const enemy of enemies) enemy.draw(ctx);
  player.draw(ctx);

  ctx.restore();

  drawHud();
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

  ctx.fillStyle = CONFIG.colors.hud;
  ctx.font = '14px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`Время: ${elapsed.toFixed(1)} с`, 16, 60);
  ctx.fillText(`X: ${Math.round(player.x)}  Y: ${Math.round(player.y)}`, 16, 80);
  ctx.fillText(`Врагов: ${enemies.length}`, 16, 100);
  ctx.fillText(
    `Волна ${spawner.wave} · следующая через ${spawner.timeToNextWave.toFixed(1)} с`,
    16,
    120,
  );

  drawMinimap();
  if (!player.alive) drawDefeat();

  ctx.restore();
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
    `Продержались ${elapsed.toFixed(1)} с · обновите страницу, чтобы начать заново`,
    canvas.width / 2,
    canvas.height / 2 + 32,
  );

  ctx.textAlign = 'left';
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

  ctx.fillStyle = CONFIG.colors.enemy;
  for (const enemy of enemies) {
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
