/**
 * Чтение таблицы рекордов: топ забегов по локации.
 *
 * Порядок тот же, что у индекса `scores_top_idx` в миграции: больше убийств —
 * выше, при равенстве раньше тот, кто быстрее. Метод не бросает исключений.
 */

export const TOP_SIZE = 10;

/** Колонки, которые нужны экрану; `id` и `created_at` ему ни к чему. */
const COLUMNS = 'hero,time_sec,kills,level,damage,victory';

/** Оставляет только строки, похожие на рекорды: ответ сервера — внешние данные. */
export function parseRows(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter((row) => row && Number.isFinite(row.kills) && Number.isFinite(row.time_sec))
    .map((row) => ({
      hero: String(row.hero ?? ''),
      time: row.time_sec,
      kills: row.kills,
      level: Number.isFinite(row.level) ? row.level : 1,
      damage: Number.isFinite(row.damage) ? row.damage : 0,
      victory: row.victory === true,
    }));
}

/**
 * @returns {Promise<{ ok: true, rows: object[] } | { ok: false, error: string }>}
 */
export async function fetchTop(backend, locationId, limit = TOP_SIZE) {
  if (!backend.configured) return { ok: false, error: 'not-configured' };
  const query = [
    `select=${COLUMNS}`,
    `location=eq.${encodeURIComponent(locationId)}`,
    'order=kills.desc,time_sec.asc',
    `limit=${limit}`,
  ].join('&');
  const result = await backend.request('GET', query);
  return result.ok ? { ok: true, rows: parseRows(result.data) } : { ok: false, error: result.error };
}
