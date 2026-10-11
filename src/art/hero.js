/** Герой: пока заготовка для проверки спрайтовой системы, полноценный игрок — на 22-й день. */
const PALETTE = {
  o: '#0b0e14',
  g: '#7ee787',
  d: '#4fae5a',
  s: '#f2d3b0',
  w: '#ffffff',
  b: '#5a3a22',
};

const HEAD_AND_BODY = [
  '..oooooo..',
  '.oggggggo.',
  'oggggggggo',
  'osssssssso',
  'oswssssswo',
  'osssssssso',
  '.oddddddo.',
  'oddggggddo',
  'oddggggddo',
  '.oddddddo.',
  '..obbbbo..',
];

/** Тело то же, меняются только последние строки — глаза и ноги. */
function variant(eyes, legs) {
  const rows = [...HEAD_AND_BODY];
  if (eyes) rows[4] = eyes;
  rows.push(legs);
  return rows;
}

export const HERO_CLIPS = {
  'hero.idle': {
    palette: PALETTE,
    frames: [
      variant(null, '..oo..oo..'),
      variant('osssssssso', '..oo..oo..'), // моргнул
    ],
    // Моргает редко: открытый кадр держится четыре такта из пяти.
    order: [0, 0, 0, 0, 1],
    fps: 5,
  },
  'hero.walk': {
    palette: PALETTE,
    frames: [
      variant(null, '.ob....bo.'),
      variant(null, '..oo..oo..'),
      variant(null, '..ob.oo...'),
      variant(null, '...oo.bo..'),
    ],
    fps: 8,
  },
};
