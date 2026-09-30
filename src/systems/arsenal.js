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

  has(id) {
    return this.weapons.some((weapon) => weapon.id === id);
  }

  add(id) {
    if (this.has(id) || !this.hasFreeSlot) return null;
    const weapon = new Weapon(WEAPONS_BY_ID[id]);
    this.weapons.push(weapon);
    return weapon;
  }

  update(dt, world) {
    for (const weapon of this.weapons) weapon.update(dt, world);
  }
}
