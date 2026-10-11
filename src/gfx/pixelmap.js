/** Символ пустого пикселя в пиксельной карте. */
export const TRANSPARENT = '.';

/**
 * Разбирает пиксельную карту: массив строк, где каждый символ — цвет из палитры.
 * @param {string[]} rows строки одинаковой длины
 * @param {Record<string, string>} palette символ → css-цвет
 * @param {string} [label] что разбираем — для понятной ошибки
 * @returns {{width: number, height: number, pixels: (string|null)[]}} пиксели по строкам
 */
export function parseFrame(rows, palette, label = 'кадр') {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`${label}: пустая пиксельная карта`);
  }

  const width = rows[0].length;
  const pixels = [];

  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`${label}: строка ${y} длиной ${row.length}, ожидалось ${width}`);
    }
    for (const symbol of row) {
      if (symbol === TRANSPARENT) {
        pixels.push(null);
      } else if (palette[symbol] !== undefined) {
        pixels.push(palette[symbol]);
      } else {
        throw new Error(`${label}: символа «${symbol}» нет в палитре`);
      }
    }
  });

  return { width, height: rows.length, pixels };
}

/**
 * Раскладывает прямоугольники по полкам слева направо и сверху вниз.
 * @param {{width: number, height: number}[]} sizes
 * @param {number} maxWidth ширина атласа, дальше перенос на новую полку
 * @param {number} padding зазор между кадрами, чтобы соседи не просачивались
 * @returns {{positions: {x: number, y: number}[], width: number, height: number}}
 */
export function packFrames(sizes, maxWidth = 256, padding = 1) {
  const positions = [];
  let x = 0;
  let y = 0;
  let shelfHeight = 0;
  let usedWidth = 0;

  for (const size of sizes) {
    if (size.width > maxWidth) throw new Error(`кадр шире атласа: ${size.width} > ${maxWidth}`);

    if (x > 0 && x + size.width > maxWidth) {
      x = 0;
      y += shelfHeight + padding;
      shelfHeight = 0;
    }

    positions.push({ x, y });
    x += size.width + padding;
    shelfHeight = Math.max(shelfHeight, size.height);
    usedWidth = Math.max(usedWidth, x - padding);
  }

  return { positions, width: usedWidth, height: y + shelfHeight };
}
