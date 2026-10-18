/** Мягкая овальная тень под ногами: рисуется до спрайтов, прямо на земле. */
export function drawShadow(ctx, x, footY, radius, cfg) {
  ctx.fillStyle = cfg.color;
  ctx.beginPath();
  ctx.ellipse(x, footY - 1, radius * cfg.widthK, radius * cfg.heightK, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Порядок отрисовки объектов с ногами: чем ниже стоят ноги на экране,
 * тем ближе объект к зрителю и тем позже он рисуется.
 */
export function sortByDepth(items) {
  return items.sort((a, b) => a.footY - b.footY);
}
