/** Характеристики, которые растут от пассивки «Размах». */
const AREA_STATS = ['radius', 'orbSize'];

/**
 * Экземпляр оружия у игрока: уровень, текущие характеристики, перезарядка.
 *
 * Само поведение описано в определении (src/weapons/*.js):
 *   base        — характеристики первого уровня;
 *   levels      — что меняет каждый следующий уровень;
 *   fire        — залп по перезарядке; false, если выстрела не было;
 *   tick        — работа каждый кадр, для оружия без перезарядки;
 *
 * fire, tick и draw получают уже действующие характеристики —
 * с бонусами от пассивок игрока.
 *   createState — собственное изменяемое состояние экземпляра;
 *   draw, layer — как и где рисовать само оружие: 'under' или 'over' врагов.
 *
 * Всё, кроме base и levels, необязательно.
 *
 * scene — то, с чем оружие работает в кадре:
 *   { player, enemies, projectiles, killed }; в killed оружие кладёт
 *   врагов, которых убило само, без снарядов.
 */
export class Weapon {
  constructor(definition) {
    this.definition = definition;
    this.id = definition.id;
    this.level = 1;
    this.stats = { ...definition.base };
    this.timer = 0;
    this.state = definition.createState?.() ?? {};
  }

  get maxLevel() {
    return this.definition.levels.length + 1;
  }

  get canLevelUp() {
    return this.level < this.maxLevel;
  }

  /** Описание следующего уровня: что изменится. */
  get nextLevel() {
    return this.definition.levels[this.level - 1] ?? null;
  }

  /** Характеристики, какими они станут после повышения, — для карточки. */
  previewNextStats() {
    const next = { ...this.stats };
    this.nextLevel?.apply(next);
    return next;
  }

  levelUp() {
    if (!this.canLevelUp) return;
    this.nextLevel.apply(this.stats);
    this.level += 1;
  }

  /**
   * Характеристики с учётом пассивок игрока.
   *
   * Бонусы не вшиваются в stats, а накладываются при каждом обращении:
   * так «Сила», взятая на пятой минуте, усиливает и оружие, подобранное
   * на десятой.
   *
   * @param {{damage: number, cooldown: number, area: number}} [mods]
   */
  effectiveStats(mods, stats = this.stats) {
    const result = { ...stats };
    if (!mods) return result;

    if ('damage' in result) result.damage *= mods.damage;
    if ('cooldown' in result) result.cooldown *= mods.cooldown;
    for (const key of AREA_STATS) {
      if (key in result) result[key] *= mods.area;
    }

    return result;
  }

  update(dt, scene) {
    const stats = this.effectiveStats(scene.player?.mods);
    this.definition.tick?.(this, dt, scene, stats);
    if (!this.definition.fire) return;

    this.timer = Math.max(0, this.timer - dt);
    if (this.timer > 0) return;

    // Холостой выстрел не тратит перезарядку: цель, вошедшая в радиус
    // сразу после «выстрела в пустоту», получает удар без ожидания.
    if (this.definition.fire(stats, scene, this)) this.timer = stats.cooldown;
  }

  draw(ctx, scene) {
    this.definition.draw?.(this, ctx, scene, this.effectiveStats(scene.player?.mods));
  }
}

/** Убирает отжившие снаряды и улетевшие за пределы мира. */
export function pruneProjectiles(projectiles, world) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const shot = projectiles[i];
    const outside =
      shot.x < 0 || shot.x > world.width || shot.y < 0 || shot.y > world.height;

    // Замена последним вместо splice: порядок снарядов не важен,
    // а удаление из середины перестаёт двигать весь хвост массива.
    if (shot.expired || outside) {
      projectiles[i] = projectiles[projectiles.length - 1];
      projectiles.pop();
    }
  }
}
