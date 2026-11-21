/**
 * Связь с бэкендом рекордов (Supabase).
 *
 * Библиотека Supabase не нужна: у проекта есть обычный REST-адрес
 * `<url>/rest/v1/<таблица>`, с которым справляется fetch. Ключ в запросе
 * публичный — что с ним можно делать, решают правила доступа в базе
 * (supabase/migrations/001_scores.sql), а не секретность ключа.
 *
 * Сеть ненадёжна, а игра должна играться и без неё: ни один метод не
 * бросает исключений — ошибка возвращается как `{ ok: false, ... }`.
 */

import { CONFIG } from '../config.js';

/** Состояния связи — для индикатора в главном меню. */
export const ONLINE = {
  off: 'off', // адрес и ключ не заданы
  checking: 'checking',
  ok: 'ok',
  error: 'error',
};

const TABLE = 'scores';

/**
 * @param {{ url: string, key: string, timeout: number }} options адрес проекта и публичный ключ
 * @param {typeof fetch} fetchImpl подменяется в проверках
 */
export function createBackend(options = CONFIG.online, fetchImpl = (...args) => fetch(...args)) {
  const url = String(options.url ?? '').trim().replace(/\/+$/, '');
  const key = String(options.key ?? '').trim();
  const timeout = options.timeout ?? 6000;
  const configured = url !== '' && key !== '';

  /** Запрос к REST-адресу проекта; path — после /rest/v1/, query — параметры без «?». */
  async function send(path, method, query = '', body, headers = {}) {
    if (!configured) return { ok: false, status: 0, error: 'not-configured' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetchImpl(`${url}/rest/v1/${path}${query ? `?${query}` : ''}`, {
        method,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // Не JSON (страница ошибки прокси) — оставляем data пустым.
      }
      if (!response.ok) {
        return { ok: false, status: response.status, error: data?.code ?? `http-${response.status}`, data };
      }
      return { ok: true, status: response.status, data, range: response.headers?.get?.('content-range') ?? null };
    } catch (error) {
      return { ok: false, status: 0, error: error?.name === 'AbortError' ? 'timeout' : 'network' };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Запрос к таблице; query — строка параметров PostgREST без «?». */
  function request(method, query = '', body, headers = {}) {
    return send(TABLE, method, query, body, headers);
  }

  /** Вызов функции базы (POST /rest/v1/rpc/<name>); args — её параметры по именам. */
  function rpc(name, args = {}) {
    return send(`rpc/${name}`, 'POST', '', args);
  }

  /**
   * Сколько строк подходит под фильтр. Сами строки не качаются: сервер считает
   * их и пишет итог в заголовок Content-Range («0-0/123»).
   * @returns {Promise<{ ok: true, count: number } | { ok: false, status: number, error: string }>}
   */
  async function count(query = '') {
    const result = await send(TABLE, 'GET', `${query ? `${query}&` : ''}select=id&limit=1`, undefined, {
      Prefer: 'count=exact',
    });
    if (!result.ok) return result;
    const total = Number(/\/(\d+)$/.exec(result.range ?? '')?.[1]);
    return Number.isFinite(total) ? { ok: true, count: total } : { ok: false, status: result.status, error: 'no-count' };
  }

  return {
    configured,
    request,
    rpc,
    count,
    /** Есть ли связь и видна ли таблица: читает одну строку. */
    async check() {
      if (!configured) return ONLINE.off;
      const result = await request('GET', 'select=id&limit=1');
      return result.ok ? ONLINE.ok : ONLINE.error;
    },
  };
}
