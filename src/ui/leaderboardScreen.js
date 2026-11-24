import { drawText } from '../gfx/font.js';
import { t } from '../i18n/index.js';
import { formatNumber, formatTime } from './format.js';
import { UI_COLORS as C, pixelPanel } from './panel.js';

const ROW_HEIGHT = 30;
const ROW_WIDTH = 720;
const ROW_GAP = 4;
const TOP = 130;
const MEDALS = ['#ffd34e', '#c9d1d9', '#d08a4e'];

/** Колонки: ключ заголовка в словаре, отступ слева от рамки, выравнивание. */
const COLUMNS = [
  { title: null, x: 16, align: 'left' },
  { title: 'board.col.player', x: 50, align: 'left' },
  { title: 'board.col.hero', x: 218, align: 'left' },
  { title: 'board.col.kills', x: 412, align: 'right' },
  { title: 'board.col.time', x: 494, align: 'right' },
  { title: 'board.col.level', x: 546, align: 'right' },
  { title: 'board.col.damage', x: 690, align: 'right' },
];

/**
 * Экран таблицы рекордов: одной локации или испытания дня.
 * @param {{ title: string, subtitle: string, daily?: boolean }} heading заголовок и подзаголовок
 * @param {{ status: 'loading' | 'ok' | 'error', rows?: object[] } | undefined} entry загруженное состояние
 * @param {Map<string, string>} heroTitles название героя по id
 */
export function drawLeaderboardScreen(ctx, canvas, heading, entry, heroTitles, online) {
  ctx.fillStyle = 'rgba(8, 10, 16, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const left = (canvas.width - ROW_WIDTH) / 2;

  drawText(ctx, heading.title, cx, 24, { scale: 5, align: 'center', color: C.title });
  drawText(ctx, heading.subtitle, cx, 76, {
    scale: 3,
    align: 'center',
    color: C.accent,
  });

  const header = TOP - 20;
  for (const col of COLUMNS) {
    if (col.title) drawText(ctx, t(col.title), left + col.x, header, { scale: 2, align: col.align, color: C.dim });
  }

  const rows = entry?.status === 'ok' ? entry.rows : [];
  for (let i = 0; i < 10; i += 1) {
    const top = TOP + i * (ROW_HEIGHT + ROW_GAP);
    const row = rows[i];
    pixelPanel(ctx, left, top, ROW_WIDTH, ROW_HEIGHT, i % 2 === 0 ? C.panel : C.panelHover, C.border);
    const textY = top + 8;
    const rank = MEDALS[i] ?? C.text;
    drawText(ctx, String(i + 1), left + COLUMNS[0].x, textY, { scale: 2, color: rank });
    if (!row) continue;
    // Победа над боссом — золотом; безымянные результаты подписаны «—».
    const color = row.victory ? C.record : C.text;
    drawText(ctx, row.nick || '—', left + COLUMNS[1].x, textY, { scale: 2, color: row.nick ? color : C.dim });
    drawText(ctx, heroTitles.get(row.hero) ?? row.hero, left + COLUMNS[2].x, textY, { scale: 2, color: C.dim });
    drawText(ctx, formatNumber(row.kills), left + COLUMNS[3].x, textY, { scale: 2, align: 'right', color: C.accent });
    drawText(ctx, formatTime(row.time), left + COLUMNS[4].x, textY, { scale: 2, align: 'right' });
    drawText(ctx, String(row.level), left + COLUMNS[5].x, textY, { scale: 2, align: 'right' });
    drawText(ctx, formatNumber(row.damage), left + COLUMNS[6].x, textY, { scale: 2, align: 'right', color: C.dim });
  }

  // Сообщение поверх пустой таблицы: загрузка, ошибка или «пока никого».
  let message = '';
  let color = C.dim;
  if (online === 'off') message = t('board.offline');
  else if (!entry || entry.status === 'loading') message = t('board.loading');
  else if (entry.status === 'error') {
    message = t('board.error');
    color = C.danger;
  } else if (entry.rows.length === 0) message = t(heading.daily ? 'board.emptyDaily' : 'board.empty');
  if (message) {
    const y = TOP + 4 * (ROW_HEIGHT + ROW_GAP);
    pixelPanel(ctx, cx - 240, y, 480, 44, C.well, C.border);
    drawText(ctx, message, cx, y + 15, { scale: 2, align: 'center', color });
  }

  const hint = t(heading.daily ? 'board.hint.daily' : 'board.hint');
  drawText(ctx, hint, cx, canvas.height - 28, {
    scale: 2,
    align: 'center',
    color: C.dim,
  });
}
