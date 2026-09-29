const CARD_WIDTH = 240;
const CARD_HEIGHT = 250;
const CARD_GAP = 28;
const CARD_TOP = 165;
const FONT = '"Segoe UI", system-ui, sans-serif';

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

export function drawUpgradeScreen(ctx, canvas, { offers, hovered, targets, state, level }) {
  ctx.save();

  ctx.fillStyle = 'rgba(8, 10, 16, 0.74)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#7ee787';
  ctx.font = `bold 28px ${FONT}`;
  ctx.fillText(`Уровень ${level}`, canvas.width / 2, 100);
  ctx.fillStyle = '#8b98ab';
  ctx.font = `15px ${FONT}`;
  ctx.fillText('Выбери улучшение: клавиши 1, 2, 3 или клик', canvas.width / 2, 130);

  cardRects(offers.length, canvas).forEach((rect, i) => {
    drawCard(ctx, rect, offers[i], i, i === hovered, targets, state);
  });

  ctx.restore();
}

function drawCard(ctx, rect, upgrade, index, hovered, targets, state) {
  // Карточка под курсором приподнимается — сразу видно, что выберется.
  const y = rect.y - (hovered ? 6 : 0);
  const cx = rect.x + rect.width / 2;

  ctx.beginPath();
  ctx.roundRect(rect.x, y, rect.width, rect.height, 12);
  ctx.fillStyle = hovered ? '#1d2537' : '#161c2b';
  ctx.fill();
  ctx.lineWidth = hovered ? 3 : 2;
  ctx.strokeStyle = hovered ? upgrade.color : '#31405e';
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(rect.x + 12, y + 12, 26, 26, 6);
  ctx.fillStyle = '#0b0e14';
  ctx.fill();
  ctx.fillStyle = '#c9d1d9';
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(index + 1), rect.x + 25, y + 30);

  ctx.beginPath();
  ctx.arc(cx, y + 62, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0e14';
  ctx.fill();
  drawIcon(ctx, upgrade.icon, cx, y + 62, upgrade.color);

  ctx.fillStyle = '#f5f7fb';
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillText(upgrade.title, cx, y + 122);

  const rank = state.rank(upgrade.id);
  ctx.fillStyle = rank === 0 ? upgrade.color : '#8b98ab';
  ctx.font = `13px ${FONT}`;
  ctx.fillText(rank === 0 ? 'новое' : `ранг ${rank} → ${rank + 1}`, cx, y + 144);

  ctx.fillStyle = '#c9d1d9';
  ctx.font = `14px ${FONT}`;
  wrapText(ctx, upgrade.text, rect.width - 36).forEach((line, i) => {
    ctx.fillText(line, cx, y + 176 + i * 19);
  });

  const [before, after] = state.preview(upgrade, targets);
  ctx.font = `bold 18px ${FONT}`;
  const arrow = '  →  ';
  const full = before + arrow + after;
  const startX = cx - ctx.measureText(full).width / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8b98ab';
  ctx.fillText(before + arrow, startX, y + rect.height - 22);
  ctx.fillStyle = upgrade.color;
  ctx.fillText(after, startX + ctx.measureText(before + arrow).width, y + rect.height - 22);
  ctx.textAlign = 'center';
}

/** Разбивает текст на строки по ширине — canvas сам переносить не умеет. */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';

  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function drawIcon(ctx, kind, x, y, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (kind === 'bullet') {
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x - 16, y + 8);
    ctx.lineTo(x + 2, y - 2);
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x + 5, y - 4, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'rate') {
    for (const dx of [-12, 0, 12]) {
      ctx.beginPath();
      ctx.arc(x + dx, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'speed') {
    for (const dx of [-8, 6]) {
      ctx.beginPath();
      ctx.moveTo(x + dx - 6, y - 11);
      ctx.lineTo(x + dx + 5, y);
      ctx.lineTo(x + dx - 6, y + 11);
      ctx.stroke();
    }
  } else if (kind === 'heart') {
    ctx.beginPath();
    ctx.moveTo(x, y + 12);
    ctx.bezierCurveTo(x - 20, y - 2, x - 10, y - 18, x, y - 7);
    ctx.bezierCurveTo(x + 10, y - 18, x + 20, y - 2, x, y + 12);
    ctx.fill();
  } else if (kind === 'magnet') {
    ctx.lineWidth = 7;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.arc(x, y - 2, 11, Math.PI, 0, true);
    ctx.moveTo(x - 11, y - 2);
    ctx.lineTo(x - 11, y - 12);
    ctx.moveTo(x + 11, y - 2);
    ctx.lineTo(x + 11, y - 12);
    ctx.stroke();
    ctx.fillStyle = '#f5f7fb';
    ctx.fillRect(x - 14.5, y - 16, 7, 5);
    ctx.fillRect(x + 7.5, y - 16, 7, 5);
  }

  ctx.restore();
}
