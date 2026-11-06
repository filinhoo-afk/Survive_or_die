/**
 * Элитные враги: обычный враг с одним модификатором.
 *
 * Элита крупнее, живучее и щедрее на опыт; модификатор добавляет свою
 * особенность и цвет ободка под ногами, по которому её видно издалека.
 *   hp, speed, damage, xp — множители к характеристикам типа;
 *   knockbackResist       — добавка к сопротивлению отбросу;
 *   drop                  — гарантированно роняет предмет.
 */
export const ELITE = {
  /** Во сколько раз элита крупнее обычного врага (спрайт округляется до целого пикселя). */
  size: 1.3,
  hp: 2.5,
  xp: 4,
  /** С какой секунды забега появляются элиты. */
  from: 120,
  /** Шанс на каждого нового врага: стартовый, прирост за минуту и потолок. */
  chance: 0.03,
  chancePerMinute: 0.01,
  maxChance: 0.12,
};

export const ELITE_MODIFIERS = {
  armored: { id: 'armored', title: 'Бронированный', color: '#9aa6bd', hp: 2, knockbackResist: 0.7 },
  swift: { id: 'swift', title: 'Проворный', color: '#4cc9f0', speed: 1.5 },
  brutal: { id: 'brutal', title: 'Свирепый', color: '#f2786a', damage: 1.7 },
  rich: { id: 'rich', title: 'Богатый', color: '#ffd34e', xp: 2, drop: true },
};

/** Случайный модификатор: все равновероятны. */
export function rollModifier() {
  const all = Object.values(ELITE_MODIFIERS);
  return all[Math.floor(Math.random() * all.length)];
}

/** Шанс, что новый враг окажется элитой, через `seconds` секунд забега. */
export function eliteChance(seconds) {
  if (seconds < ELITE.from) return 0;
  const minutes = seconds / 60;
  return Math.min(ELITE.maxChance, ELITE.chance + ELITE.chancePerMinute * (minutes - ELITE.from / 60));
}
