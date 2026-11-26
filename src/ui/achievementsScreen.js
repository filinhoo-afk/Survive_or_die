import { drawText } from '../gfx/font.js';
import { t } from '../i18n/index.js';
import { ACHIEVEMENTS, progressOf } from '../systems/achievements.js';
import { formatNumber } from './format.js';
import { UI_COLORS as C, pixelPanel } from './panel.js';

export const CARD_WIDTH = 450;
const CARD_HEIGHT = 52;
const COLUMN_GAP = 12;
const ROW_GAP = 6;
const TOP = 96;
/** Отступ текста от левого края карточки: слева стоит медаль. */
export const TEXT_LEFT = 54;

/** Прямоугольник карточки по номеру: две колонки, заполняются по строкам. */
export function cardRect(index, canvas) {
  const left = (canvas.width - CARD_WIDTH * 2 - COLUMN_GAP) / 2;
  return {
    x: left + (index % 2) * (CARD_WIDTH + COLUMN_GAP),
    y: TOP + Math.floor(index / 2) * (CARD_HEIGHT + ROW_GAP),
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  };
}

/** Медаль: открытая — золотая, закрытая — тёмное гнездо со знаком вопроса. */
function drawMedal(ctx, x, y, open) {
  pixelPanel(ctx, x, y, 28, 28, open ? C.record : C.well, open ? '#fff1b0' : C.border);
  if (open) {
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(x + 10, y + 10, 8, 8);
  } else {
    drawText(ctx, '?', x + 14, y + 7, { scale: 2, align: 'center', color: C.dim });
  }
}

/** Экран достижений: все карточки сразу, у накопительных виден ход. */
export function drawAchievementsScreen(ctx, canvas, state) {
  // Фон плотнее, чем у магазина: подсказка внизу иначе читается поверх меню.
  ctx.fillStyle = 'rgba(8, 10, 16, 0.97)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;

  drawText(ctx, t('achievements.title'), cx, 24, { scale: 5, align: 'center', color: C.title });
  drawText(ctx, t('achievements.count', { count: state.unlocked.size, total: ACHIEVEMENTS.length }), cx, 70, {
    scale: 2,
    align: 'center',
    color: C.record,
  });

  ACHIEVEMENTS.forEach((achievement, i) => {
    const { x, y, width, height } = cardRect(i, canvas);
    const open = state.unlocked.has(achievement.id);
    pixelPanel(ctx, x, y, width, height, open ? C.panelHover : C.panel, open ? C.record : C.border);
    drawMedal(ctx, x + 14, y + 12, open);
    drawText(ctx, achievement.title, x + TEXT_LEFT, y + 10, { scale: 2, color: open ? C.record : C.text });
    drawText(ctx, achievement.desc, x + TEXT_LEFT, y + 30, { scale: 2, color: C.dim });

    const progress = progressOf(state, achievement);
    if (progress) {
      drawText(ctx, `${formatNumber(progress.value)}/${formatNumber(progress.goal)}`, x + width - 14, y + 10, {
        scale: 2,
        align: 'right',
        color: open ? C.record : C.accent,
      });
    }
  });

  drawText(ctx, t('achievements.hint'), cx, canvas.height - 28, { scale: 2, align: 'center', color: C.dim });
}
