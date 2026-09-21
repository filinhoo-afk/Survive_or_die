import { CONFIG } from './config.js';
import { createLoop } from './engine/loop.js';
import { createInput } from './engine/input.js';
import { Player } from './entities/player.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.width;
canvas.height = CONFIG.height;

const input = createInput();
const player = new Player(CONFIG.width / 2, CONFIG.height / 2);

let elapsed = 0;

function update(dt) {
  elapsed += dt;
  player.update(dt, input, { width: canvas.width, height: canvas.height });
}

function render() {
  ctx.fillStyle = CONFIG.colors.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid(64);
  player.draw(ctx);
  drawHud();
}

function drawGrid(size) {
  ctx.save();
  ctx.strokeStyle = CONFIG.colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= canvas.width; x += size) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
  }
  for (let y = 0; y <= canvas.height; y += size) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function drawHud() {
  ctx.save();
  ctx.fillStyle = CONFIG.colors.hud;
  ctx.font = '14px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`Время: ${elapsed.toFixed(1)} с`, 16, 26);
  ctx.restore();
}

createLoop(update, render).start();
