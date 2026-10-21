import { ENEMY_TYPE_LIST } from '../enemies/types.js';
import { drawText, measureText, textHeight, wrapText } from '../gfx/font.js';
import { formatNumber, formatTime } from './format.js';
import { UI_COLORS as C, pixelPanel } from './panel.js';

const PANEL_WIDTH = 580;
const ROW_HEIGHT = 30;
const SCALE = 2;

/** Строки таблицы: показатели с рекордом и справочные без него. */
const ROWS = [
  { field: 'time', label: 'Продержались', format: formatTime },
  { field: 'kills', label: 'Убийств', format: formatNumber },
  { field: 'level', label: 'Уровень', format: String },
  { field: 'damage', label: 'Урона нанесено', format: formatNumber },
  { field: 'wave', label: 'Последняя волна', format: String },
  { field: 'crits', label: 'Критических ударов', format: formatNumber },
];

/**
 * Экран итогов забега: показатели против рекорда, кого и сколько убили,
 * с какой сборкой. summary — то, что собрал main.js в момент смерти.
 */
export function drawSummaryScreen(ctx, canvas, summary) {
  const { stats, result } = summary;
  const cx = canvas.width / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(8, 10, 16, 0.78)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawText(ctx, 'ВЫ ПОГИБЛИ', cx, 28, { scale: 5, align: 'center', color: C.danger });

  if (result.beaten.size > 0) {
    // Мигание — новый рекорд должен бросаться в глаза.
    const color = Math.floor(performance.now() / 260) % 2 === 0 ? C.record : '#fff1b0';
    drawText(ctx, '+ НОВЫЙ РЕКОРД +', cx, 76, { scale: 3, align: 'center', color });
  } else {
    drawText(ctx, `Забег № ${result.record.runs}`, cx, 80, { scale: SCALE, align: 'center', color: C.dim });
  }

  const left = cx - PANEL_WIDTH / 2;
  const top = 106;
  const kills = killsLine(stats.killsByType);
  const build = wrapText(stats.build || 'без улучшений', PANEL_WIDTH - 48, SCALE);
  const buildHeight = textHeight(SCALE) + 4;
  const killsHeight = kills.length > 0 ? 12 + killRows(kills) * 22 : 0;
  const height = 42 + ROWS.length * ROW_HEIGHT + 28 + killsHeight + build.length * buildHeight + 8;

  pixelPanel(ctx, left, top, PANEL_WIDTH, height, C.panel, C.border);

  // Шапка таблицы.
  const labelX = left + 24;
  const valueX = left + 360;
  const recordX = left + PANEL_WIDTH - 24;
  let y = top + 18;
  drawText(ctx, 'ЭТОТ ЗАБЕГ', valueX, y, { scale: SCALE, align: 'right', color: C.dim });
  drawText(ctx, 'РЕКОРД', recordX, y, { scale: SCALE, align: 'right', color: C.dim });

  y += 20;
  for (const row of ROWS) {
    drawRow(ctx, row, stats, result, { labelX, valueX, recordX, y });
    y += ROW_HEIGHT;
  }

  y += 4;
  ctx.fillStyle = C.border;
  ctx.fillRect(labelX, y, PANEL_WIDTH - 48, 2);
  y += 14;

  if (kills.length > 0) {
    drawKills(ctx, kills, labelX, y);
    y += killsHeight;
  }

  for (const line of build) {
    drawText(ctx, line, labelX, y, { scale: SCALE, color: C.dim });
    y += buildHeight;
  }

  drawText(ctx, 'R / Enter / клик — заново · Esc — в меню', cx, canvas.height - 34, {
    scale: SCALE,
    align: 'center',
    color: Math.floor(performance.now() / 520) % 2 === 0 ? C.accent : C.dim,
  });

  ctx.restore();
}

function drawRow(ctx, row, stats, result, { labelX, valueX, recordX, y }) {
  const beaten = result.beaten.has(row.field);

  drawText(ctx, row.label, labelX, y + 4, { scale: SCALE, color: C.dim });
  drawText(ctx, row.format(stats[row.field]), valueX, y, {
    scale: 3,
    align: 'right',
    color: beaten ? C.record : C.text,
  });
  // Справочные строки без рекорда — колонку справа оставляем пустой.
  if (!(row.field in result.record)) return;

  if (beaten) {
    drawText(ctx, `было ${row.format(result.previous[row.field])}`, recordX, y + 4, {
      scale: SCALE,
      align: 'right',
      color: C.record,
    });
  } else {
    drawText(ctx, row.format(result.record[row.field]), recordX, y + 4, {
      scale: SCALE,
      align: 'right',
      color: C.dim,
    });
  }
}

/** Убитые по типам — в порядке появления типов в игре. */
function killsLine(killsByType) {
  return ENEMY_TYPE_LIST.filter((type) => killsByType[type.id] > 0).map((type) => ({
    type,
    count: killsByType[type.id],
  }));
}

function killLabel({ type, count }) {
  return `${type.title} x${formatNumber(count)}`;
}

const KILL_ROOM = PANEL_WIDTH - 48;

function killWidth(kill) {
  return 20 + measureText(killLabel(kill), SCALE);
}

function killRows(kills) {
  let rows = 1;
  let x = 0;
  for (const kill of kills) {
    if (x > 0 && x + killWidth(kill) > KILL_ROOM) {
      rows += 1;
      x = 0;
    }
    x += killWidth(kill) + 18;
  }
  return rows;
}

/** Убитые по типам в строку; не влезшие переносятся. Возвращает нижнюю границу. */
function drawKills(ctx, kills, x, y) {
  const startX = x;
  for (const { type, count } of kills) {
    if (x > startX && x - startX + killWidth({ type, count }) > KILL_ROOM) {
      x = startX;
      y += 22;
    }
    ctx.fillStyle = type.color;
    ctx.fillRect(x, y + 1, 12, 12);

    drawText(ctx, killLabel({ type, count }), x + 20, y, { scale: SCALE, color: C.text });
    x += killWidth({ type, count }) + 18;
  }
}
