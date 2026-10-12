/**
 * Герой в трёх ракурсах: лицом к камере (down), спиной (up) и сбоку (side).
 * Сбоку нарисован только взгляд вправо — влево игра отражает его зеркально.
 */
const PALETTE = {
  o: '#0b0e14',
  g: '#7ee787',
  d: '#4fae5a',
  s: '#f2d3b0',
  w: '#ffffff',
  b: '#5a3a22',
};

/** Та же картинка, перекрашенная в красное, — кадр получения урона. */
const HURT_PALETTE = {
  ...PALETTE,
  g: '#ff7b72',
  d: '#c93c3c',
  s: '#ffd6d0',
};

/** Голова и туловище: меняются только глаза (строка 4) и ноги (дописываются). */
const BODIES = {
  down: [
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
  ],
  up: [
    '..oooooo..',
    '.oggggggo.',
    'oggggggggo',
    'oggggggggo',
    'oggggggggo',
    'oggggggggo',
    '.oddddddo.',
    'oddggggddo',
    'oddggggddo',
    '.oddddddo.',
    '..obbbbo..',
  ],
  side: [
    '..oooooo..',
    '.oggggggo.',
    'oggggggggo',
    'oggggsssso',
    'oggggsswso',
    'oggggsssso',
    '.oddddddo.',
    '.oddggddo.',
    '.oddggddo.',
    '.oddddddo.',
    '..obbbbo..',
  ],
};

/** Строка глаз с закрытыми глазами — для моргания; у вида со спины глаз нет. */
const BLINK_ROW = {
  down: 'osssssssso',
  up: null,
  side: 'oggggsssso',
};

const STAND_LEGS = '..oo..oo..';
const WALK_LEGS = ['.ob....bo.', STAND_LEGS, '..ob.oo...', '...oo.bo..'];

function variant(view, legs, eyes = null) {
  const rows = [...BODIES[view]];
  if (eyes) rows[4] = eyes;
  rows.push(legs);
  return rows;
}

function buildViewClips(view) {
  const blink = BLINK_ROW[view];
  const idleFrames = [variant(view, STAND_LEGS)];
  if (blink) idleFrames.push(variant(view, STAND_LEGS, blink));

  return {
    [`hero.idle.${view}`]: {
      palette: PALETTE,
      frames: idleFrames,
      // Моргает редко: открытый кадр держится четыре такта из пяти.
      order: blink ? [0, 0, 0, 0, 1] : [0],
      fps: blink ? 5 : 0,
    },
    [`hero.walk.${view}`]: {
      palette: PALETTE,
      frames: WALK_LEGS.map((legs) => variant(view, legs)),
      fps: 8,
    },
    [`hero.hurt.${view}`]: {
      palette: HURT_PALETTE,
      frames: [variant(view, STAND_LEGS)],
      fps: 0,
    },
  };
}

export const HERO_VIEWS = ['down', 'up', 'side'];

export const HERO_CLIPS = Object.assign({}, ...HERO_VIEWS.map(buildViewClips));
