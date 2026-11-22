import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyPlace, fetchRank, isBetter } from '../src/online/rank.js';
import { fail, ok, scriptedBackend } from './helpers/backend.js';

const row = (kills, time_sec, nick) => ({ kills, time_sec, ...(nick === undefined ? {} : { nick }) });

describe('isBetter', () => {
  test('больше убийств — лучше', () => {
    assert.equal(isBetter(row(10, 500), row(9, 10)), true);
    assert.equal(isBetter(row(9, 10), row(10, 500)), false);
  });

  test('при равенстве убийств лучше тот, кто быстрее', () => {
    assert.equal(isBetter(row(10, 100), row(10, 200)), true);
    assert.equal(isBetter(row(10, 200), row(10, 100)), false);
  });

  test('равные результаты не лучше друг друга', () => {
    assert.equal(isBetter(row(10, 100), row(10, 100)), false);
  });
});

describe('dailyPlace', () => {
  // К моменту запроса забег уже отправлен, поэтому его строка есть и в таблице.
  test('пустая таблица — первое место из одного', () => {
    assert.deepEqual(dailyPlace([], row(5, 60, 'A')), { place: 1, total: 1 });
  });

  test('единственный игрок в таблице — первый', () => {
    assert.deepEqual(dailyPlace([row(5, 60, 'ME')], row(5, 60, 'ME')), { place: 1, total: 1 });
  });

  test('место — сколько игроков лучше, плюс один', () => {
    const rows = [row(50, 100, 'A'), row(40, 100, 'B'), row(35, 100, 'ME'), row(30, 100, 'C'), row(10, 100, 'D')];
    assert.deepEqual(dailyPlace(rows, row(35, 100, 'ME')), { place: 3, total: 5 });
  });

  test('десять попыток одного игрока считаются как один игрок', () => {
    const rows = [row(50, 100, 'A'), row(49, 100, 'A'), row(48, 100, 'A'), row(20, 100, 'ME'), row(10, 100, 'B')];
    assert.deepEqual(dailyPlace(rows, row(20, 100, 'ME')), { place: 2, total: 3 });
  });

  test('свои собственные результаты с чужими не сравниваются: место среди остальных', () => {
    const rows = [row(50, 100, 'ME'), row(40, 100, 'B'), row(30, 100, 'ME'), row(10, 100, 'C')];
    // Мои пятьдесят убийств уже в таблице; нынешний забег слабее, но «лучше» себя же — не считается.
    assert.deepEqual(dailyPlace(rows, row(30, 100, 'ME')), { place: 2, total: 3 });
  });

  test('безымянные не склеиваются между собой', () => {
    const rows = [row(50, 100), row(40, 100), row(35, 100), row(30, 100)];
    assert.deepEqual(dailyPlace(rows, row(35, 100)), { place: 3, total: 4 });
  });

  test('всего игроков не меньше места, даже если своей строки в ответе нет', () => {
    const { place, total } = dailyPlace([row(50, 100, 'A'), row(40, 100, 'B')], row(1, 1, 'ME'));
    assert.equal(place, 3);
    assert.ok(total >= place);
  });

  test('равные по результату не обгоняют', () => {
    assert.deepEqual(dailyPlace([row(30, 100, 'A'), row(30, 100, 'B')], row(30, 100, 'B')), { place: 1, total: 2 });
  });
});

describe('fetchRank: обычный забег', () => {
  const run = (overrides = {}) => ({
    stats: { time: 100, kills: 10, level: 3, damage: 500 },
    locationId: 'forest',
    heroId: 'gunner',
    victory: false,
    ...overrides,
  });

  /** Счётчик: запрос «лучше» (в нём or=) отдаёт better, остальные — total. */
  const counting = (better, total) => (query) => ({ ok: true, count: query.includes('or=') ? better : total });

  test('не настроен — not-configured', async () => {
    const backend = scriptedBackend({ configured: false });
    assert.deepEqual(await fetchRank(backend, run()), { ok: false, error: 'not-configured' });
  });

  test('место = лучших + 1, всего — из счётчика', async () => {
    const backend = scriptedBackend({ count: [counting(3, 10)] });
    assert.deepEqual(await fetchRank(backend, run()), { ok: true, place: 4, total: 10, daily: false });
  });

  test('считает только обычные забеги своей локации, строки не качает', async () => {
    const backend = scriptedBackend({ count: [counting(0, 1)] });
    await fetchRank(backend, run({ locationId: 'ruins' }));
    const queries = backend.calls.count.map(([q]) => q);
    assert.equal(queries.length, 2);
    for (const q of queries) assert.ok(q.includes('location=eq.ruins') && q.includes('daily=is.null'), q);
    assert.equal(backend.calls.request.length, 0);
  });

  test('«лучше» — больше убийств или столько же, но быстрее', async () => {
    const backend = scriptedBackend({ count: [counting(0, 1)] });
    await fetchRank(backend, run());
    const better = backend.calls.count.map(([q]) => q).find((q) => q.includes('or='));
    assert.ok(better.includes('or=(kills.gt.10,and(kills.eq.10,time_sec.lt.100))'), better);
  });

  test('всего не меньше места, даже если свой результат ещё не посчитался', async () => {
    const backend = scriptedBackend({ count: [counting(5, 3)] });
    const result = await fetchRank(backend, run());
    assert.equal(result.place, 6);
    assert.equal(result.total, 6);
  });

  test('сервер без колонки daily (400): повтор без фильтра по ней', async () => {
    const backend = scriptedBackend({
      count: [
        (query) => (query.includes('daily=is.null') ? fail('42703', 400) : { ok: true, count: query.includes('or=') ? 1 : 7 }),
      ],
    });
    const result = await fetchRank(backend, run());
    assert.deepEqual(result, { ok: true, place: 2, total: 7, daily: false });
    assert.ok(backend.calls.count.some(([q]) => !q.includes('daily=is.null')));
  });

  test('любая другая ошибка — без повторов, место не показывается', async () => {
    const backend = scriptedBackend({ count: [fail('network', 0)] });
    assert.deepEqual(await fetchRank(backend, run()), { ok: false, error: 'network' });
  });

  test('обе ступени ответили 400 — unsupported', async () => {
    const backend = scriptedBackend({ count: [fail('42703', 400)] });
    assert.deepEqual(await fetchRank(backend, run()), { ok: false, error: 'unsupported' });
  });

  test('название локации безопасно вставляется в запрос', async () => {
    const backend = scriptedBackend({ count: [counting(0, 1)] });
    await fetchRank(backend, run({ locationId: 'a&b=c' }));
    assert.ok(backend.calls.count[0][0].includes('location=eq.a%26b%3Dc'));
  });
});

describe('fetchRank: испытание дня', () => {
  const daily = (overrides = {}) => ({
    stats: { time: 100, kills: 20, level: 3, damage: 500 },
    locationId: 'ruins',
    heroId: 'thrower',
    victory: false,
    nick: 'ME',
    daily: '2026-11-22',
    ...overrides,
  });

  test('читает таблицу дня и считает место среди игроков', async () => {
    const rows = [row(50, 100, 'A'), row(30, 100, 'B'), row(20, 100, 'ME'), row(10, 100, 'C')];
    const backend = scriptedBackend({ request: [ok(rows)] });
    assert.deepEqual(await fetchRank(backend, daily()), { ok: true, place: 3, total: 4, daily: true });
    const [method, query] = backend.calls.request[0];
    assert.equal(method, 'GET');
    assert.ok(query.includes('daily=eq.2026-11-22'));
    assert.ok(query.includes('order=kills.desc,time_sec.asc'));
    assert.equal(backend.calls.count.length, 0, 'для испытания счётчик не нужен');
  });

  test('мусорные строки ответа отбрасываются', async () => {
    const rows = [row(50, 100, 'A'), null, { kills: 'много', time_sec: 1 }, { kills: 5 }, row(20, 100, 'ME'), row(10, 100, 'B')];
    const backend = scriptedBackend({ request: [ok(rows)] });
    assert.deepEqual(await fetchRank(backend, daily()), { ok: true, place: 2, total: 3, daily: true });
  });

  test('ответ не массив — ошибка', async () => {
    const backend = scriptedBackend({ request: [ok({ oops: true })] });
    assert.deepEqual(await fetchRank(backend, daily()), { ok: false, error: 'bad-response' });
  });

  test('ошибка сервера передаётся', async () => {
    const backend = scriptedBackend({ request: [fail('network', 0)] });
    assert.deepEqual(await fetchRank(backend, daily()), { ok: false, error: 'network' });
  });
});
