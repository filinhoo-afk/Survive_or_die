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
    projectile: '#9ad8ff',
    projectileTrail: 'rgba(154, 216, 255, 0.3)',
    hpBar: '#7ee787',
    hpBarLow: '#f2c14e',
    hpBarCritical: '#f2786a',
    hpBarBack: '#20283a',
    hud: '#6e7681',
  },
  player: {
    radius: 14,
    speed: 230, // пикселей в секунду
    maxHp: 100,
    /** Секунд неуязвимости после удара: без неё толпа снимает всё за миг. */
    invulnerability: 0.8,
    /** Период мигания во время неуязвимости, секунды. */
    blinkPeriod: 0.12,
  },
  enemy: {
    radius: 13,
    /** Медленнее игрока: убежать можно, отдохнуть — нет. */
    speed: 105,
    color: '#f2786a',
    outline: '#2a100d',
    damage: 12,
  },
  weapon: {
    /** Секунд между выстрелами. */
    cooldown: 0.55,
    /** Дальше этого расстояния цель не берётся. */
    range: 430,
    damage: 20,
  },
  projectile: {
    radius: 5,
    speed: 540,
    /** Секунд жизни, если ни во что не попал. */
    lifetime: 1.4,
  },
  spawner: {
    /** Секунд между волнами. */
    interval: 5,
    /** Врагов в одной волне. */
    waveSize: 3,
    /** Потолок, пока нет способа убивать врагов. */
    maxEnemies: 60,
    /** Насколько за краем экрана появляется враг. */
    margin: 80,
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
