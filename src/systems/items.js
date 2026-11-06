import { Crate } from '../entities/crate.js';
import { Pickup } from '../entities/pickup.js';

const CRATE_COUNT = 16;
const BOMB_DAMAGE = 80;
const HEAL_RATIO = 0.3;
/** Шанс предмета из убитого врага — редкий, чтобы ящики оставались интересными. */
const ENEMY_DROP = 0.015;

/** Что выпадает из ящика: вид и вес. */
const CRATE_LOOT = [
  ['heal', 4],
  ['magnet', 3],
  ['bomb', 3],
  ['gem', 2],
];

function rollLoot(table) {
  const total = table.reduce((sum, [, w]) => sum + w, 0);
  let left = Math.random() * total;
  for (const [kind, weight] of table) {
    left -= weight;
    if (left < 0) return kind;
  }
  return table[0][0];
}

/** Ящики по миру: не у краёв, не на старте и не внутри препятствий. */
export function buildCrates(world, obstacles) {
  const crates = [];
  for (let attempt = 0; attempt < CRATE_COUNT * 30 && crates.length < CRATE_COUNT; attempt += 1) {
    const x = 120 + Math.random() * (world.width - 240);
    const y = 120 + Math.random() * (world.height - 240);
    if (Math.hypot(x - world.width / 2, y - world.height / 2) < 220) continue;
    if (obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < o.radius + 40)) continue;
    if (crates.some((c) => Math.hypot(c.x - x, c.y - y) < 120)) continue;
    crates.push(new Crate(x, y));
  }
  return crates;
}

/** Снаряды героя бьют ящики. @returns {Crate[]} разбитые в этом кадре */
export function hitCrates(projectiles, crates) {
  const broken = [];
  for (const shot of projectiles) {
    if (shot.expired) continue;
    for (const crate of crates) {
      if (!crate.alive || shot.hitCrates?.has(crate)) continue;
      const reach = crate.radius + shot.radius;
      if ((crate.x - shot.x) ** 2 + (crate.y - shot.y) ** 2 > reach * reach) continue;

      (shot.hitCrates ??= new Set()).add(crate);
      if (crate.hit()) broken.push(crate);
      if (shot.pierce > 0) {
        shot.pierce -= 1;
      } else {
        shot.spent = true;
        break;
      }
    }
  }
  return broken;
}

export function removeBroken(crates) {
  for (let i = crates.length - 1; i >= 0; i -= 1) {
    if (!crates[i].alive) crates.splice(i, 1);
  }
}

/** Лут из разбитого ящика: 'gem' или вид предмета. */
export function crateLoot() {
  return rollLoot(CRATE_LOOT);
}

/** Иногда предмет выпадает и из врага. */
export function enemyDrop() {
  return Math.random() < ENEMY_DROP ? rollLoot(CRATE_LOOT.filter(([k]) => k !== 'gem')) : null;
}

/** Награда «богатой» элиты: всегда предмет. */
export function rollEliteDrop() {
  return rollLoot(CRATE_LOOT.filter(([k]) => k !== 'gem'));
}

export function spawnPickup(pickups, x, y, kind) {
  pickups.push(new Pickup(x, y, kind));
}

/** Применяет подобранный предмет. @returns {Array} враги, убитые бомбой */
export function applyPickup(pickup, { player, gems, enemies, boss }) {
  const killed = [];
  if (pickup.kind === 'heal') {
    player.hp = Math.min(player.maxHp, player.hp + player.maxHp * HEAL_RATIO);
  } else if (pickup.kind === 'magnet') {
    for (const gem of gems) gem.pulled = true;
  } else {
    for (const enemy of enemies) {
      if (enemy === boss || !enemy.alive || enemy.underground) continue;
      if (enemy.takeHit(BOMB_DAMAGE, 0, 0)) killed.push(enemy);
    }
  }
  return killed;
}

/** @returns {Pickup[]} подобранные в этом кадре; просроченные тихо исчезают */
export function updatePickups(pickups, player, dt) {
  const taken = [];
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const pickup = pickups[i];
    pickup.update(dt, player);
    if (pickup.collected) taken.push(pickup);
    if (pickup.collected || pickup.expired) pickups.splice(i, 1);
  }
  return taken;
}
