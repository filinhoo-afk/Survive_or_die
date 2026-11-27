import { BALANCE } from '../balance/index.js';
import { localize, t } from '../i18n/index.js';
import { EVOLUTIONS, WEAPONS } from '../weapons/index.js';
import { random as rand } from './rng.js';

/**
 * Пассивные улучшения игрока. Каждое описано через get / next / set:
 * одна запись и применяет улучшение, и показывает «было → станет».
 * Потолок ранга и прибавка за ранг — в src/balance/upgrades.json.
 */
const PASSIVE_LIST = [
  {
    id: 'speed',
    color: '#7ee787',
    icon: 'speed',
    get: (player) => player.speed,
    set: (player, value) => {
      player.speed = value;
    },
    format: (value) => `${Math.round(value)}`,
  },
  {
    id: 'vitality',
    color: '#f2786a',
    icon: 'heart',
    get: (player) => player.maxHp,
    set: (player, value) => {
      // Прибавка к запасу здоровья сразу и лечит на столько же.
      const gain = value - player.maxHp;
      player.maxHp = value;
      player.hp = Math.min(value, player.hp + gain);
    },
    format: (value) => `${Math.round(value)}`,
  },
  {
    id: 'might',
    color: '#f0997b',
    icon: 'might',
    get: (player) => player.mods.damage,
    set: (player, value) => {
      player.mods.damage = value;
    },
    format: (value) => `+${Math.round((value - 1) * 100)}%`,
  },
  {
    id: 'haste',
    color: '#f2c14e',
    icon: 'rate',
    get: (player) => player.mods.cooldown,
    set: (player, value) => {
      player.mods.cooldown = value;
    },
    format: (value) => `−${Math.round((1 - value) * 100)}%`,
  },
  {
    id: 'area',
    color: '#5dcaa5',
    icon: 'area',
    get: (player) => player.mods.area,
    set: (player, value) => {
      player.mods.area = value;
    },
    format: (value) => `+${Math.round((value - 1) * 100)}%`,
  },
  {
    id: 'regen',
    color: '#97c459',
    icon: 'regen',
    get: (player) => player.regen,
    set: (player, value) => {
      player.regen = value;
    },
    format: (value) => t('fmt.perSecond', { value: value.toFixed(1) }),
  },
  {
    id: 'armor',
    color: '#b4b2a9',
    icon: 'armor',
    get: (player) => player.armor,
    set: (player, value) => {
      player.armor = value;
    },
    format: (value) => `${value}`,
  },
  {
    id: 'magnet',
    color: '#a78bfa',
    icon: 'magnet',
    get: (player) => player.magnetRadius,
    set: (player, value) => {
      player.magnetRadius = value;
    },
    format: (value) => `${Math.round(value)}`,
  },
];

export const PASSIVES = PASSIVE_LIST.map((passive) => {
  const { maxRank, mul, add } = BALANCE.upgrades.passives[passive.id];
  return { ...passive, maxRank, next: (value) => (mul === undefined ? value + add : value * mul) };
});

for (const passive of PASSIVES) localize(passive, `passive.${passive.id}`, ['title', 'text']);

/** Относительные шансы карточек попасть в выбор. */
const CARD_WEIGHT = BALANCE.upgrades.cardWeight;

/** Как показывать на карточке характеристику оружия. */
const STAT_FORMAT = {
  damage: (v) => `${Math.round(v)}`,
  cooldown: (v) => t('fmt.perSecond', { value: (1 / v).toFixed(1) }),
  count: (v) => t('fmt.count', { value: v }),
  pierce: (v) => `${v}`,
  radius: (v) => `${Math.round(v)}`,
};

/**
 * Собирает карточки для экрана выбора из трёх источников:
 * новые оружия, уровни уже взятых оружий и пассивные улучшения.
 *
 * Карточка — готовый объект с текстом и функцией apply, поэтому экрану
 * выбора всё равно, что именно он предлагает.
 */
export class UpgradeState {
  constructor(
    arsenal,
    player,
    { passives = PASSIVES, weapons = WEAPONS, evolutions = EVOLUTIONS } = {},
  ) {
    this.arsenal = arsenal;
    this.player = player;
    this.passives = passives;
    this.weapons = weapons;
    this.evolutions = evolutions;
    this.ranks = new Map();
  }

  rank(id) {
    return this.ranks.get(id) ?? 0;
  }

  /** Эволюция, в которую превращается оружие с таким id, или undefined. */
  evolutionOf(id) {
    return this.evolutions.find((evolution) => evolution.evolvesFrom === id);
  }

  /**
   * Карточки эволюций, которые уже можно взять: оружие прокачано
   * до упора, а нужная пассивка есть хотя бы первого ранга.
   */
  readyEvolutions() {
    const cards = [];
    for (const weapon of this.arsenal.weapons) {
      const evolution = this.evolutionOf(weapon.id);
      if (!evolution || weapon.canLevelUp || this.rank(evolution.requires) === 0) continue;
      cards.push(this.evolutionCard(weapon, evolution));
    }
    return cards;
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

  /**
   * Случайные разные карточки; когда предлагать нечего — пустой список.
   *
   * Выбор взвешенный: пассивок восемь, а оружейных карточек меньше,
   * и при равных шансах оружие почти перестало бы выпадать.
   *
   * Готовая эволюция в выбор попадает всегда: игрок шёл к ней весь забег,
   * и прятать её за случайностью было бы обидно.
   */
  roll(count, random = () => rand()) {
    const pool = this.candidates();
    const picked = this.readyEvolutions().slice(0, count);

    while (picked.length < count && pool.length > 0) {
      const total = pool.reduce((sum, card) => sum + card.weight, 0);
      let ticket = random() * total;
      let index = 0;
      while (index < pool.length - 1 && ticket >= pool[index].weight) {
        ticket -= pool[index].weight;
        index += 1;
      }
      picked.push(pool.splice(index, 1)[0]);
    }

    return picked;
  }

  newWeaponCard(definition) {
    return {
      id: `new:${definition.id}`,
      title: definition.title,
      text: definition.description,
      color: definition.color,
      icon: definition.icon,
      badge: t('upgrade.badge.newWeapon'),
      fresh: true,
      preview: null,
      weight: CARD_WEIGHT.newWeapon,
      apply: () => this.arsenal.add(definition.id),
    };
  }

  weaponLevelCard(weapon) {
    const { definition, nextLevel } = weapon;
    const format = STAT_FORMAT[nextLevel.show];
    // На карточке — действующие значения, с учётом «Силы», «Спешки»
    // и «Размаха»: игрок должен видеть то, что получит на деле.
    const mods = this.player.mods;
    const now = weapon.effectiveStats(mods);
    const after = weapon.effectiveStats(mods, weapon.previewNextStats());

    return {
      id: `level:${weapon.id}`,
      title: definition.title,
      text: nextLevel.text,
      color: definition.color,
      icon: definition.icon,
      badge: t('upgrade.badge.level', { from: weapon.level, to: weapon.level + 1 }),
      preview: [format(now[nextLevel.show]), format(after[nextLevel.show])],
      weight: CARD_WEIGHT.weaponLevel,
      apply: () => weapon.levelUp(),
    };
  }

  evolutionCard(weapon, evolution) {
    return {
      id: `evolve:${weapon.id}`,
      title: evolution.title,
      text: evolution.description,
      color: evolution.color,
      icon: evolution.icon,
      badge: t('upgrade.badge.evolution'),
      highlight: true,
      evolution: true,
      preview: null,
      weight: 0,
      apply: () => this.arsenal.evolve(weapon, evolution),
    };
  }

  /** Эволюция, которой этой пассивки не хватает до рецепта, или undefined. */
  evolutionNeeding(passive) {
    for (const weapon of this.arsenal.weapons) {
      const evolution = this.evolutionOf(weapon.id);
      if (evolution?.requires === passive.id) return evolution;
    }
    return undefined;
  }

  passiveCard(passive) {
    const rank = this.rank(passive.id);
    const value = passive.get(this.player);
    // Первый ранг пассивки, которой не хватает до эволюции, подсвечен её цветом.
    const key = rank === 0 ? this.evolutionNeeding(passive) : undefined;

    return {
      id: `passive:${passive.id}`,
      title: passive.title,
      text: passive.text,
      color: passive.color,
      icon: passive.icon,
      badge: key
        ? t('upgrade.badge.key')
        : rank === 0
          ? t('upgrade.badge.new')
          : t('upgrade.badge.rank', { from: rank, to: rank + 1 }),
      fresh: rank === 0,
      badgeColor: key?.color,
      preview: [passive.format(value), passive.format(passive.next(value))],
      weight: CARD_WEIGHT.passive,
      apply: () => {
        passive.set(this.player, passive.next(passive.get(this.player)));
        this.ranks.set(passive.id, rank + 1);
      },
    };
  }

  /** Короткая сводка для HUD: «Пушка 3 · Нож 1 · Магнит 2». */
  summary() {
    // У эволюции уровней нет — пишем только название.
    const weapons = this.arsenal.weapons.map((w) =>
      w.definition.evolvesFrom ? w.definition.title : `${w.definition.title} ${w.level}`,
    );
    const passives = this.passives
      .filter((passive) => this.rank(passive.id) > 0)
      .map((passive) => `${passive.title} ${this.rank(passive.id)}`);
    return [...weapons, ...passives].join(' · ');
  }
}
