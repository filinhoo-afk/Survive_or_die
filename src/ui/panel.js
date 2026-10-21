export const UI_COLORS = {
  veil: 'rgba(8, 10, 16, 0.74)',
  panel: '#161c2b',
  panelHover: '#1d2537',
  border: '#31405e',
  well: '#0b0e14',
  text: '#c9d1d9',
  dim: '#8b98ab',
  title: '#f5f7fb',
  accent: '#7ee787',
  danger: '#f2786a',
  record: '#ffd34e',
};

/** Прямоугольник со «срезанными» углами — так рамки выглядят пиксельными. */
export function pixelPanel(ctx, x, y, width, height, fill, border, step = 4) {
  ctx.fillStyle = border;
  ctx.fillRect(x + step, y, width - step * 2, height);
  ctx.fillRect(x, y + step, width, height - step * 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x + step, y + step, width - step * 2, height - step * 2);
}
