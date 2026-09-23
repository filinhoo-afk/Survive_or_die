/** Глобальные настройки игры. Правим здесь, а не по всему коду. */
export const CONFIG = {
  width: 960,
  height: 540,
  /** Игровой мир заметно больше экрана — по нему и ездит камера. */
  world: {
    width: 2880,
    height: 1800,
  },
  colors: {
    background: '#11151f',
    outside: '#080a10',
    grid: '#1a2030',
    gridMajor: '#232c42',
    border: '#31405e',
    player: '#7ee787',
    playerOutline: '#0b0e14',
    enemy: '#f2786a',
    hud: '#6e7681',
  },
  player: {
    radius: 14,
    speed: 230, // пикселей в секунду
  },
  enemy: {
    radius: 13,
    /** Медленнее игрока: убежать можно, отдохнуть — нет. */
    speed: 105,
    color: '#f2786a',
    outline: '#2a100d',
  },
  camera: {
    /** Чем больше, тем жёстче камера держится за игрока. */
    smoothing: 7,
  },
  grid: {
    size: 64,
    /** Каждая N-я линия рисуется ярче — так виден масштаб мира. */
    majorEvery: 4,
  },
};
