/**
 * Мета-прокачка: золото, которое копится между забегами, и постоянные
 * улучшения, купленные за него. Хранилище бывает недоступно, поэтому любая
 * ошибка localStorage превращается в «золота нет, ничего не куплено».
 */

const STORAGE_KEY = 'survive-or-die:meta';

/** Постоянные улучшения: уровень * step даёт бонус, цена растёт с уровнем. */
export const META_UPGRADES = [
  { id: 'vitality', title: 'Крепость', desc: '+10 здоровья', max: 5, cost: 40, step: 10 },
  { id: 'might', title: 'Сила', desc: '+5% урона', max: 5, cost: 60, step: 0.05 },
  { id: 'swiftness', title: 'Резвость', desc: '+4% скорости', max: 5, cost: 50, step: 0.04 },
  { id: 'magnetism', title: 'Магнетизм', desc: '+15% радиус сбора', max: 4, cost: 40, step: 0.15 },
  { id: 'greed', title: 'Жадность', desc: '+10% золота', max: 5, cost: 80, step: 0.1 },
];

function emptyMeta() {
  return { gold: 0, levels: {} };
}

export function loadMeta() {
  const meta = emptyMeta();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') {
      if (Number.isFinite(saved.gold) && saved.gold > 0) meta.gold = Math.floor(saved.gold);
      for (const upgrade of META_UPGRADES) {
        const level = saved.levels?.[upgrade.id];
        if (Number.isInteger(level) && level > 0) meta.levels[upgrade.id] = Math.min(level, upgrade.max);
      }
    }
  } catch {
    // Испорченная запись или нет доступа — начинаем с нуля.
  }
  return meta;
}

function saveMeta(meta) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // Не сохранилось — прогресс проживёт до перезагрузки страницы.
  }
}

export function levelOf(meta, id) {
  return meta.levels[id] ?? 0;
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
  const base = Math.floor(kills / 4 + time / 30) + (victory ? 50 : 0);
  return Math.floor(base * (1 + levelOf(meta, 'greed') * 0.1));
}

/** Кладёт заработанное в казну и сохраняет. */
export function addGold(meta, amount) {
  const next = { ...meta, gold: meta.gold + amount };
  saveMeta(next);
  return next;
}

/** Применяет купленные улучшения к свежему игроку. */
export function applyMeta(meta, player) {
  const bonus = (id) => levelOf(meta, id) * META_UPGRADES.find((u) => u.id === id).step;
  player.maxHp += bonus('vitality');
  player.hp = player.maxHp;
  player.mods.damage *= 1 + bonus('might');
  player.speed *= 1 + bonus('swiftness');
  player.magnetRadius *= 1 + bonus('magnetism');
}
