/**
 * Типы врагов. Класс Enemy один на всех — различаются они только данными.
 *
 *   title           — имя для экрана итогов;
 *   from            — с какой секунды забега тип начинает появляться;
 *   weight          — относительный шанс выпасть при спавне;
 *   pack            — сколько появляется разом, кучкой;
 *   mass            — кто кого расталкивает: тяжёлый почти не сдвигается;
 *   knockbackResist — доля отброса, которую враг гасит;
 *   wobble          — насколько петляет на бегу, радиан;
 *   showHealthBar   — рисовать ли полоску здоровья над головой;
 *   spriteScale     — во сколько раз увеличить пиксельный спрайт (art/enemies.js);
 *   ranged          — если задано, враг стреляет: держится на дистанции
 *                     keepDistance, раз в cooldown секунд пускает снаряд
 *                     (damage, speed), перед выстрелом windup секунд целится;
 *   ghost           — призрак: проходит сквозь препятствия и рисуется полупрозрачным;
 *   boss            — босс: в обычный спавн не попадает, появляется по
 *                     таймеру локации (см. entities/boss.js).
 */
export const ENEMY_TYPES = {
  grunt: {
    id: 'grunt',
    title: 'Рядовой',
    from: 0,
    radius: 13,
    /** Медленнее игрока: убежать можно, отдохнуть — нет. */
    speed: 105,
    hp: 40,
    damage: 12,
    xp: 1,
    color: '#f2786a',
    spriteScale: 3,
    weight: 6,
    pack: 1,
    mass: 1,
    knockbackResist: 0,
    wobble: 0,
    showHealthBar: false,
  },

  /** Рой: мелкие, быстрые, хрупкие, приходят стаей и петляют. */
  swarm: {
    id: 'swarm',
    title: 'Рой',
    from: 20,
    radius: 8,
    speed: 175,
    hp: 8,
    damage: 5,
    xp: 1,
    color: '#f2c14e',
    spriteScale: 2,
    weight: 2,
    pack: 5,
    mass: 0.5,
    knockbackResist: 0,
    wobble: 0.5,
    showHealthBar: false,
  },

  /**
   * Танк: медленный, толстый, бьёт больно. Почти не отбрасывается
   * и расталкивает мелочь — за ним толпа идёт как за щитом.
   */
  tank: {
    id: 'tank',
    title: 'Танк',
    from: 60,
    radius: 24,
    speed: 55,
    hp: 160,
    damage: 25,
    xp: 5,
    color: '#b46ad0',
    spriteScale: 3,
    weight: 1,
    pack: 1,
    mass: 4,
    knockbackResist: 0.85,
    wobble: 0,
    showHealthBar: true,
  },

  /** Волк: быстрее игрока, кусает больно, но умирает с пары попаданий. */
  wolf: {
    id: 'wolf',
    title: 'Волк',
    from: 0,
    radius: 12,
    speed: 150,
    hp: 30,
    damage: 10,
    xp: 2,
    color: '#8a919e',
    spriteScale: 3,
    weight: 5,
    pack: 3,
    mass: 0.8,
    knockbackResist: 0,
    wobble: 0.25,
    showHealthBar: false,
  },

  /** Энт: лесной великан, медленный и очень живучий. */
  treant: {
    id: 'treant',
    title: 'Энт',
    from: 75,
    radius: 22,
    speed: 48,
    hp: 220,
    damage: 28,
    xp: 6,
    color: '#3f7a3a',
    spriteScale: 3,
    weight: 1,
    pack: 1,
    mass: 4,
    knockbackResist: 0.9,
    wobble: 0,
    showHealthBar: true,
  },

  /**
   * Стрелок: не лезет в ближний бой, а держится на расстоянии и
   * обстреливает. Хрупкий — награда за то, что до него надо добраться.
   */
  shooter: {
    id: 'shooter',
    title: 'Стрелок',
    from: 40,
    radius: 12,
    speed: 85,
    hp: 30,
    damage: 8,
    xp: 3,
    color: '#ff9f43',
    spriteScale: 3,
    weight: 1.5,
    pack: 1,
    mass: 1,
    knockbackResist: 0,
    wobble: 0,
    showHealthBar: false,
    ranged: {
      keepDistance: 260,
      cooldown: 2.2,
      windup: 0.45,
      damage: 10,
      speed: 240,
    },
  },

  /** Призрак: проходит сквозь стены и камни, поэтому в проходах не застревает. */
  ghost: {
    id: 'ghost',
    title: 'Призрак',
    from: 0,
    radius: 12,
    speed: 100,
    hp: 26,
    damage: 9,
    xp: 2,
    color: '#a9c0ee',
    spriteScale: 3,
    weight: 5,
    pack: 2,
    mass: 0.6,
    knockbackResist: 0,
    wobble: 0.35,
    showHealthBar: false,
    ghost: true,
  },

  /** Привидение: старший призрак — крупнее, живучее, тоже сквозь стены. */
  wraith: {
    id: 'wraith',
    title: 'Привидение',
    from: 70,
    radius: 18,
    speed: 80,
    hp: 110,
    damage: 18,
    xp: 5,
    color: '#c49af0',
    spriteScale: 4,
    weight: 1.5,
    pack: 1,
    mass: 2,
    knockbackResist: 0.5,
    wobble: 0.2,
    showHealthBar: true,
    ghost: true,
  },

  /** Босс леса: огромный, медленный, бьёт залпами снарядов. */
  guardian: {
    id: 'guardian',
    title: 'Лесной страж',
    from: Infinity,
    radius: 48,
    speed: 55,
    hp: 2600,
    damage: 35,
    xp: 60,
    color: '#2f8a4a',
    spriteScale: 6,
    weight: 0,
    pack: 1,
    mass: 30,
    knockbackResist: 0.98,
    wobble: 0,
    showHealthBar: false,
    boss: true,
  },

  /** Босс руин: держится на расстоянии, призывает призраков и телепортируется. */
  necromancer: {
    id: 'necromancer',
    title: 'Некромант',
    from: Infinity,
    radius: 34,
    speed: 70,
    hp: 3000,
    damage: 30,
    xp: 80,
    color: '#8658c4',
    barColor: '#9a5fe0',
    spriteScale: 5,
    weight: 0,
    pack: 1,
    mass: 30,
    knockbackResist: 0.98,
    wobble: 0,
    showHealthBar: false,
    boss: true,
  },

  /** Босс ледника: уходит под лёд и бьёт снизу там, где стоял игрок. */
  iceworm: {
    id: 'iceworm',
    title: 'Ледяной червь',
    from: Infinity,
    radius: 44,
    speed: 50,
    hp: 3400,
    damage: 30,
    xp: 100,
    color: '#6fb6e6',
    barColor: '#6fb6e6',
    spriteScale: 6,
    weight: 0,
    pack: 1,
    mass: 30,
    knockbackResist: 0.98,
    wobble: 0,
    showHealthBar: false,
    boss: true,
  },
};

export const ENEMY_TYPE_LIST = Object.values(ENEMY_TYPES);
