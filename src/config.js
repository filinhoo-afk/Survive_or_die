import { BALANCE } from './balance/index.js';

/**
 * Глобальные настройки игры: экран, цвета, эффекты, связь. Игровые числа
 * лежат в таблицах src/balance и подставляются сюда.
 */
export const CONFIG = {
  width: 960,
  height: 540,
  colors: {
    background: '#11151f',
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
    damageText: '#f0f3f9',
    critText: '#ffd34e',
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
    hudText: '#f0f3f9',
    hudDim: '#9aa6bd',
    hudShadow: '#05060c',
    hudPanel: 'rgba(8, 10, 16, 0.6)',
    hudBevel: '#4a5b82',
  },
  player: {
    /** Радиус, скорость, здоровье и неуязвимость после удара — из таблицы. */
    ...BALANCE.player.hero,
    /** Период мигания во время неуязвимости, секунды. */
    blinkPeriod: 0.12,
    /** Сколько секунд после удара герой показан красным. */
    hurtTime: 0.25,
    /** Во сколько раз увеличен пиксель спрайта героя. */
    spriteScale: 3,
  },
  /** Общее для всех врагов. Свои характеристики — в src/balance/enemies.json. */
  enemy: {
    /** На сколько пикселей отбрасывает попадание. */
    knockback: BALANCE.enemies.knockback,
    /** Секунд белой вспышки после попадания. */
    hitFlash: 0.08,
    /** Самый крупный враг — по нему спавнер держит отступ от края мира. */
    maxRadius: 24,
  },
  /** Уровни и магнит кристаллов. */
  xp: BALANCE.player.xp,
  gem: {
    radius: 5,
  },
  effects: {
    /** Секунд живёт кольцо на месте смерти врага. */
    deathLife: 0.28,
    deathRadius: 20,
    levelUpLife: 0.7,
    /** Цифры урона: жизнь, подъём в пикселях и потолок на экране (аура бьёт часто). */
    damageText: { life: 0.7, rise: 34, max: 60 },
    levelUpRadius: 90,
    /** Осколки при смерти врага: количество на единицу размера, скорость и жизнь. */
    particles: {
      perScale: 7,
      speedMin: 60,
      speedMax: 220,
      lifeMin: 0.3,
      lifeMax: 0.6,
      size: 3,
      /** Потолок осколков на экране — защита от лавины при зачистке толпы. */
      max: 400,
    },
  },
  /** Тряска камеры: «травма» от 0 до 1, смещение растёт как её квадрат. */
  shake: {
    maxOffset: 14,
    /** Сколько травмы уходит за секунду. */
    decay: 2.4,
    enemyDeath: 0.06,
    crit: 0.05,
    playerHit: 0.45,
    playerDeath: 0.9,
  },
  /** Критические удары: шанс и множитель урона. */
  crit: BALANCE.player.crit,
  arsenal: {
    /** Больше оружия одновременно носить нельзя. */
    maxWeapons: BALANCE.player.maxWeapons,
  },
  /** Значения по умолчанию для снарядов; каждое оружие задаёт свои. */
  projectile: BALANCE.weapons.projectile,
  /** Значения по умолчанию для снарядов врагов; стрелок может переопределить. */
  enemyShot: BALANCE.enemies.shot,
  /** Волны врагов и кривая сложности. */
  spawner: BALANCE.spawner,
  camera: {
    /** Чем больше, тем жёстче камера держится за игрока. */
    smoothing: 7,
  },
  /** Освещение: насколько темна сцена и какие источники света светят. */
  shadows: {
    color: 'rgba(5, 6, 12, 0.38)',
    /** Тень — овал: ширина и высота в долях радиуса тела. */
    widthK: 1.0,
    heightK: 0.38,
    /** Кристаллы и снаряды отбрасывают тень поменьше. */
    gemRadius: 7,
  },
  lighting: {
    /** Непрозрачность тьмы вне света, 0..1. */
    ambient: 0.72,
    /** Яркость цветного свечения источников. */
    glowAlpha: 0.35,
    player: { radius: 280, color: '#ffe2a8' },
    projectile: { radius: 90, color: '#9ad8ff' },
    enemyShot: { radius: 80, color: '#ff9f43' },
    gem: { radius: 50, color: '#a78bfa' },
  },
  ground: {
    /** Размер пикселя земли — как у спрайтов, чтобы пиксели были одного размера. */
    pixelScale: 3,
  },
  /**
   * Бэкенд рекордов (Supabase). Ключ публичный (publishable / anon): он и так
   * виден в браузере, данные защищают правила доступа в базе. Секретный ключ
   * (secret / service_role) сюда класть нельзя. Пустые значения — игра офлайн.
   */
  online: {
    url: 'https://tsjlqbcqxvbtguamuslx.supabase.co',
    key: 'sb_publishable_GFwweJhyPE_27l_RfthbRw__p_62TRo',
    /** Сколько миллисекунд ждать ответа, прежде чем считать, что связи нет. */
    timeout: 6000,
  },
};
