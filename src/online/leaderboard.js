/**
 * Чтение таблицы рекордов: топ забегов по локации и топ испытания дня.
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

/**
 * Запрос топа. daily — дата испытания дня: тогда читаем только его таблицу,
 * иначе — только обычные забеги локации (у них `daily` пуст).
 */
function topQuery({ columns, location, daily, filterDaily }, limit) {
  const parts = [`select=${columns}`];
  if (daily) parts.push(`daily=eq.${encodeURIComponent(daily)}`);
  else {
    parts.push(`location=eq.${encodeURIComponent(location)}`);
    if (filterDaily) parts.push('daily=is.null');
  }
  parts.push('order=kills.desc,time_sec.asc', `limit=${limit}`);
  return parts.join('&');
}

/**
 * Читает строки по ступеням от полных колонок к бедным: сервер без миграции
 * отвечает 400 на незнакомую колонку, и тогда пробуем то, что он знает.
 * Таблица без имён лучше, чем пустой экран. Таблице испытания годятся только
 * ступени с колонкой `daily`: без миграции 004 её просто нет.
 */
async function fetchRows(backend, request, limit) {
  const steps = [
    { columns: COLUMNS_WITH_NICK, filterDaily: true },
    { columns: COLUMNS_WITH_NICK, filterDaily: false },
    { columns: COLUMNS, filterDaily: true },
    { columns: COLUMNS, filterDaily: false },
  ];
  let result;
  for (const step of request.daily ? steps.filter((s) => s.filterDaily) : steps) {
    result = await backend.request('GET', topQuery({ ...request, ...step }, limit));
    if (result.ok || result.status !== 400) break;
  }
  return result.ok ? { ok: true, rows: parseRows(result.data) } : { ok: false, error: result.error };
}

/**
 * @returns {Promise<{ ok: true, rows: object[] } | { ok: false, error: string }>}
 */
export async function fetchTop(backend, locationId, limit = TOP_SIZE) {
  if (!backend.configured) return { ok: false, error: 'not-configured' };
  return fetchRows(backend, { location: locationId }, limit);
}

/**
 * Лучший результат каждого игрока: один человек не занимает всю таблицу
 * десятью попытками. Строки уже отсортированы; безымянные не склеиваем —
 * сказать, чьи они, нельзя.
 */
export function bestPerPlayer(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    if (!row.nick) return true;
    if (seen.has(row.nick)) return false;
    seen.add(row.nick);
    return true;
  });
}

/** Сколько строк просим у сервера, чтобы после склейки попыток осталось на целый топ. */
const DAILY_FETCH = 50;

/**
 * Таблица испытания дня за дату: те же колонки и порядок, что у обычной.
 * @returns {Promise<{ ok: true, rows: object[] } | { ok: false, error: string }>}
 */
export async function fetchDaily(backend, date, limit = TOP_SIZE) {
  if (!backend.configured) return { ok: false, error: 'not-configured' };
  const result = await fetchRows(backend, { daily: date }, DAILY_FETCH);
  return result.ok ? { ok: true, rows: bestPerPlayer(result.rows).slice(0, limit) } : result;
}
