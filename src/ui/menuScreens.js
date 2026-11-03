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

/** Карта кампании: цепочка узлов-локаций, выбранная подсвечена, закрытые под замком. */
function drawCampaignMap(ctx, canvas, y, campaign) {
  const { list, selected, cleared } = campaign;
  const size = 40;
  const gap = 56;
  const total = list.length * size + (list.length - 1) * gap;
  const left = (canvas.width - total) / 2;

  list.forEach((loc, i) => {
    const x = left + i * (size + gap);
    if (i > 0) {
      ctx.fillStyle = cleared.has(list[i - 1].id) ? C.accent : C.border;
      ctx.fillRect(x - gap + 4, y + size / 2 - 2, gap - 8, 4);
    }
    const open = i === 0 || cleared.has(list[i - 1].id);
    const done = cleared.has(loc.id);
    const border = i === selected ? C.title : done ? C.record : open ? C.accent : C.border;
    pixelPanel(ctx, x, y, size, size, open ? C.panelHover : C.well, border);
    drawText(ctx, open ? String(i + 1) : '?', x + size / 2, y + 13, {
      scale: 2,
      align: 'center',
      color: done ? C.record : open ? C.text : C.dim,
    });
    if (i === selected) {
      ctx.fillStyle = C.title;
      ctx.fillRect(x + size / 2 - 4, y + size + 6, 8, 4);
    }
  });
}

/** Главное меню. Герои рисуются в main.js поверх — для них оставлено место над заголовком. */
export function drawMenuScreen(ctx, canvas, record, campaign) {
  veil(ctx, canvas, 0.7);
  const cx = canvas.width / 2;
  const { list, selected, cleared } = campaign;
  const location = list[selected];
  const open = selected === 0 || cleared.has(list[selected - 1].id);

  drawText(ctx, 'SURVIVE', cx, 170, { scale: 8, align: 'center', color: C.title });
  drawText(ctx, 'OR DIE', cx, 170 + textHeight(8) + 8, { scale: 8, align: 'center', color: C.danger });

  const mapTop = 170 + (textHeight(8) + 8) * 2 + 14;
  drawCampaignMap(ctx, canvas, mapTop, campaign);

  const status = open
    ? cleared.has(location.id) ? ' · пройдена' : ''
    : ` · сначала пройдите: ${list[selected - 1].title}`;
  const lines = [
    { text: `${selected + 1}. ${location.title}${status}`, color: open ? C.accent : C.danger },
    { text: 'A / D — выбор локации · WASD — движение', color: C.dim },
  ];
  if (record.runs > 0) {
    lines.push({
      text: `Рекорд: ${formatTime(record.time)} · убийств ${record.kills} · ур ${record.level}`,
      color: C.record,
    });
  }
  drawHints(ctx, canvas, mapTop + 40 + 22, lines);

  if (blink()) {
    drawText(ctx, open ? 'Enter / Пробел / клик — начать' : 'Локация закрыта', cx, canvas.height - 40, {
      scale: 2,
      align: 'center',
      color: open ? C.accent : C.danger,
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
