/**
 * Мета-прокачка: золото, которое копится между забегами, и постоянные
 * улучшения, купленные за него. Хранит единое сохранение (save.js).
 */

import { BALANCE } from '../balance/index.js';
import { localize } from '../i18n/index.js';
import { patchSave, readSave } from './save.js';

/**
 * Постоянные улучшения: уровень * step даёт бонус, цена растёт с уровнем.
 * Здесь порядок строк магазина; числа — в src/balance/meta.json.
 */
export const META_UPGRADES = ['vitality', 'might', 'swiftness', 'magnetism', 'greed'].map((id) => ({
  id,
  ...BALANCE.meta.upgrades[id],
}));

for (const upgrade of META_UPGRADES) localize(upgrade, `meta.${upgrade.id}`, ['title', 'desc']);

function emptyMeta() {
  return { gold: 0, levels: {} };
}

export function loadMeta() {
  const meta = emptyMeta();
  const saved = readSave().meta;
  if (saved && typeof saved === 'object') {
    if (Number.isFinite(saved.gold) && saved.gold > 0) meta.gold = Math.floor(saved.gold);
    for (const upgrade of META_UPGRADES) {
      const level = saved.levels?.[upgrade.id];
      if (Number.isInteger(level) && level > 0) meta.levels[upgrade.id] = Math.min(level, upgrade.max);
    }
  }
  return meta;
}

function saveMeta(meta) {
  patchSave({ meta });
}

export function levelOf(meta, id) {
  return meta.levels[id] ?? 0;
}

/** Накопленный бонус улучшения: купленный уровень на прибавку за уровень. */
function bonusOf(meta, id) {
  return levelOf(meta, id) * BALANCE.meta.upgrades[id].step;
}

/** Цена следующего уровня или null, если улучшение выкуплено до упора. */
export function priceOf(meta, upgrade) {
  const level = levelOf(meta, upgrade.id);
  return level >= upgrade.max ? null : upgrade.cost * (level + 1);
}

/** Покупает следующий уровень; возвращает новое состояние или null, если не вышло. */
export function buy(meta, id) {
  const upgrade = META_UPGRADES.find((u) => u.id === id);
  if (!upgrade) return null;
  const price = priceOf(meta, upgrade);
  if (price === null || meta.gold < price) return null;
  const next = {
    gold: meta.gold - price,
    levels: { ...meta.levels, [id]: levelOf(meta, id) + 1 },
  };
  saveMeta(next);
  return next;
}

/** Золото за забег: за убийства и время, плюс награда за победу над боссом. */
export function runGold(meta, { kills, time }, victory) {
  const { killsPerGold, secondsPerGold, victoryBonus } = BALANCE.meta.gold;
  const base = Math.floor(kills / killsPerGold + time / secondsPerGold) + (victory ? victoryBonus : 0);
  return Math.floor(base * (1 + bonusOf(meta, 'greed')));
}

/** Кладёт заработанное в казну и сохраняет. */
export function addGold(meta, amount) {
  const next = { ...meta, gold: meta.gold + amount };
  saveMeta(next);
  return next;
}

/** Применяет купленные улучшения к свежему игроку. */
export function applyMeta(meta, player) {
  player.maxHp += bonusOf(meta, 'vitality');
  player.hp = player.maxHp;
  player.mods.damage *= 1 + bonusOf(meta, 'might');
  player.speed *= 1 + bonusOf(meta, 'swiftness');
  player.magnetRadius *= 1 + bonusOf(meta, 'magnetism');
}
