import { drawText } from '../gfx/font.js';
import { t } from '../i18n/index.js';
import { keyLabel } from '../systems/settings.js';
import { UI_COLORS as C, pixelPanel } from './panel.js';

export const HINT_WIDTH = 680;
const HEIGHT = 86;
const PADDING = 16;

/** Основные клавиши движения по назначениям игрока: «W A S D». */
export function movementKeys(bindings) {
  return ['up', 'left', 'down', 'right']
    .map((action) => keyLabel(bindings[action][0] ?? bindings[action][1]))
    .join(' ');
}

/** Подсказка обучения внизу экрана: что делать, сколько осталось и как пропустить. */
export function drawTutorialHint(ctx, canvas, tutorial, bindings) {
  const step = tutorial.step;
  if (!step) return;
  const done = tutorial.completed !== null;
  const x = (canvas.width - HINT_WIDTH) / 2;
  const y = canvas.height - HEIGHT - 12;
  const cx = canvas.width / 2;

  pixelPanel(ctx, x, y, HINT_WIDTH, HEIGHT, C.panel, done ? C.accent : C.title);

  drawText(ctx, t('tutorial.title', { step: tutorial.index + 1, total: tutorial.steps.length }), x + PADDING, y + 12, {
    scale: 2,
    color: C.record,
  });
  const status = done ? t('tutorial.done') : tutorial.count === null ? '' : `${tutorial.count}/${step.goal}`;
  drawText(ctx, status, x + HINT_WIDTH - PADDING, y + 12, { scale: 2, align: 'right', color: C.accent });

  drawText(ctx, t(step.textKey, { keys: movementKeys(bindings) }), cx, y + 34, {
    scale: 2,
    align: 'center',
    color: C.title,
  });
  drawText(ctx, t('tutorial.skip'), cx, y + 56, { scale: 2, align: 'center', color: C.dim });

  // Полоска хода шага вдоль нижней кромки.
  const width = HINT_WIDTH - PADDING * 2;
  ctx.fillStyle = C.well;
  ctx.fillRect(x + PADDING, y + HEIGHT - 12, width, 4);
  ctx.fillStyle = C.accent;
  ctx.fillRect(x + PADDING, y + HEIGHT - 12, Math.round(width * tutorial.progress), 4);
}
