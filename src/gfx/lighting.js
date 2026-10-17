/**
 * Динамическое освещение: тёмная плёнка на весь экран с «дырами» там, где свет.
 * Плёнка рисуется на отдельном канвасе размером с экран, потом накладывается
 * поверх сцены — HUD после этого остаётся нетронутым.
 */
export function createLighting(width, height, { ambient, glowAlpha }) {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const lctx = layer.getContext('2d');

  return {
    /**
     * Накладывает освещение на ctx. lights — [{ x, y, radius, color? }] в координатах
     * мира; offsetX/offsetY — тот же сдвиг камеры, что применён к сцене.
     */
    draw(ctx, lights, offsetX, offsetY) {
      lctx.globalCompositeOperation = 'source-over';
      lctx.fillStyle = `rgba(6, 8, 18, ${ambient})`;
      lctx.fillRect(0, 0, width, height);

      lctx.globalCompositeOperation = 'destination-out';
      const visible = [];
      for (const light of lights) {
        const x = light.x - offsetX;
        const y = light.y - offsetY;
        if (x < -light.radius || x > width + light.radius) continue;
        if (y < -light.radius || y > height + light.radius) continue;
        visible.push({ x, y, light });
        lctx.fillStyle = falloff(lctx, x, y, light.radius, 'rgba(0, 0, 0, 1)');
        lctx.fillRect(x - light.radius, y - light.radius, light.radius * 2, light.radius * 2);
      }

      ctx.drawImage(layer, 0, 0);

      // Тёплое свечение поверх тьмы: источники светятся своим цветом.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = glowAlpha;
      for (const { x, y, light } of visible) {
        if (!light.color) continue;
        const r = light.radius * 0.6;
        ctx.fillStyle = falloff(ctx, x, y, r, light.color);
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.restore();
    },
  };
}

/** Радиальный градиент от цвета в центре до прозрачности на краю. */
function falloff(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.45, withAlpha(color, 0.55));
  gradient.addColorStop(1, withAlpha(color, 0));
  return gradient;
}

/** Меняет альфу у цвета вида rgba(...) или #rrggbb, домножая на factor. */
function withAlpha(color, factor) {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${factor})`;
  }
  const [r, g, b, a = 1] = color.match(/[\d.]+/g).map(Number);
  return `rgba(${r}, ${g}, ${b}, ${a * factor})`;
}
