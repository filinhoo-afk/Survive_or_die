import { drawText } from '../gfx/font.js';
import { LANGUAGES, getLanguage, t } from '../i18n/index.js';
import {
  BINDING_ACTIONS,
  VOLUME_CHANNELS,
  VOLUME_STEPS,
  keyLabel,
} from '../systems/settings.js';
import { UI_COLORS as C, pixelPanel } from './panel.js';

const ROW_HEIGHT = 34;
const ROW_WIDTH = 640;
const ROW_GAP = 6;
const TOP = 84;
const BAR_OFFSET = 250;
const SEGMENT = 24;
const SEGMENT_GAP = 4;

/** Строки: громкости, клавиши, язык и сброс. Названия берутся из словаря по `titleKey`. */
export const SETTINGS_ROWS = [
  ...VOLUME_CHANNELS.map((c) => ({ kind: 'volume', id: c.id, titleKey: `settings.volume.${c.id}` })),
  ...BINDING_ACTIONS.map((a) => ({ kind: 'key', id: a.id, titleKey: `settings.key.${a.id}` })),
  { kind: 'language', id: 'language', titleKey: 'settings.language' },
  { kind: 'reset', id: 'reset', titleKey: 'settings.reset' },
];

const rowTop = (index) => TOP + index * (ROW_HEIGHT + ROW_GAP);
const rowLeft = (canvas) => (canvas.width - ROW_WIDTH) / 2;
const barLeft = (canvas) => rowLeft(canvas) + BAR_OFFSET;
const barWidth = VOLUME_STEPS * (SEGMENT + SEGMENT_GAP) - SEGMENT_GAP;

/** Номер строки под точкой (x, y) или -1. */
export function settingsRowAt(x, y, canvas) {
  const left = rowLeft(canvas);
  for (let i = 0; i < SETTINGS_ROWS.length; i += 1) {
    const top = rowTop(i);
    if (x >= left && x <= left + ROW_WIDTH && y >= top && y <= top + ROW_HEIGHT) return i;
  }
  return -1;
}

/** Громкость (шаги 0..1), на которую указывает x над полосой, или null, если мимо полосы. */
export function settingsBarValue(x, canvas) {
  const start = barLeft(canvas) - 6;
  const end = barLeft(canvas) + barWidth + 6;
  if (x < start || x > end) return null;
  const step = Math.round(((x - barLeft(canvas)) / barWidth) * VOLUME_STEPS);
  return Math.min(VOLUME_STEPS, Math.max(0, step)) / VOLUME_STEPS;
}

/** Экран настроек. `rebinding` — id действия, которому сейчас ждём клавишу, или null. */
export function drawSettingsScreen(ctx, canvas, settings, selected, rebinding, notice = '') {
  ctx.fillStyle = 'rgba(8, 10, 16, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const left = rowLeft(canvas);
  const blinkOn = Math.floor(performance.now() / 400) % 2 === 0;

  drawText(ctx, t('settings.title'), cx, 30, { scale: 5, align: 'center', color: C.title });

  SETTINGS_ROWS.forEach((row, i) => {
    const top = rowTop(i);
    const isSelected = i === selected;
    const waiting = row.kind === 'key' && rebinding === row.id;
    const border = waiting ? C.record : isSelected ? C.title : C.border;
    pixelPanel(ctx, left, top, ROW_WIDTH, ROW_HEIGHT, isSelected ? C.panelHover : C.panel, border);

    const textY = top + Math.round((ROW_HEIGHT - 14) / 2);
    drawText(ctx, t(row.titleKey), left + 20, textY, {
      scale: 2,
      color: row.kind === 'reset' ? C.danger : C.text,
    });

    if (row.kind === 'volume') {
      const value = settings[row.id];
      const filled = Math.round(value * VOLUME_STEPS);
      for (let s = 0; s < VOLUME_STEPS; s += 1) {
        ctx.fillStyle = s < filled ? C.accent : C.well;
        ctx.fillRect(barLeft(canvas) + s * (SEGMENT + SEGMENT_GAP), top + 9, SEGMENT, ROW_HEIGHT - 18);
      }
      drawText(ctx, `${Math.round(value * 100)}%`, left + ROW_WIDTH - 20, textY, {
        scale: 2,
        align: 'right',
        color: C.record,
      });
    } else if (row.kind === 'key') {
      const [primary, secondary] = settings.bindings[row.id];
      const text = waiting
        ? blinkOn ? t('settings.waiting') : ''
        : `${keyLabel(primary)}  ·  ${keyLabel(secondary)}`;
      drawText(ctx, text, left + ROW_WIDTH - 20, textY, {
        scale: 2,
        align: 'right',
        color: waiting ? C.record : C.accent,
      });
    } else if (row.kind === 'language') {
      const language = LANGUAGES.find((l) => l.id === getLanguage());
      drawText(ctx, `←  ${language.name}  →`, left + ROW_WIDTH - 20, textY, {
        scale: 2,
        align: 'right',
        color: C.accent,
      });
    }
  });

  if (notice) {
    drawText(ctx, notice, cx, rowTop(SETTINGS_ROWS.length) + 4, { scale: 2, align: 'center', color: C.danger });
  }

  const hint = rebinding
    ? t('settings.hint.rebind')
    : t('settings.hint');
  drawText(ctx, hint, cx, canvas.height - 40, { scale: 2, align: 'center', color: C.dim });
  if (!rebinding) {
    drawText(ctx, t('settings.pad'), cx, canvas.height - 22, {
      scale: 2,
      align: 'center',
      color: C.dim,
    });
  }
}
