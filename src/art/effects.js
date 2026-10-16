/**
 * Снаряды, оружие и кристаллы.
 *
 *   shot.orb / shot.enemy — шарики игрока и стрелка, по два кадра пульсации;
 *   shot.knife            — нож, нарисован остриём вправо, в полёте поворачивается;
 *   orbit.ball            — шар орбитального щита;
 *   gem.small / gem.big   — кристаллы опыта, по два кадра блика.
 *
 * Все клипы с привязкой по центру: x, y объекта — середина картинки.
 */

const CENTER = { x: 0.5, y: 0.5 };

const ORB_A = [
  '..ooo..',
  '.owwwo.',
  'owwbbbo',
  'owbbbbo',
  'obbbbbo',
  '.obbbo.',
  '..ooo..',
];
const ORB_B = [
  '.......',
  '..ooo..',
  '.owwbo.',
  '.owbbo.',
  '.obbbo.',
  '..ooo..',
  '.......',
];

const ENEMY_A = [
  '..ooo..',
  '.oyyyo.',
  'oyyfffo',
  'oyfffyo',
  'oyyfyyo',
  '.oyyyo.',
  '..ooo..',
];
const ENEMY_B = [
  '.......',
  '..ooo..',
  '.oyfyo.',
  '.offfo.',
  '.oyyyo.',
  '..ooo..',
  '.......',
];

const KNIFE = [
  '..........oo.',
  '.......oooww.',
  'hhhoooowwwwo.',
  'hhhdoeeeeeoo.',
  '.......ooooo.',
  '..........oo.',
];

const BALL_A = [
  '...oooo...',
  '..ommmmo..',
  '.ommwwmmo.',
  'ommwwmmmdo',
  'ommwmmmmdo',
  'ommmmmmddo',
  'ommmmmdddo',
  '.omdddddo.',
  '..oddddo..',
  '...oooo...',
];
const BALL_B = BALL_A.map((row) => row.replace(/w/g, 'm')).map((row, y) =>
  y === 6 ? row.replace('mmmmm', 'mmwwm') : row,
);

const GEM_SMALL_A = [
  '...o...',
  '..olo..',
  '.ollmo.',
  'olmmmdo',
  '.ommdo.',
  '..odo..',
  '...o...',
];
const GEM_SMALL_B = GEM_SMALL_A.map((row, y) => (y === 2 ? row.replace('ll', 'ww') : row));

const GEM_BIG_A = [
  '....oo....',
  '...ollo...',
  '..ollllo..',
  '.ollmmmmo.',
  'ollmmmmmdo',
  'olmmmmmddo',
  '.ommmmddo.',
  '..ommddo..',
  '...oddo...',
  '....oo....',
];
const GEM_BIG_B = GEM_BIG_A.map((row, y) => {
  if (y === 2) return row.replace('llll', 'lwwl');
  if (y === 3) return row.replace('ll', 'ww');
  return row;
});

export const EFFECT_CLIPS = {
  'shot.orb': {
    palette: { o: '#1d4a66', b: '#9ad8ff', w: '#f2fbff' },
    frames: [ORB_A, ORB_B],
    fps: 10,
    anchor: CENTER,
  },
  'shot.enemy': {
    palette: { o: '#4a2205', y: '#ff9f43', f: '#ffe27a' },
    frames: [ENEMY_A, ENEMY_B],
    fps: 10,
    anchor: CENTER,
  },
  'shot.knife': {
    palette: { o: '#3b4a5c', w: '#ffffff', e: '#e6f1ff', h: '#8a5a34', d: '#5a3a1e' },
    frames: [KNIFE],
    anchor: CENTER,
  },
  'orbit.ball': {
    palette: { o: '#0f3d30', m: '#5dcaa5', d: '#2f8a6d', w: '#e1f5ee' },
    frames: [BALL_A, BALL_B],
    fps: 6,
    anchor: CENTER,
  },
  'gem.small': {
    palette: { o: '#1d1240', l: '#e4dcff', m: '#a78bfa', d: '#6d54c4', w: '#ffffff' },
    frames: [GEM_SMALL_A, GEM_SMALL_B],
    fps: 3,
    anchor: CENTER,
  },
  'gem.big': {
    palette: { o: '#0f3d30', l: '#d5f5ea', m: '#5dcaa5', d: '#2f8a6d', w: '#ffffff' },
    frames: [GEM_BIG_A, GEM_BIG_B],
    fps: 3,
    anchor: CENTER,
  },
};
