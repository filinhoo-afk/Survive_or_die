/**
 * Отправка результата забега в таблицу рекордов.
 *
 * Строка собирается так, чтобы пройти ограничения `check` из
 * supabase/migrations/001_scores.sql: числа целые и зажаты в допустимые
 * рамки. Отправка не должна мешать игре: метод не бросает исключений,
 * а повторять неудачный запрос игрок не обязан — рекорд просто не уйдёт.
 */

/** Рамки совпадают с ограничениями таблицы. */
const LIMITS = {
  time_sec: [1, 14400],
  kills: [0, 1000000],
  level: [1, 999],
  damage: [0, 1000000000],
};

/** Состояния отправки — для строки на экране итогов. */
export const SUBMIT = {
  off: 'off', // бэкенд не настроен — отправлять некуда
  sending: 'sending',
  sent: 'sent',
  failed: 'failed',
};

function clampInt(value, [min, max]) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Строка таблицы `scores` по итогам забега. */
export function buildScoreRow({ stats, locationId, heroId, victory }) {
  return {
    location: locationId,
    hero: heroId,
    time_sec: clampInt(stats.time, LIMITS.time_sec),
    kills: clampInt(stats.kills, LIMITS.kills),
    level: clampInt(stats.level, LIMITS.level),
    damage: clampInt(stats.damage, LIMITS.damage),
    victory: Boolean(victory),
  };
}

/**
 * Отправляет забег. Вызывающий сам решает, что показать игроку.
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function submitScore(backend, run) {
  if (!backend.configured) return { ok: false, error: 'not-configured' };
  const result = await backend.request('POST', '', buildScoreRow(run), { Prefer: 'return=minimal' });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
