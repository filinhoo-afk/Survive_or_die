import { ENEMY_TYPE_LIST } from '../enemies/types.js';
import { formatNumber, formatTime } from './format.js';

const FONT = '"Segoe UI", system-ui, sans-serif';
const PANEL_WIDTH = 560;
const ROW_HEIGHT = 30;

const COLORS = {
  title: '#f2786a',
  text: '#c9d1d9',
  muted: '#8b98ab',
  record: '#ffd34e',
  panel: '#161c2b',
  border: '#31405e',
};

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

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.title;
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText('Вы погибли', cx, 62);

  ctx.font = `15px ${FONT}`;
  if (result.beaten.size > 0) {
    // Мягкая пульсация — новый рекорд должен бросаться в глаза.
    const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 180);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = COLORS.record;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText('★ Новый рекорд! ★', cx, 90);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`Забег № ${result.record.runs}`, cx, 90);
  }

  const left = cx - PANEL_WIDTH / 2;
  const top = 108;
  const kills = killsLine(stats.killsByType);
  const build = wrap(ctx, stats.build || 'без улучшений', PANEL_WIDTH - 40);
  const height = 40 + ROWS.length * ROW_HEIGHT + 26 + (kills.length > 0 ? 34 : 0) + build.length * 20 + 8;

  ctx.beginPath();
  ctx.roundRect(left, top, PANEL_WIDTH, height, 12);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.border;
  ctx.stroke();

  // Шапка таблицы.
  const labelX = left + 24;
  const valueX = left + 340;
  const recordX = left + PANEL_WIDTH - 24;
  let y = top + 30;
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = 'right';
  ctx.fillText('ЭТОТ ЗАБЕГ', valueX, y);
  ctx.fillText('РЕКОРД', recordX, y);

  for (const row of ROWS) {
    y += ROW_HEIGHT;
    drawRow(ctx, row, stats, result, { labelX, valueX, recordX, y });
  }

  y += 30;
  ctx.textAlign = 'left';
  if (kills.length > 0) {
    drawKills(ctx, kills, labelX, y);
    y += 34;
  }

  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = COLORS.muted;
  for (const line of build) {
    ctx.fillText(line, labelX, y);
    y += 20;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.muted;
  ctx.font = `15px ${FONT}`;
  ctx.fillText('R / Enter / клик — заново · Esc — в меню', cx, canvas.height - 24);

  ctx.restore();
}

function drawRow(ctx, row, stats, result, { labelX, valueX, recordX, y }) {
  const beaten = result.beaten.has(row.field);

  ctx.textAlign = 'left';
  ctx.font = `15px ${FONT}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(row.label, labelX, y);

  ctx.textAlign = 'right';
  ctx.font = `bold 17px ${FONT}`;
  ctx.fillStyle = beaten ? COLORS.record : COLORS.text;
  ctx.fillText(row.format(stats[row.field]), valueX, y);

  // Справочные строки без рекорда — колонку справа оставляем пустой.
  if (!(row.field in result.record)) return;

  ctx.font = `15px ${FONT}`;
  if (beaten) {
    ctx.fillStyle = COLORS.record;
    ctx.fillText(`★ было ${row.format(result.previous[row.field])}`, recordX, y);
  } else {
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(row.format(result.record[row.field]), recordX, y);
  }
}

/** Убитые по типам — в порядке появления типов в игре. */
function killsLine(killsByType) {
  return ENEMY_TYPE_LIST.filter((type) => killsByType[type.id] > 0).map((type) => ({
    type,
    count: killsByType[type.id],
  }));
}

function drawKills(ctx, kills, x, y) {
  ctx.font = `14px ${FONT}`;
  for (const { type, count } of kills) {
    ctx.fillStyle = type.color;
    ctx.beginPath();
    ctx.arc(x + 6, y - 5, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.text;
    const text = `${type.title} × ${formatNumber(count)}`;
    ctx.fillText(text, x + 18, y);
    x += 18 + ctx.measureText(text).width + 22;
  }
}

/** Разбивает сводку сборки «A · B · C» на строки, не разрывая пункты. */
function wrap(ctx, text, maxWidth) {
  ctx.save();
  ctx.font = `13px ${FONT}`;
  const lines = [];
  let line = '';
  for (const part of text.split(' · ')) {
    const candidate = line ? `${line} · ${part}` : part;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = part;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  ctx.restore();
  return lines;
}
