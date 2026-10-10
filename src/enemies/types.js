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
 *   ranged          — если задано, враг стреляет: держится на дистанции
 *                     keepDistance, раз в cooldown секунд пускает снаряд
 *                     (damage, speed), перед выстрелом windup секунд целится.
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
    outline: '#2a100d',
    shape: 'diamond',
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
    outline: '#3a2a06',
    shape: 'dart',
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
    outline: '#2c0f38',
    shape: 'tank',
    weight: 1,
    pack: 1,
    mass: 4,
    knockbackResist: 0.85,
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
    outline: '#4a2205',
    shape: 'shooter',
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
};

export const ENEMY_TYPE_LIST = Object.values(ENEMY_TYPES);
