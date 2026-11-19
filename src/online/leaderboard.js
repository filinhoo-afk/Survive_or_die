/**
 * Чтение таблицы рекордов: топ забегов по локации.
 *
 * Порядок тот же, что у индекса `scores_top_idx` в миграции: больше убийств —
 * выше, при равенстве раньше тот, кто быстрее. Метод не бросает исключений.
 */

import { cleanNick } from '../systems/nickname.js';

export const TOP_SIZE = 10;

/** Колонки, которые нужны экрану; `id` и `created_at` ему ни к чему. */
const COLUMNS = 'hero,time_sec,kills,level,damage,victory';
/** Колонка `nick` появилась в миграции 003_nickname.sql — до неё запрос без неё. */
const COLUMNS_WITH_NICK = `nick,${COLUMNS}`;

/** Оставляет только строки, похожие на рекорды: ответ сервера — внешние данные. */
export function parseRows(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter((row) => row && Number.isFinite(row.kills) && Number.isFinite(row.time_sec))
    .map((row) => ({
      nick: cleanNick(row.nick),
      hero: String(row.hero ?? ''),
      time: row.time_sec,
      kills: row.kills,
      level: Number.isFinite(row.level) ? row.level : 1,
      damage: Number.isFinite(row.damage) ? row.damage : 0,
      victory: row.victory === true,
    }));
}

function topQuery(columns, locationId, limit) {
  return [
    `select=${columns}`,
    `location=eq.${encodeURIComponent(locationId)}`,
    'order=kills.desc,time_sec.asc',
    `limit=${limit}`,
  ].join('&');
}

/**
 * @returns {Promise<{ ok: true, rows: object[] } | { ok: false, error: string }>}
 */
export async function fetchTop(backend, locationId, limit = TOP_SIZE) {
  if (!backend.configured) return { ok: false, error: 'not-configured' };
  let result = await backend.request('GET', topQuery(COLUMNS_WITH_NICK, locationId, limit));
  // 400 — сервер не знает колонку `nick`: миграция 003 ещё не применена. Таблица
  // без имён лучше, чем пустой экран.
  if (!result.ok && result.status === 400) {
    result = await backend.request('GET', topQuery(COLUMNS, locationId, limit));
  }
  return result.ok ? { ok: true, rows: parseRows(result.data) } : { ok: false, error: result.error };
}
