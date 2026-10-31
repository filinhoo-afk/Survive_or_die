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

/** Лесной страж: энт с оленьими рогами и тлеющими глазами. */
const GUARDIAN_BODY = [
  'a.a....a....a.a',
  'aa.a..aaa..a.aa',
  '.aaaaaaaaaaaaa.',
  '..bbbbbbbbbbb..',
  ...TREANT_BODY.slice(1),
];

/** Тот же страж с горящими глазами: прицел перед залпом. */
const GUARDIAN_AIM = GUARDIAN_BODY.map((row) => row.replace(/e/g, 'g'));

/** Некромант: капюшон, череп вместо лица, посох с зелёным огнём слева. */
const NECROMANCER_BODY = [
  'l...ooooooo....',
  'T..oppppppppo..',
  'T.oppppppppppo.',
  'T.opsssssssspo.',
  'T.opseesssseepo',
  'T.opssssssssspo',
  'T.opsswswswsspo',
  'T..oppppppppo..',
  'T.oppdppppdppo.',
  'T.opppdppdpppo.',
  'T.oppppppppppo.',
  '..oddppppppddo.',
];

/** Тот же некромант с жёлтыми глазами и огнём: прицел перед призывом. */
const NECROMANCER_AIM = NECROMANCER_BODY.map((row) => row.replace(/[el]/g, 'g'));

/** Ледяной червь: голова с раскрытой пастью, сегменты уходят влево. */
const ICEWORM_BODY = [
  '.....oooooo.....',
  '...ooiiiiiioo...',
  '..oiimmmmmmmmo..',
  '.oiimmmmmmmmmmdo',
  '.oimmeemmmmmmmdo',
  '.oimmeemmmmmmmdo',
  'oimmmmmmmmmmmmdo',
  'oimmmmmmooooosso',
  'oimmmmmmorrrrrso',
  'oimmmmmmooooosso',
  'oidmmmmmmmmmmddo',
  '.oddmmmmmmmmddo.',
  '..oodddddddddoo.',
];

/** Тот же червь с горящими глазами: вот-вот нырнёт. */
const ICEWORM_AIM = ICEWORM_BODY.map((row) => row.replace(/e/g, 'g'));

/** Призрак: балахон без ног, низ колышется (последняя строка — два положения). */
const GHOST_BODY = [
  '....oooo....',
  '..ollllllo..',
  '.ollllllllo.',
  'olleelleello',
  'olleelleello',
  'ollllllllllo',
  'ollllllllllo',
  'odllllllllld',
  'oddllllllddo',
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

const guardianPalette = {
  o: '#0c1408',
  b: '#2f8a4a',
  T: '#5a4a2e',
  d: '#3a2d1a',
  a: '#c9b98a',
  e: '#ff5a3c',
  g: '#fff07a',
  w: '#f2ffe8',
};

const icewormPalette = {
  o: '#0b1626',
  i: '#d6f2ff',
  m: '#6fb6e6',
  d: '#3b6fa0',
  e: '#ff5a3c',
  r: '#5a1020',
  s: '#ffffff',
  g: '#fff07a',
  w: '#ffffff',
};

const necromancerPalette = {
  o: '#12081c',
  p: '#5a2f8a',
  d: '#3a1d5c',
  s: '#d8d2c0',
  e: '#6bff9a',
  l: '#6bff9a',
  T: '#5a4a2e',
  g: '#fff07a',
  w: '#ffffff',
};

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
  ...enemyClips('guardian', {
    palette: { ...guardianPalette },
    frames: legged(GUARDIAN_BODY, '..oo.oo..oo.oo.', '..oo..oo.oo..o.'),
    fps: 2,
    extra: {
      'guardian.aim': {
        palette: guardianPalette,
        frames: legged(GUARDIAN_AIM, '..oo.oo..oo.oo.', '..oo..oo.oo..o.'),
        fps: 8,
        anchor: { x: 0.5, y: 0.5 },
      },
    },
  }),
  ...enemyClips('necromancer', {
    palette: { ...necromancerPalette },
    frames: legged(NECROMANCER_BODY, '..oo.oo.oo.oo..', '...oo.oo.oo.o..'),
    fps: 2,
    extra: {
      'necromancer.aim': {
        palette: necromancerPalette,
        frames: legged(NECROMANCER_AIM, '..oo.oo.oo.oo..', '...oo.oo.oo.o..'),
        fps: 8,
        anchor: { x: 0.5, y: 0.5 },
      },
    },
  }),
  ...enemyClips('iceworm', {
    palette: { ...icewormPalette },
    frames: legged(ICEWORM_BODY, '.ooo..ooo..ooo..', '..ooo..ooo..ooo.'),
    fps: 2,
    extra: {
      'iceworm.aim': {
        palette: icewormPalette,
        frames: legged(ICEWORM_AIM, '.ooo..ooo..ooo..', '..ooo..ooo..ooo.'),
        fps: 8,
        anchor: { x: 0.5, y: 0.5 },
      },
    },
  }),
  ...enemyClips('ghost', {
    palette: { o: '#2a3a5a', l: '#a9c0ee', d: '#6f88c0', e: '#101826', w: '#ffffff' },
    frames: legged(GHOST_BODY, 'o.oo.oo.oo.o', '.oo.oo.oo.o.'),
    fps: 4,
  }),
  ...enemyClips('wraith', {
    palette: { o: '#2c1450', l: '#c49af0', d: '#8658c4', e: '#ffd24a', w: '#ffffff' },
    frames: legged(GHOST_BODY, 'o.oo.oo.oo.o', '.oo.oo.oo.o.'),
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
