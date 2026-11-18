/**
 * Отправка результата забега в таблицу рекордов.
 *
 * Строка собирается так, чтобы пройти ограничения `check` из
 * supabase/migrations/001_scores.sql: числа целые и зажаты в допустимые
 * рамки. Отправка не должна мешать игре: метод не бросает исключений,
 * а повторять неудачный запрос игрок не обязан — рекорд просто не уйдёт.
 */

/**
 * Код ошибки Postgres «нарушено ограничение check». Им же отвечает проверка
 * правдоподобия (supabase/migrations/002_plausibility.sql): для игры это
 * одно и то же — сервер отказался принять результат, повторять бесполезно.
 */
export const REJECTED_CODE = '23514';

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
  failed: 'failed', // нет связи или сбой сервера
  rejected: 'rejected', // сервер счёл результат неправдоподобным
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
 * Отправляет забег и возвращает состояние для экрана итогов.
 * @returns {Promise<string>} одно из значений SUBMIT
 */
export async function submitScore(backend, run) {
  if (!backend.configured) return SUBMIT.off;
  const result = await backend.request('POST', '', buildScoreRow(run), { Prefer: 'return=minimal' });
  if (result.ok) return SUBMIT.sent;
  return result.error === REJECTED_CODE ? SUBMIT.rejected : SUBMIT.failed;
}
