import { packFrames, parseFrame } from './pixelmap.js';

/**
 * @typedef {object} ClipDef
 * @property {Record<string, string>} palette символ → цвет
 * @property {string[][]} frames кадры: каждый — пиксельная карта
 * @property {number[]} [order] порядок показа по номерам кадров (кадр можно
 *   повторять, чтобы он держался дольше); по умолчанию — все по очереди
 * @property {number} [fps] кадров в секунду; 0 или не задано — один статичный кадр
 * @property {boolean} [loop] крутить по кругу (по умолчанию да)
 * @property {{x: number, y: number}} [anchor] точка привязки в долях размера
 *   кадра; по умолчанию низ по центру — «ноги» стоят в координате объекта
 */

/**
 * Рисует все кадры один раз в общую картинку-атлас.
 * Дальше игра только вырезает из неё прямоугольники — без разбора карт в кадре.
 *
 * @param {Record<string, ClipDef>} defs имя клипа → описание
 * @returns {{canvas: HTMLCanvasElement, clips: Record<string, object>}}
 */
export function buildAtlas(defs, { maxWidth = 256, padding = 1 } = {}) {
  const parsed = [];
  const clips = {};

  for (const [name, def] of Object.entries(defs)) {
    const frames = def.frames.map((rows, i) => parseFrame(rows, def.palette, `${name}[${i}]`));
    const order = def.order ?? frames.map((_, i) => i);
    for (const index of order) {
      if (!frames[index]) throw new Error(`${name}: в order нет кадра ${index}`);
    }
    clips[name] = {
      name,
      fps: def.fps ?? 0,
      loop: def.loop ?? true,
      anchor: def.anchor ?? { x: 0.5, y: 1 },
      order,
      frameCount: frames.length,
      rects: [],
    };
    frames.forEach((frame, i) => parsed.push({ name, index: i, frame }));
  }

  const layout = packFrames(parsed.map((item) => item.frame), maxWidth, padding);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, layout.width);
  canvas.height = Math.max(1, layout.height);
  const ctx = canvas.getContext('2d');

  // Прямоугольники кадров по их номерам; порядок показа соберём ниже.
  const rectsByClip = {};
  parsed.forEach((item, i) => {
    const { x, y } = layout.positions[i];
    const { width, height, pixels } = item.frame;

    for (let py = 0; py < height; py += 1) {
      for (let px = 0; px < width; px += 1) {
        const color = pixels[py * width + px];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }

    (rectsByClip[item.name] ??= [])[item.index] = { x, y, w: width, h: height };
  });

  for (const clip of Object.values(clips)) {
    clip.rects = clip.order.map((index) => rectsByClip[clip.name][index]);
  }

  return { canvas, clips };
}

/**
 * Рисует кадр атласа без сглаживания, чтобы пиксели оставались квадратными.
 * @param {{x: number, y: number}} clipAnchor точка привязки клипа
 * @param {object} [options]
 * @param {number} [options.scale] во сколько раз увеличить пиксель
 * @param {boolean} [options.flipX] зеркально по горизонтали
 * @param {number} [options.alpha]
 */
export function drawFrame(ctx, atlas, rect, clipAnchor, x, y, options = {}) {
  const { scale = 1, flipX = false, alpha = 1 } = options;
  const width = rect.w * scale;
  const height = rect.h * scale;
  // Целые координаты — иначе границы пикселей «плывут» и мерцают при движении.
  const left = Math.round(x - width * clipAnchor.x);
  const top = Math.round(y - height * clipAnchor.y);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (alpha !== 1) ctx.globalAlpha = alpha;

  if (flipX) {
    ctx.translate(left + width, top);
    ctx.scale(-1, 1);
    ctx.drawImage(atlas.canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, width, height);
  } else {
    ctx.drawImage(atlas.canvas, rect.x, rect.y, rect.w, rect.h, left, top, width, height);
  }

  ctx.restore();
}
