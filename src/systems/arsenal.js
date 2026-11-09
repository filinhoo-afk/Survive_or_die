import { CONFIG } from '../config.js';
import { WEAPONS_BY_ID } from '../weapons/index.js';
import { Weapon } from './weapons.js';

/** Всё оружие, которое сейчас у игрока. */
export class Arsenal {
  constructor(maxWeapons = CONFIG.arsenal.maxWeapons) {
    this.maxWeapons = maxWeapons;
    this.weapons = [];
  }

  get hasFreeSlot() {
    return this.weapons.length < this.maxWeapons;
  }

  /** Есть ли оружие — само или уже как эволюция. */
  has(id) {
    return this.weapons.some(
      (weapon) => weapon.id === id || weapon.definition.evolvesFrom === id,
    );
  }

  add(id) {
    if (this.has(id) || !this.hasFreeSlot) return null;
    const weapon = new Weapon(WEAPONS_BY_ID[id]);
    this.weapons.push(weapon);
    return weapon;
  }

  /** Заменяет оружие его эволюцией на том же месте в списке. */
  evolve(weapon, definition) {
    const index = this.weapons.indexOf(weapon);
    if (index < 0) return null;
    const evolved = new Weapon(definition);
    this.weapons[index] = evolved;
    return evolved;
  }

  update(dt, scene) {
    for (const weapon of this.weapons) weapon.update(dt, scene);
  }

  /** Рисует оружие одного слоя: 'under' — под врагами, 'over' — над ними. */
  draw(ctx, scene, layer) {
    for (const weapon of this.weapons) {
      if ((weapon.definition.layer ?? 'over') === layer) weapon.draw(ctx, scene);
    }
  }
}
