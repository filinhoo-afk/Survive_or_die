import { atlas } from '../art/index.js';
import { drawFrame } from '../gfx/atlas.js';
import { drawText, measureText, textHeight, wrapText } from '../gfx/font.js';

const CARD_WIDTH = 240;
const CARD_HEIGHT = 250;
const CARD_GAP = 28;
const CARD_TOP = 165;
const ICON_SCALE = 4;
const PIXEL = 4;

const COLORS = {
  veil: 'rgba(8, 10, 16, 0.74)',
  panel: '#161c2b',
  panelHover: '#1d2537',
  border: '#31405e',
  well: '#0b0e14',
  text: '#c9d1d9',
  dim: '#8b98ab',
  title: '#f5f7fb',
  accent: '#7ee787',
};

/** Прямоугольники карточек — общие для отрисовки и для попадания мышью. */
export function cardRects(count, canvas) {
  const total = count * CARD_WIDTH + (count - 1) * CARD_GAP;
  const left = (canvas.width - total) / 2;

  return Array.from({ length: count }, (_, i) => ({
    x: left + i * (CARD_WIDTH + CARD_GAP),
    y: CARD_TOP,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  }));
}

/** Номер карточки под точкой или -1. */
export function cardAt(x, y, count, canvas) {
  return cardRects(count, canvas).findIndex(
    (r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height,
  );
}

export function drawUpgradeScreen(ctx, canvas, { offers, hovered, level }) {
  ctx.save();

  ctx.fillStyle = COLORS.veil;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawText(ctx, `Уровень ${level}`, canvas.width / 2, 78, {
    scale: 4,
    align: 'center',
    color: COLORS.accent,
  });
  drawText(ctx, 'Выбери улучшение: клавиши 1, 2, 3 или клик', canvas.width / 2, 124, {
    scale: 2,
    align: 'center',
    color: COLORS.dim,
  });

  cardRects(offers.length, canvas).forEach((rect, i) => {
    drawCard(ctx, rect, offers[i], i, i === hovered);
  });

  ctx.restore();
}

/** Прямоугольник со «срезанными» углами — так рамки выглядят пиксельными. */
function pixelPanel(ctx, x, y, width, height, fill, border, step = PIXEL) {
  ctx.fillStyle = border;
  ctx.fillRect(x + step, y, width - step * 2, height);
  ctx.fillRect(x, y + step, width, height - step * 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x + step, y + step, width - step * 2, height - step * 2);
}

function drawCard(ctx, rect, card, index, hovered) {
  // Карточка под курсором приподнимается — сразу видно, что выберется.
  const y = rect.y - (hovered ? PIXEL : 0);
  const cx = rect.x + rect.width / 2;
  const border = hovered ? card.color : COLORS.border;

  pixelPanel(ctx, rect.x, y, rect.width, rect.height, hovered ? COLORS.panelHover : COLORS.panel, border);
  if (hovered) {
    ctx.fillStyle = border;
    ctx.fillRect(rect.x + PIXEL, y + PIXEL, rect.width - PIXEL * 2, 2);
  }

  // Номер клавиши в тёмном квадрате.
  ctx.fillStyle = COLORS.well;
  ctx.fillRect(rect.x + 12, y + 12, 26, 26);
  drawText(ctx, String(index + 1), rect.x + 25, y + 18, { scale: 2, align: 'center', color: COLORS.text, shadow: null });

  // Иконка в рамке цвета карточки.
  const well = 72;
  const wellX = Math.round(cx - well / 2);
  const wellY = y + 18;
  pixelPanel(ctx, wellX, wellY, well, well, COLORS.well, card.color, 4);
  const clip = atlas.clips[`icon.${card.icon}`];
  if (clip) {
    drawFrame(ctx, atlas, clip.rects[0], clip.anchor, cx, wellY + well / 2, { scale: ICON_SCALE });
  }

  drawLines(ctx, card.title, cx, y + 104, rect.width - 28, { scale: 2, color: COLORS.title });

  // Новое — цветом карточки, прокачка уже взятого — приглушённо.
  drawText(ctx, card.badge, cx, y + 126, {
    scale: 2,
    align: 'center',
    color: card.badge.startsWith('новое') ? card.color : COLORS.dim,
  });

  const lines = wrapText(card.text, rect.width - 32, 2).slice(0, 4);
  lines.forEach((line, i) => {
    drawText(ctx, line, cx, y + 150 + i * (textHeight(2) + 3), {
      scale: 2,
      align: 'center',
      color: COLORS.text,
    });
  });

  if (!card.preview) return;

  const [before, after] = card.preview;
  const scale = 3;
  const arrow = ' → ';
  const full = before + arrow + after;
  const baseY = y + rect.height - 14 - textHeight(scale);
  let cursor = cx - measureText(full, scale) / 2;
  drawText(ctx, before + arrow, cursor, baseY, { scale, color: COLORS.dim });
  cursor += measureText(before + arrow, scale) + scale;
  drawText(ctx, after, cursor, baseY, { scale, color: card.color });
}

/** Текст по центру, с переносом по словам — для заголовков из двух строк. */
function drawLines(ctx, text, cx, y, maxWidth, options) {
  wrapText(text, maxWidth, options.scale).forEach((line, i) => {
    drawText(ctx, line, cx, y + i * (textHeight(options.scale) + 3), { ...options, align: 'center' });
  });
}
