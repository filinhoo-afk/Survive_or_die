/**
 * Место забега в рейтинге: сколько результатов лучше этого и сколько их всего.
 *
 * «Лучше» — по тому же порядку, что у таблицы рекордов: больше убийств, а при
 * равенстве меньше времени. Обычный забег считает сервер (счётчик строк, сами
 * строки не качаются); испытание дня считается по игрокам — в его таблице у
 * каждого ника один, лучший результат, — поэтому там строки приходится читать.
 * Метод не бросает исключений: нет места — игра просто не показывает строку.
 */

import { buildScoreRow } from './submit.js';

/** Сколько строк испытания читаем: в день их заведомо меньше. */
const DAILY_ROWS = 1000;

/** Результат a строго лучше результата b. Оба — строки таблицы (`kills`, `time_sec`). */
export function isBetter(a, b) {
  return a.kills > b.kills || (a.kills === b.kills && a.time_sec < b.time_sec);
}

/**
 * Место в таблице испытания дня по её строкам. Один ник — один игрок, безымянные
 * не склеиваем. Свои более сильные попытки с чужими не считаются: место —
 * среди остальных игроков, а всего игроков столько, сколько разных ников.
 */
export function dailyPlace(rows, run) {
  const seen = new Set();
  let total = 0;
  let better = 0;
  for (const row of rows) {
    if (row.nick) {
      if (seen.has(row.nick)) continue;
      seen.add(row.nick);
    }
    total += 1;
    if (isBetter(row, run) && !(run.nick && row.nick === run.nick)) better += 1;
  }
  return { place: better + 1, total: Math.max(total, better + 1) };
}

/** Условие PostgREST «строго лучше этого результата». */
function betterFilter(row) {
  return `or=(kills.gt.${row.kills},and(kills.eq.${row.kills},time_sec.lt.${row.time_sec}))`;
}

async function localPlace(backend, row) {
  // Ступени: сервер без миграции 004 не знает колонку `daily` и отвечает 400.
  for (const filterDaily of [true, false]) {
    const base = `location=eq.${encodeURIComponent(row.location)}${filterDaily ? '&daily=is.null' : ''}`;
    const [better, total] = await Promise.all([
      backend.count(`${base}&${betterFilter(row)}`),
      backend.count(base),
    ]);
    if (better.ok && total.ok) {
      return { ok: true, place: better.count + 1, total: Math.max(total.count, better.count + 1) };
    }
    const failed = better.ok ? total : better;
    if (failed.status !== 400) return { ok: false, error: failed.error };
  }
  return { ok: false, error: 'unsupported' };
}

async function dailyRank(backend, row) {
  const query = [
    'select=nick,kills,time_sec',
    `daily=eq.${encodeURIComponent(row.daily)}`,
    'order=kills.desc,time_sec.asc',
    `limit=${DAILY_ROWS}`,
  ].join('&');
  const result = await backend.request('GET', query);
  if (!result.ok || !Array.isArray(result.data)) return { ok: false, error: result.error ?? 'bad-response' };
  const rows = result.data.filter((r) => r && Number.isFinite(r.kills) && Number.isFinite(r.time_sec));
  return { ok: true, ...dailyPlace(rows, row) };
}

/**
 * Место только что отправленного забега. run — то же, что получает submitScore.
 * @returns {Promise<{ ok: true, place: number, total: number, daily: boolean } | { ok: false, error: string }>}
 */
export async function fetchRank(backend, run) {
  if (!backend.configured) return { ok: false, error: 'not-configured' };
  const row = buildScoreRow(run);
  const result = row.daily ? await dailyRank(backend, row) : await localPlace(backend, row);
  return result.ok ? { ...result, daily: Boolean(row.daily) } : result;
}
