import { WEAPONS } from '../weapons/index.js';

/**
 * Пассивные улучшения игрока. Каждое описано через get / next / set:
 * одна запись и применяет улучшение, и показывает «было → станет».
 */
export const PASSIVES = [
  {
    id: 'speed',
    title: 'Лёгкие ботинки',
    text: 'Скорость бега +10%',
    color: '#7ee787',
    icon: 'speed',
    maxRank: 5,
    get: (player) => player.speed,
    next: (value) => value * 1.1,
    set: (player, value) => {
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
    get: (player) => player.maxHp,
    next: (value) => value + 20,
    set: (player, value) => {
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
    get: (player) => player.magnetRadius,
    next: (value) => value * 1.35,
    set: (player, value) => {
      player.magnetRadius = value;
    },
    format: (value) => `${Math.round(value)}`,
  },
];

/** Как показывать на карточке характеристику оружия. */
const STAT_FORMAT = {
  damage: (v) => `${Math.round(v)}`,
  cooldown: (v) => `${(1 / v).toFixed(1)}/с`,
  count: (v) => `${v} шт`,
  pierce: (v) => `${v}`,
};

/**
 * Собирает карточки для экрана выбора из трёх источников:
 * новые оружия, уровни уже взятых оружий и пассивные улучшения.
 *
 * Карточка — готовый объект с текстом и функцией apply, поэтому экрану
 * выбора всё равно, что именно он предлагает.
 */
export class UpgradeState {
  constructor(arsenal, player, { passives = PASSIVES, weapons = WEAPONS } = {}) {
    this.arsenal = arsenal;
    this.player = player;
    this.passives = passives;
    this.weapons = weapons;
    this.ranks = new Map();
  }

  rank(id) {
    return this.ranks.get(id) ?? 0;
  }

  /** Все карточки, которые сейчас имеет смысл предложить. */
  candidates() {
    const cards = [];

    for (const weapon of this.arsenal.weapons) {
      if (weapon.canLevelUp) cards.push(this.weaponLevelCard(weapon));
    }

    if (this.arsenal.hasFreeSlot) {
      for (const definition of this.weapons) {
        if (!this.arsenal.has(definition.id)) cards.push(this.newWeaponCard(definition));
      }
    }

    for (const passive of this.passives) {
      if (this.rank(passive.id) < passive.maxRank) cards.push(this.passiveCard(passive));
    }

    return cards;
  }

  /** Случайные разные карточки; когда предлагать нечего — пустой список. */
  roll(count, random = Math.random) {
    const pool = this.candidates();

    // Частичная перетасовка Фишера — Йетса: нужны только первые count.
    for (let i = 0; i < Math.min(count, pool.length); i += 1) {
      const j = i + Math.floor(random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0, count);
  }

  newWeaponCard(definition) {
    return {
      id: `new:${definition.id}`,
      title: definition.title,
      text: definition.description,
      color: definition.color,
      icon: definition.icon,
      badge: 'новое оружие',
      preview: null,
      apply: () => this.arsenal.add(definition.id),
    };
  }

  weaponLevelCard(weapon) {
    const { definition, nextLevel } = weapon;
    const format = STAT_FORMAT[nextLevel.show];
    const after = weapon.previewNextStats();

    return {
      id: `level:${weapon.id}`,
      title: definition.title,
      text: nextLevel.text,
      color: definition.color,
      icon: definition.icon,
      badge: `уровень ${weapon.level} → ${weapon.level + 1}`,
      preview: [format(weapon.stats[nextLevel.show]), format(after[nextLevel.show])],
      apply: () => weapon.levelUp(),
    };
  }

  passiveCard(passive) {
    const rank = this.rank(passive.id);
    const value = passive.get(this.player);

    return {
      id: `passive:${passive.id}`,
      title: passive.title,
      text: passive.text,
      color: passive.color,
      icon: passive.icon,
      badge: rank === 0 ? 'новое' : `ранг ${rank} → ${rank + 1}`,
      preview: [passive.format(value), passive.format(passive.next(value))],
      apply: () => {
        passive.set(this.player, passive.next(passive.get(this.player)));
        this.ranks.set(passive.id, rank + 1);
      },
    };
  }

  /** Короткая сводка для HUD: «Пушка 3 · Нож 1 · Магнит 2». */
  summary() {
    const weapons = this.arsenal.weapons.map((w) => `${w.definition.title} ${w.level}`);
    const passives = this.passives
      .filter((passive) => this.rank(passive.id) > 0)
      .map((passive) => `${passive.title} ${this.rank(passive.id)}`);
    return [...weapons, ...passives].join(' · ');
  }
}
