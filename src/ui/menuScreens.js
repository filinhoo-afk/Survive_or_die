import { drawText, textHeight } from '../gfx/font.js';
import { formatTime } from './format.js';
import { UI_COLORS as C, pixelPanel } from './panel.js';

function veil(ctx, canvas, alpha) {
  ctx.fillStyle = `rgba(8, 10, 16, ${alpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/** Мигающая подсказка: показывается и гаснет раз в полсекунды. */
function blink(now = performance.now()) {
  return Math.floor(now / 520) % 2 === 0;
}

/** Строки подсказок в рамке по центру; возвращает нижнюю границу рамки. */
function drawHints(ctx, canvas, top, lines) {
  const scale = 2;
  const lineHeight = textHeight(scale) + 8;
  const height = lines.length * lineHeight + 24;
  const width = 520;
  const x = (canvas.width - width) / 2;
  pixelPanel(ctx, x, top, width, height, C.panel, C.border);
  lines.forEach((line, i) => {
    drawText(ctx, line.text, canvas.width / 2, top + 16 + i * lineHeight, {
      scale,
      align: 'center',
      color: line.color ?? C.text,
    });
  });
  return top + height;
}

/** Главное меню. Герои рисуются в main.js поверх — для них оставлено место над заголовком. */
export function drawMenuScreen(ctx, canvas, record, location, canSwitch) {
  veil(ctx, canvas, 0.7);
  const cx = canvas.width / 2;

  drawText(ctx, 'SURVIVE', cx, 190, { scale: 8, align: 'center', color: C.title });
  drawText(ctx, 'OR DIE', cx, 190 + textHeight(8) + 8, { scale: 8, align: 'center', color: C.danger });

  const top = 190 + (textHeight(8) + 8) * 2 + 18;
  const lines = [
    {
      text: canSwitch ? `Локация: ${location.title} · A / D — сменить` : location.title,
      color: C.accent,
    },
    { text: 'WASD / стрелки — движение', color: C.dim },
    { text: 'Оружие стреляет само', color: C.dim },
  ];
  if (record.runs > 0) {
    lines.push({
      text: `Рекорд: ${formatTime(record.time)} · убийств ${record.kills} · ур ${record.level}`,
      color: C.record,
    });
  }
  drawHints(ctx, canvas, top, lines);

  if (blink()) {
    drawText(ctx, 'Enter / Пробел / клик — начать', cx, canvas.height - 44, {
      scale: 2,
      align: 'center',
      color: C.accent,
    });
  }
}

/** Экран паузы. */
export function drawPauseScreen(ctx, canvas) {
  veil(ctx, canvas, 0.7);
  const cx = canvas.width / 2;

  drawText(ctx, 'ПАУЗА', cx, 170, { scale: 8, align: 'center', color: C.title });
  drawHints(ctx, canvas, 170 + textHeight(8) + 28, [
    { text: 'Esc / P / клик — продолжить', color: C.accent },
    { text: 'R — заново' },
    { text: 'M — в меню' },
  ]);
}
