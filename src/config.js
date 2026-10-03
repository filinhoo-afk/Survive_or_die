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
    enemyFlash: '#ffffff',
    gem: '#a78bfa',
    gemLight: '#e4dcff',
    gemBig: '#5dcaa5',
    gemBigLight: '#d5f5ea',
    gemOutline: '#1d1240',
    xpBar: '#a78bfa',
    levelUp: '#7ee787',
    projectile: '#9ad8ff',
    projectileTrail: 'rgba(154, 216, 255, 0.3)',
    enemyShot: '#ff9f43',
    enemyShotTrail: 'rgba(255, 159, 67, 0.3)',
    enemyShotOutline: '#4a2205',
    knife: '#e6f1ff',
    knifeEdge: '#9fb3c8',
    knifeHandle: '#8a5a34',
    orbit: '#5dcaa5',
    orbitTrack: 'rgba(93, 202, 165, 0.22)',
    aura: '#7ee787',
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
  /** Общее для всех врагов. Свои характеристики — в src/enemies/types.js. */
  enemy: {
    /** На сколько пикселей отбрасывает попадание. */
    knockback: 9,
    /** Секунд белой вспышки после попадания. */
    hitFlash: 0.08,
    /** Самый крупный враг — по нему спавнер держит отступ от края мира. */
    maxRadius: 24,
  },
  xp: {
    /** Опыта до второго уровня; каждый следующий дороже на step. */
    base: 5,
    step: 5,
    /** С этого расстояния кристалл начинает лететь к игроку. */
    magnetRadius: 110,
    /** Ускорение притянутого кристалла, пикселей в секунду за секунду. */
    pullAcceleration: 1400,
    maxPullSpeed: 900,
  },
  gem: {
    radius: 5,
  },
  effects: {
    /** Секунд живёт кольцо на месте смерти врага. */
    deathLife: 0.28,
    deathRadius: 20,
    levelUpLife: 0.7,
    levelUpRadius: 90,
  },
  arsenal: {
    /** Больше оружия одновременно носить нельзя. */
    maxWeapons: 6,
  },
  projectile: {
    /** Значения по умолчанию; каждое оружие задаёт свои. */
    radius: 5,
    speed: 540,
    /** Секунд жизни, если ни во что не попал. */
    lifetime: 1.4,
    damage: 20,
  },
  /** Значения по умолчанию для снарядов врагов; стрелок может переопределить. */
  enemyShot: {
    radius: 6,
    /** Медленнее снаряда игрока и заметно медленнее самого игрока: уворот возможен. */
    speed: 240,
    lifetime: 3,
    damage: 10,
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
