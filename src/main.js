import { CONFIG } from './config.js';
import { createLoop } from './engine/loop.js';
import { createInput } from './engine/input.js';
import { Camera } from './engine/camera.js';
import { Player } from './entities/player.js';
import { Enemy, separate } from './entities/enemy.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.width;
canvas.height = CONFIG.height;

const world = CONFIG.world;
const input = createInput();
const player = new Player(world.width / 2, world.height / 2);
const camera = new Camera(canvas.width, canvas.height, world, CONFIG.camera.smoothing);

// Пока враги расставлены руками, кольцом вокруг точки старта.
// Спавнер по краям экрана появится на следующем шаге.
const enemies = [200, 340, 90].map((degrees) => {
  const angle = (degrees * Math.PI) / 180;
  const distance = 420;
  return new Enemy(
    player.x + Math.cos(angle) * distance,
    player.y + Math.sin(angle) * distance,
  );
});

camera.snapTo(player);

let elapsed = 0;

function update(dt) {
  elapsed += dt;
  player.update(dt, input, world);

  for (const enemy of enemies) enemy.update(dt, player);
  separate(enemies);

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
  ctx.fillStyle = CONFIG.colors.hud;
  ctx.font = '14px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`Время: ${elapsed.toFixed(1)} с`, 16, 26);
  ctx.fillText(`X: ${Math.round(player.x)}  Y: ${Math.round(player.y)}`, 16, 46);
  ctx.fillText(`Врагов: ${enemies.length}`, 16, 66);

  drawMinimap();
  ctx.restore();
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
