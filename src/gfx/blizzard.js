/**
 * Метель: снег летит по экрану, а белая пелена сжимает обзор до круга вокруг
 * героя. Порывы ветра то сужают, то расширяют круг — его радиус «дышит».
 */
export function createBlizzard(width, height, cfg) {
  const flakes = Array.from({ length: cfg.flakes }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    // Дальние хлопья мельче и медленнее — глубина без лишних трат.
    depth: 0.4 + Math.random() * 0.6,
  }));
  let clock = 0;

  /** Текущий радиус видимости: базовый плюс порыв. */
  const radius = () => cfg.radius + Math.sin((clock / cfg.period) * Math.PI * 2) * cfg.gust;

  return {
    radius,

    update(dt) {
      clock += dt;
      for (const f of flakes) {
        f.x += cfg.wind.x * f.depth * dt;
        f.y += cfg.wind.y * f.depth * dt;
        if (f.x < -4) f.x += width + 8;
        if (f.x > width + 4) f.x -= width + 8;
        if (f.y < -4) f.y += height + 8;
        if (f.y > height + 4) f.y -= height + 8;
      }
    },

    /** focusX/focusY — где герой на экране; вне круга обзора всё затянуто пеленой. */
    draw(ctx, focusX, focusY) {
      const outer = radius();
      const gradient = ctx.createRadialGradient(focusX, focusY, outer * 0.35, focusX, focusY, outer);
      gradient.addColorStop(0, rgba(cfg.fog, 0));
      gradient.addColorStop(1, rgba(cfg.fog, cfg.fogAlpha));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#eef6ff';
      for (const f of flakes) {
        ctx.globalAlpha = 0.35 + f.depth * 0.5;
        const size = f.depth > 0.75 ? 3 : 2;
        ctx.fillRect(Math.round(f.x), Math.round(f.y), size, size);
      }
      ctx.globalAlpha = 1;
    },
  };
}

function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
