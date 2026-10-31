/**
 * Четвёртая локация: ледник. Пол скользкий — герой разгоняется и тормозит
 * не сразу, а метель сужает обзор: дальше круга вокруг героя всё тонет в белом.
 */
export const GLACIER = {
  id: 'glacier',
  title: 'Ледник',
  /** Секунд до босса: восемь минут. */
  duration: 480,
  world: { width: 3200, height: 2000 },
  colors: {
    outside: '#070b12',
    border: '#5a86ab',
  },
  /** Босс, который выходит, когда истекает duration. */
  boss: 'iceworm',
  enemies: ['wolf', 'grunt', 'swarm', 'shooter', 'tank'],
  /** Лёд: grip — как быстро скорость догоняет желаемую (1/с); у обычной земли сцепление мгновенное. */
  surface: { grip: 2.4 },
  /** Метель: обзор сжимается до radius и «дышит» порывами на gust каждые period секунд. */
  blizzard: {
    radius: 330,
    gust: 90,
    period: 9,
    fog: '#a9c4de',
    fogAlpha: 0.9,
    flakes: 160,
    wind: { x: -260, y: 110 },
  },
  obstacles: {
    count: 60,
    seed: 38,
    clearRadius: 200,
    gap: 70,
    kinds: [
      { clip: 'obstacle.icerock', radius: 22, scale: 4, weight: 3 },
      { clip: 'obstacle.snowpine', radius: 16, scale: 5, weight: 3 },
    ],
  },
  ground: {
    palette: { a: '#2b3d52', b: '#31465d', c: '#26364a', d: '#3a526b' },
    decorChance: 0.14,
    decor: [
      { clip: 'decor.drift', weight: 5 },
      { clip: 'decor.crystal', weight: 2 },
      { clip: 'decor.bone', weight: 1 },
    ],
  },
};
