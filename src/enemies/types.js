/**
 * Типы врагов. Класс Enemy один на всех — различаются они только данными.
 *
 *   from            — с какой секунды забега тип начинает появляться;
 *   weight          — относительный шанс выпасть при спавне;
 *   pack            — сколько появляется разом, кучкой;
 *   mass            — кто кого расталкивает: тяжёлый почти не сдвигается;
 *   knockbackResist — доля отброса, которую враг гасит;
 *   wobble          — насколько петляет на бегу, радиан;
 *   showHealthBar   — рисовать ли полоску здоровья над головой.
 */
export const ENEMY_TYPES = {
  grunt: {
    id: 'grunt',
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
};

export const ENEMY_TYPE_LIST = Object.values(ENEMY_TYPES);
