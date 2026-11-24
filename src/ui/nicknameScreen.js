import { drawText, measureText } from '../gfx/font.js';
import { t } from '../i18n/index.js';
import { NICK_MAX } from '../systems/nickname.js';
import { UI_COLORS as C, pixelPanel } from './panel.js';

const PANEL_WIDTH = 520;
const PANEL_HEIGHT = 190;

/**
 * Экран ввода никнейма поверх меню.
 * @param {string} text то, что набрано сейчас
 * @param {string} notice подсказка или причина, почему ник не принят
 */
export function drawNicknameScreen(ctx, canvas, text, notice = '') {
  ctx.fillStyle = 'rgba(8, 10, 16, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const left = cx - PANEL_WIDTH / 2;
  const top = (canvas.height - PANEL_HEIGHT) / 2;

  drawText(ctx, t('nick.title'), cx, top - 56, { scale: 5, align: 'center', color: C.title });
  pixelPanel(ctx, left, top, PANEL_WIDTH, PANEL_HEIGHT, C.panel, C.border);

  // Поле ввода: набранный текст и мигающий курсор.
  const fieldTop = top + 28;
  pixelPanel(ctx, left + 24, fieldTop, PANEL_WIDTH - 48, 52, C.well, C.accent);
  const scale = 3;
  const textX = cx - measureText(text, scale) / 2;
  drawText(ctx, text, textX, fieldTop + 16, { scale, color: C.text });
  if (Math.floor(performance.now() / 520) % 2 === 0 && text.length < NICK_MAX) {
    ctx.fillStyle = C.accent;
    ctx.fillRect(textX + measureText(text, scale) + 3, fieldTop + 14, 3 * 2, 3 * 7);
  }
  drawText(ctx, `${text.length}/${NICK_MAX}`, left + PANEL_WIDTH - 36, fieldTop + 62, {
    scale: 2,
    align: 'right',
    color: C.dim,
  });

  drawText(ctx, notice || t('nick.rules'), left + 24, fieldTop + 62, {
    scale: 2,
    color: notice ? C.danger : C.dim,
  });
  drawText(ctx, t('nick.empty'), cx, fieldTop + 96, { scale: 2, align: 'center', color: C.dim });

  drawText(ctx, t('nick.hint'), cx, canvas.height - 28, {
    scale: 2,
    align: 'center',
    color: C.dim,
  });
}
