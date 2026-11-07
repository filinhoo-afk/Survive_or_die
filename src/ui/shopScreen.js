import { drawText } from '../gfx/font.js';
import { META_UPGRADES, levelOf, priceOf } from '../systems/meta.js';
import { UI_COLORS as C, pixelPanel } from './panel.js';

const ROW_HEIGHT = 56;
const ROW_WIDTH = 640;
const ROW_GAP = 8;

function rowTop(canvas, index) {
  return 150 + index * (ROW_HEIGHT + ROW_GAP);
}

/** Номер строки магазина под точкой (x, y) или -1. */
export function shopRowAt(x, y, canvas) {
  const left = (canvas.width - ROW_WIDTH) / 2;
  for (let i = 0; i < META_UPGRADES.length; i += 1) {
    const top = rowTop(canvas, i);
    if (x >= left && x <= left + ROW_WIDTH && y >= top && y <= top + ROW_HEIGHT) return i;
  }
  return -1;
}

/** Магазин постоянных улучшений: строки с уровнем и ценой, выбранная подсвечена. */
export function drawShopScreen(ctx, canvas, meta, selected) {
  ctx.fillStyle = 'rgba(8, 10, 16, 0.88)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const left = (canvas.width - ROW_WIDTH) / 2;

  drawText(ctx, 'МАГАЗИН', cx, 50, { scale: 6, align: 'center', color: C.title });
  drawText(ctx, `Золото: ${meta.gold}`, cx, 108, { scale: 3, align: 'center', color: C.record });

  META_UPGRADES.forEach((upgrade, i) => {
    const top = rowTop(canvas, i);
    const level = levelOf(meta, upgrade.id);
    const price = priceOf(meta, upgrade);
    const affordable = price !== null && meta.gold >= price;
    const border = i === selected ? C.title : affordable ? C.accent : C.border;
    pixelPanel(ctx, left, top, ROW_WIDTH, ROW_HEIGHT, i === selected ? C.panelHover : C.panel, border);

    drawText(ctx, upgrade.title, left + 20, top + 10, { scale: 3, color: C.text });
    drawText(ctx, upgrade.desc, left + 20, top + 36, { scale: 2, color: C.dim });

    // Пипсы уровня: заполненные — куплено.
    for (let p = 0; p < upgrade.max; p += 1) {
      ctx.fillStyle = p < level ? C.record : C.well;
      ctx.fillRect(left + 330 + p * 18, top + 20, 14, 14);
    }

    drawText(ctx, price === null ? 'МАКС' : `${price}`, left + ROW_WIDTH - 20, top + 18, {
      scale: 3,
      align: 'right',
      color: price === null ? C.dim : affordable ? C.record : C.danger,
    });
  });

  drawText(ctx, 'W / S — выбор · Enter / клик — купить · Esc — назад', cx, canvas.height - 40, {
    scale: 2,
    align: 'center',
    color: C.dim,
  });
}
