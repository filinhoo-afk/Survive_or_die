import { drawText, textHeight, wrapText } from '../gfx/font.js';
import { t } from '../i18n/index.js';
import { UI_COLORS as C, pixelPanel } from './panel.js';

/** Сколько секунд висит одна всплывашка. */
export const TOAST_TIME = 3;
export const TOAST_WIDTH = 360;
const TOAST_TOP = 96;

/** Колонка открытого за забег слева от таблицы итогов. */
export const LIST_WIDTH = 174;
const LIST_LIMIT = 5;
/** Ниже HUD, который просвечивает сквозь экран итогов. */
const LIST_TOP = 190;

/** Очередь всплывашек: открытые разом достижения показываются по одному. */
export function createToasts(duration = TOAST_TIME) {
  const queue = [];
  let time = 0;

  return {
    /** Достижение, которое сейчас на экране, или null. */
    get current() {
      return queue[0] ?? null;
    },
    push(achievements) {
      queue.push(...achievements);
    },
    /** Идёт только вместе с миром: на паузе и выборе улучшения время стоит. */
    update(dt) {
      if (queue.length === 0) return;
      time += dt;
      if (time < duration) return;
      queue.shift();
      time = 0;
    },
    clear() {
      queue.length = 0;
      time = 0;
    },
  };
}

/** Всплывашка под таймером забега. */
export function drawToast(ctx, canvas, achievement) {
  const x = (canvas.width - TOAST_WIDTH) / 2;
  const cx = canvas.width / 2;
  pixelPanel(ctx, x, TOAST_TOP, TOAST_WIDTH, 52, C.panel, C.record);
  drawText(ctx, t('achievements.toast'), cx, TOAST_TOP + 10, { scale: 2, align: 'center', color: C.dim });
  drawText(ctx, achievement.title, cx, TOAST_TOP + 29, { scale: 2, align: 'center', color: C.record });
}

/** Открытое за забег — на экране итогов, в свободном поле слева. Лишнее сворачивается в «+N». */
export function drawUnlockedList(ctx, achievements) {
  if (achievements.length === 0) return;
  const x = 8;
  const cx = x + LIST_WIDTH / 2;
  const line = textHeight(2) + 4;
  let y = LIST_TOP;
  drawText(ctx, t('achievements.new'), cx, y, { scale: 2, align: 'center', color: C.dim });
  y += line + 4;

  for (const achievement of achievements.slice(0, LIST_LIMIT)) {
    const lines = wrapText(achievement.title, LIST_WIDTH - 16, 2);
    const height = lines.length * line + 14;
    pixelPanel(ctx, x, y, LIST_WIDTH, height, C.panel, C.record);
    lines.forEach((text, i) => {
      drawText(ctx, text, cx, y + 9 + i * line, { scale: 2, align: 'center', color: C.record });
    });
    y += height + 6;
  }

  const rest = achievements.length - LIST_LIMIT;
  if (rest > 0) drawText(ctx, `+${rest}`, cx, y + 2, { scale: 2, align: 'center', color: C.record });
}
