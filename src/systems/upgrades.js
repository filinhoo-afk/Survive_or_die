/**
 * Улучшения, которые предлагаются при повышении уровня.
 *
 * Каждое описано через get / next / set: так одна и та же запись
 * и применяет улучшение, и показывает на карточке «было → станет».
 */
export const UPGRADES = [
  {
    id: 'damage',
    title: 'Калибр',
    text: 'Урон пушки +25%',
    color: '#9ad8ff',
    icon: 'bullet',
    maxRank: 5,
    get: ({ cannon }) => cannon.damage,
    next: (value) => value * 1.25,
    set: ({ cannon }, value) => {
      cannon.damage = value;
    },
    format: (value) => `${Math.round(value)}`,
  },
  {
    id: 'rate',
    title: 'Скорострельность',
    text: 'Пушка стреляет на 12% чаще',
    color: '#f2c14e',
    icon: 'rate',
    maxRank: 5,
    get: ({ cannon }) => cannon.cooldown,
    next: (value) => value * 0.88,
    set: ({ cannon }, value) => {
      cannon.cooldown = value;
    },
    format: (value) => `${(1 / value).toFixed(1)}/с`,
  },
  {
    id: 'speed',
    title: 'Лёгкие ботинки',
    text: 'Скорость бега +10%',
    color: '#7ee787',
    icon: 'speed',
    maxRank: 5,
    get: ({ player }) => player.speed,
    next: (value) => value * 1.1,
    set: ({ player }, value) => {
      player.speed = value;
    },
    format: (value) => `${Math.round(value)}`,
  },
  {
    id: 'vitality',
    title: 'Крепкое сердце',
    text: 'Здоровье +20 и сразу лечит на 20',
    color: '#f2786a',
    icon: 'heart',
    maxRank: 5,
    get: ({ player }) => player.maxHp,
    next: (value) => value + 20,
    set: ({ player }, value) => {
      player.maxHp = value;
      player.hp = Math.min(value, player.hp + 20);
    },
    format: (value) => `${Math.round(value)}`,
  },
  {
    id: 'magnet',
    title: 'Магнит',
    text: 'Кристаллы тянутся на 35% дальше',
    color: '#a78bfa',
    icon: 'magnet',
    maxRank: 5,
    get: ({ player }) => player.magnetRadius,
    next: (value) => value * 1.35,
    set: ({ player }, value) => {
      player.magnetRadius = value;
    },
    format: (value) => `${Math.round(value)}`,
  },
];

/** Что уже взято и на каком ранге. */
export class UpgradeState {
  constructor(pool = UPGRADES) {
    this.pool = pool;
    this.ranks = new Map();
  }

  rank(id) {
    return this.ranks.get(id) ?? 0;
  }

  /** Улучшения, которые ещё не упёрлись в максимальный ранг. */
  available() {
    return this.pool.filter((upgrade) => this.rank(upgrade.id) < upgrade.maxRank);
  }

  /**
   * Случайные разные улучшения для карточек.
   * Когда всё прокачано до упора, вернёт меньше, вплоть до пустого списка.
   */
  roll(count, random = Math.random) {
    const pool = this.available();

    // Частичная перетасовка Фишера — Йетса: нужны только первые count.
    for (let i = 0; i < Math.min(count, pool.length); i += 1) {
      const j = i + Math.floor(random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0, count);
  }

  /** Строка «было → станет» для карточки. */
  preview(upgrade, targets) {
    const value = upgrade.get(targets);
    return [upgrade.format(value), upgrade.format(upgrade.next(value))];
  }

  take(upgrade, targets) {
    upgrade.set(targets, upgrade.next(upgrade.get(targets)));
    this.ranks.set(upgrade.id, this.rank(upgrade.id) + 1);
  }

  /** Короткая сводка для HUD: «Калибр 2 · Магнит 1». */
  summary() {
    return this.pool
      .filter((upgrade) => this.rank(upgrade.id) > 0)
      .map((upgrade) => `${upgrade.title} ${this.rank(upgrade.id)}`)
      .join(' · ');
  }
}
