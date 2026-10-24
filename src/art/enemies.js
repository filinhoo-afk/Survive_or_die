/**
 * Враги: по три группы клипов на тип.
 *
 *   <id>.walk  — ходьба, два кадра;
 *   <id>.hit   — тот же цикл, залитый белым: вспышка при попадании;
 *   <id>.death — кадры смерти, строятся из первого кадра ходьбы кодом.
 * У стрелка добавлен <id>.aim — раскалённый ствол перед выстрелом.
 *
 * Все спрайты нарисованы лицом вправо; влево игра отражает их зеркально.
 * Символ «w» в каждой палитре — белый: им красится вспышка и кадр смерти.
 */

const FLASH = '#ffffff';

const GRUNT_BODY = [
  'o.......o',
  'oo.....oo',
  '.ooooooo.',
  'orrrrrrro',
  'oryyryyro',
  'orrrrrrro',
  'odrrrrrdo',
  '.odddddo.',
];

const SWARM_BODY = [
  'o..oo..o',
  '.ommmmo.',
  'omoo.moo',
  'ommmmmmo',
  '.odmmdo.',
  '..oddo..',
];

const TANK_BODY = [
  '....oooooooo....',
  '..ooollllmmmoo..',
  '.oolmmmmmmmmmdo.',
  'oolmmmmmmmmmmddo',
  'olmmmeemmeemmddo',
  'olmmmeemmeemmddo',
  'olmmmmmmmmmmmddo',
  'oommmoooooommdoo',
  'oommmowowowmmdoo',
  'olmmmmmmmmmmmddo',
  '.oddmmmmmmmmddo.',
  '.ooddddddddddoo.',
  '..oooooooooooo..',
];

const SHOOTER_BODY = [
  '....oooo....',
  '...ommmmo...',
  '..ommmmmmo..',
  '..ommwwmmo..',
  '..ommwwmmooo',
  '..ommmmmmddo',
  '..odmmmmmooo',
  '...oddddo...',
];

const WOLF_BODY = [
  '.........oo...',
  '..oo....oggo..',
  '.ogggoooggggoo',
  'oggggggggggeyo',
  'ogggggggggggoo',
  '.odgggggggddo.',
  '..odddddddoo..',
];

const TREANT_BODY = [
  '..b..b..bb..b..',
  '.bbb.bbbbb.bbb.',
  'bbbbbbbbbbbbbbb',
  '.bbbbbbbbbbbbb.',
  '..oooooooooo...',
  '.oTTTTTTTTTTo..',
  'oTTeeTTTTeeTTTo',
  'oTTeeTTTTeeTTTo',
  'oTTTTTTTTTTTTTo',
  'oTTTTooooTTTTTo',
  'oTTTTTTTTTTTTTo',
  '.oTdTTTTTTdTTo.',
  '.oddTTTTTTddo..',
  '..ooddddddooo..',
];

/** Клип ходьбы и вспышки: ноги — последняя строка, их два положения. */
function legged(body, legsA, legsB) {
  return [
    [...body, legsA],
    [...body, legsB],
  ];
}

/** Всё, кроме контура и пустоты, красит в «w» — белый силуэт. */
function toWhite(rows) {
  return rows.map((row) => row.replace(/[^.o]/g, 'w'));
}

/** Сдвигает рисунок вниз на n строк; низ уходит «в землю». */
function sink(rows, n) {
  const blank = '.'.repeat(rows[0].length);
  return [...Array(n).fill(blank), ...rows.slice(0, rows.length - n)];
}

/** Оставляет только пиксели, для которых keep(x, y) истинно. */
function thin(rows, keep) {
  return rows.map((row, y) =>
    [...row].map((symbol, x) => (keep(x, y) ? symbol : '.')).join(''),
  );
}

/**
 * Смерть: белая вспышка, потом рисунок оседает и рассыпается — сначала
 * в шахматку, потом в редкие точки.
 */
function deathFrames(frame) {
  const height = frame.length;
  return [
    toWhite(frame),
    thin(sink(frame, Math.ceil(height * 0.2)), (x, y) => (x + y) % 2 === 0),
    thin(sink(frame, Math.ceil(height * 0.4)), (x, y) => x % 2 === 0 && y % 2 === 0),
  ];
}

/** Палитра вспышки: контур остаётся, остальное белое. */
function flashPalette(palette) {
  return Object.fromEntries(
    Object.entries(palette).map(([symbol, color]) => [symbol, symbol === 'o' ? color : FLASH]),
  );
}

function enemyClips(id, { palette, frames, fps, extra = {} }) {
  const anchor = { x: 0.5, y: 0.5 };
  return {
    [`${id}.walk`]: { palette, frames, fps, anchor },
    [`${id}.hit`]: { palette: flashPalette(palette), frames, fps, anchor },
    [`${id}.death`]: {
      palette,
      frames: deathFrames(frames[0]),
      fps: 11,
      loop: false,
      anchor,
    },
    ...extra,
  };
}

const shooterPalette = { o: '#4a2205', m: '#ff9f43', d: '#c46a1c', w: '#ffffff', g: '#ffe27a' };
const shooterFrames = legged(SHOOTER_BODY, '...oo..oo...', '....oooo....');

/** Тот же стрелок, но ствол раскалён: рисуется поверх обычной ходьбы. */
const shooterAim = shooterFrames.map((rows) =>
  rows.map((row, y) => (y === 5 ? row.replace('dd', 'gg') : row)),
);

export const ENEMY_CLIPS = {
  ...enemyClips('grunt', {
    palette: { o: '#2a100d', r: '#f2786a', d: '#c24f43', y: '#ffe27a', w: '#ffffff' },
    frames: legged(GRUNT_BODY, '.oo...oo.', '..ooooo..'),
    fps: 6,
  }),
  ...enemyClips('swarm', {
    palette: { o: '#3a2a06', m: '#f2c14e', d: '#b8892a', w: '#ffffff' },
    frames: legged(SWARM_BODY, '.o.oo.o.', 'o..oo..o'),
    fps: 12,
  }),
  ...enemyClips('tank', {
    palette: {
      o: '#2c0f38',
      m: '#b46ad0',
      l: '#d9a2ee',
      d: '#7c3f96',
      e: '#ffe27a',
      w: '#f4e9ff',
    },
    frames: legged(TANK_BODY, '..oo..oooo..oo..', '..oo.oo..oo.oo..'),
    fps: 4,
  }),
  ...enemyClips('wolf', {
    palette: { o: '#14161c', g: '#8a919e', d: '#575d6b', e: '#ffe27a', y: '#e0452f', w: '#ffffff' },
    frames: legged(WOLF_BODY, '.oo..oo..oo.oo', 'oo..oo....oo.o'),
    fps: 9,
  }),
  ...enemyClips('treant', {
    palette: {
      o: '#150f08',
      b: '#3f7a3a',
      T: '#6b4a2b',
      d: '#46301b',
      e: '#ffb347',
      w: '#fff3dc',
    },
    frames: legged(TREANT_BODY, '..oo.oo..oo.oo.', '..oo..oo.oo..o.'),
    fps: 3,
  }),
  ...enemyClips('shooter', {
    palette: shooterPalette,
    frames: shooterFrames,
    fps: 5,
    extra: {
      'shooter.aim': {
        palette: shooterPalette,
        frames: shooterAim,
        fps: 5,
        anchor: { x: 0.5, y: 0.5 },
      },
    },
  }),
};
