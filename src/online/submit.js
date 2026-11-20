/**
 * Отправка результата забега в таблицу рекордов.
 *
 * Строка собирается так, чтобы пройти ограничения `check` из
 * supabase/migrations/001_scores.sql: числа целые и зажаты в допустимые
 * рамки. Отправка не должна мешать игре: метод не бросает исключений,
 * а повторять неудачный запрос игрок не обязан — рекорд просто не уйдёт.
 */

import { isValidNick } from '../systems/nickname.js';

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

/**
 * PostgREST так отвечает, когда в запросе есть колонка, которой нет в таблице:
 * не применена миграция 003_nickname.sql (колонка `nick`) или 004_daily.sql (`daily`).
 */
const UNKNOWN_COLUMN = 'PGRST204';

/** Имя колонки из ответа «Could not find the 'x' column of 'scores'»; null, если не нашлось. */
function missingColumn(result) {
  const match = /'([a-z_]+)' column/.exec(result.data?.message ?? '');
  return match ? match[1] : null;
}

/**
 * Строка таблицы `scores` по итогам забега. Ник кладётся, только если он
 * допустим: безымянные результаты уходят как раньше, без поля `nick`.
 * Результат испытания дня несёт ещё и дату — по ней он попадает в свою таблицу.
 */
export function buildScoreRow({ stats, locationId, heroId, victory, nick, daily }) {
  const row = {
    location: locationId,
    hero: heroId,
    time_sec: clampInt(stats.time, LIMITS.time_sec),
    kills: clampInt(stats.kills, LIMITS.kills),
    level: clampInt(stats.level, LIMITS.level),
    damage: clampInt(stats.damage, LIMITS.damage),
    victory: Boolean(victory),
  };
  if (isValidNick(nick)) row.nick = nick;
  if (daily) row.daily = daily;
  return row;
}

/**
 * Отправляет забег и возвращает состояние для экрана итогов.
 * Если сервер ещё не знает колонку `nick`, результат уходит без имени:
 * рекорд важнее подписи. Колонку `daily` так не отбросить: без неё результат
 * испытания лёг бы в обычную таблицу локации, поэтому он просто не уходит.
 * @returns {Promise<string>} одно из значений SUBMIT
 */
export async function submitScore(backend, run) {
  if (!backend.configured) return SUBMIT.off;
  const row = buildScoreRow(run);
  let result = await backend.request('POST', '', row, { Prefer: 'return=minimal' });
  if (!result.ok && result.error === UNKNOWN_COLUMN && 'nick' in row && missingColumn(result) !== 'daily') {
    delete row.nick;
    result = await backend.request('POST', '', row, { Prefer: 'return=minimal' });
  }
  if (result.ok) return SUBMIT.sent;
  return result.error === REJECTED_CODE ? SUBMIT.rejected : SUBMIT.failed;
}
