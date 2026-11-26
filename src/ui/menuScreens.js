import { drawText, textHeight } from '../gfx/font.js';
import { t } from '../i18n/index.js';
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

/** Подпись состояния связи с бэкендом рекордов (ключи — ONLINE из online/backend.js). */
const ONLINE_LABELS = {
  off: { key: 'menu.online.off', color: C.dim },
  checking: { key: 'menu.online.checking', color: C.dim },
  ok: { key: 'menu.online.ok', color: C.accent },
  error: { key: 'menu.online.error', color: C.danger },
};

/** Главное меню. Герои рисуются в main.js поверх — для них оставлено место над заголовком. */
export function drawMenuScreen(ctx, canvas, record, campaign, gold = 0, hero = null, online = 'off', nick = '', daily = null, achievements = null) {
  veil(ctx, canvas, 0.7);
  const cx = canvas.width / 2;
  const link = ONLINE_LABELS[online] ?? ONLINE_LABELS.off;
  drawText(ctx, t(link.key), 16, 16, { scale: 2, color: link.color });
  // Ник в углу напротив связи: под каким именем результат уйдёт в таблицу.
  drawText(ctx, nick ? t('menu.player', { nick }) : t('menu.player.none'), canvas.width - 16, 16, {
    scale: 2,
    align: 'right',
    color: nick ? C.accent : C.dim,
  });
  // Достижения — под строкой связи: сколько открыто и какой клавишей посмотреть.
  if (achievements) drawText(ctx, t('menu.achievements', achievements), 16, 40, { scale: 2, color: C.dim });
  // Испытание дня — над заголовком: общий для всех мир, играется в любой момент.
  if (daily) {
    drawText(ctx, t('menu.daily.title', { date: daily.date }), cx, 40, { scale: 2, align: 'center', color: C.record });
    drawText(ctx, t('menu.daily.info', daily), cx, 62, {
      scale: 2,
      align: 'center',
      color: C.dim,
    });
  }
  const { list, selected, cleared } = campaign;
  const location = list[selected];
  const open = selected === 0 || cleared.has(list[selected - 1].id);

  drawText(ctx, 'SURVIVE', cx, 170, { scale: 8, align: 'center', color: C.title });
  drawText(ctx, 'OR DIE', cx, 170 + textHeight(8) + 8, { scale: 8, align: 'center', color: C.danger });

  const mapTop = 170 + (textHeight(8) + 8) * 2 + 14;
  drawCampaignMap(ctx, canvas, mapTop, campaign);

  const status = open
    ? cleared.has(location.id) ? t('menu.status.cleared') : ''
    : t('menu.status.locked', { name: list[selected - 1].title });
  const lines = [
    { text: `${selected + 1}. ${location.title}${status}`, color: open ? C.accent : C.danger },
    { text: t('menu.keys.select'), color: C.dim },
    ...(hero ? [{ text: `${hero.title}: ${hero.desc}`, color: hero.color }] : []),
    { text: t('menu.gold', { gold }), color: C.record },
    { text: t('menu.keys.misc'), color: C.dim },
  ];
  if (record.runs > 0) {
    lines.push({
      text: t('menu.record', { time: formatTime(record.time), kills: record.kills, level: record.level }),
      color: C.record,
    });
  }
  drawHints(ctx, canvas, mapTop + 40 + 22, lines);

  if (blink()) {
    drawText(ctx, open ? t('menu.start') : t('menu.locked'), cx, canvas.height - 24, {
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

  drawText(ctx, t('pause.title'), cx, 170, { scale: 8, align: 'center', color: C.title });
  drawHints(ctx, canvas, 170 + textHeight(8) + 28, [
    { text: t('pause.resume'), color: C.accent },
    { text: t('pause.settings') },
    { text: t('pause.restart') },
    { text: t('pause.menu') },
  ]);
}
