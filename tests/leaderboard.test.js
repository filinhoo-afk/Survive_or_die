import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TOP_SIZE, bestPerPlayer, fetchDaily, fetchTop, parseRows } from '../src/online/leaderboard.js';
import { fail, ok, scriptedBackend } from './helpers/backend.js';

const raw = (kills, time_sec, extra = {}) => ({ hero: 'gunner', time_sec, kills, level: 5, damage: 1000, victory: false, ...extra });

describe('parseRows', () => {
  test('приводит строки сервера к виду, нужному экрану', () => {
    const [row] = parseRows([raw(120, 300, { nick: 'bob', victory: true, hero: 'warden' })]);
    assert.deepEqual(row, { nick: 'BOB', hero: 'warden', time: 300, kills: 120, level: 5, damage: 1000, victory: true });
  });

  test('ответ не массив — пусто', () => {
    for (const data of [null, undefined, {}, 'text', 42]) assert.deepEqual(parseRows(data), []);
  });

  test('строки без чисел убийств или времени выбрасываются: ответ сервера — внешние данные', () => {
    const rows = parseRows([null, 5, 'x', { kills: 'много', time_sec: 1 }, { kills: 1 }, { time_sec: 1 }, raw(1, 1)]);
    assert.equal(rows.length, 1);
  });

  test('ник очищается; без ника — пустая строка', () => {
    assert.equal(parseRows([raw(1, 1)])[0].nick, '');
    assert.equal(parseRows([raw(1, 1, { nick: '<script>' })])[0].nick, 'SCRIPT');
    assert.equal(parseRows([raw(1, 1, { nick: 12345 })])[0].nick, '12345');
  });

  test('недостающие поля получают запасные значения', () => {
    const [row] = parseRows([{ kills: 3, time_sec: 9 }]);
    assert.equal(row.hero, '');
    assert.equal(row.level, 1);
    assert.equal(row.damage, 0);
    assert.equal(row.victory, false);
  });

  test('победой считается только настоящее true', () => {
    for (const victory of ['true', 1, 'yes']) assert.equal(parseRows([raw(1, 1, { victory })])[0].victory, false);
  });
});

describe('bestPerPlayer', () => {
  test('оставляет у игрока первую (лучшую — таблица уже отсортирована) строку', () => {
    const rows = [{ nick: 'A', kills: 9 }, { nick: 'B', kills: 8 }, { nick: 'A', kills: 7 }];
    assert.deepEqual(bestPerPlayer(rows), [rows[0], rows[1]]);
  });

  test('безымянные не склеиваются', () => {
    const rows = [{ nick: '', kills: 3 }, { nick: '', kills: 2 }];
    assert.deepEqual(bestPerPlayer(rows), rows);
  });
});

describe('fetchTop', () => {
  test('не настроен — not-configured, в сеть не идёт', async () => {
    const backend = scriptedBackend({ configured: false });
    assert.deepEqual(await fetchTop(backend, 'forest'), { ok: false, error: 'not-configured' });
    assert.equal(backend.calls.request.length, 0);
  });

  test('читает топ локации в порядке таблицы, только обычные забеги', async () => {
    const backend = scriptedBackend({ request: [ok([raw(5, 10, { nick: 'A' })])] });
    const result = await fetchTop(backend, 'forest');
    assert.equal(result.ok, true);
    assert.equal(result.rows[0].nick, 'A');
    const [method, query] = backend.calls.request[0];
    assert.equal(method, 'GET');
    assert.ok(query.includes('location=eq.forest'));
    assert.ok(query.includes('daily=is.null'));
    assert.ok(query.includes('order=kills.desc,time_sec.asc'));
    assert.ok(query.includes(`limit=${TOP_SIZE}`));
    assert.ok(query.includes('select=nick,'));
  });

  test('сервер без колонки nick: тот же запрос без неё, фильтр по daily остаётся', async () => {
    const backend = scriptedBackend({
      request: [(_m, query) => (query.includes('nick') ? fail('42703', 400) : ok([raw(5, 10)]))],
    });
    const result = await fetchTop(backend, 'forest');
    assert.equal(result.ok, true);
    assert.equal(result.rows.length, 1);
    const queries = backend.calls.request.map(([, q]) => q);
    assert.equal(queries.length, 3, 'ступени с ником отброшены, первая без него сработала');
    assert.ok(!queries.at(-1).includes('nick'));
    assert.ok(queries.at(-1).includes('daily=is.null'));
  });

  test('сервер без nick и daily: ступени идут до самой бедной', async () => {
    const backend = scriptedBackend({
      request: [(_m, query) => (query.includes('nick') || query.includes('daily') ? fail('42703', 400) : ok([raw(5, 10)]))],
    });
    const result = await fetchTop(backend, 'forest');
    assert.equal(result.ok, true);
    const queries = backend.calls.request.map(([, q]) => q);
    assert.equal(queries.length, 4);
    assert.ok(!queries.at(-1).includes('nick') && !queries.at(-1).includes('daily'));
    assert.ok(queries.at(-1).includes('location=eq.forest'), 'локация фильтруется всегда');
  });

  test('ни одна ступень не подошла — ошибка последней', async () => {
    const backend = scriptedBackend({ request: [fail('42703', 400)] });
    const result = await fetchTop(backend, 'forest');
    assert.deepEqual(result, { ok: false, error: '42703' });
    assert.equal(backend.calls.request.length, 4);
  });

  test('не-400 ошибка не перебирает ступени', async () => {
    const backend = scriptedBackend({ request: [fail('network', 0)] });
    assert.deepEqual(await fetchTop(backend, 'forest'), { ok: false, error: 'network' });
    assert.equal(backend.calls.request.length, 1);
  });

  test('название локации экранируется', async () => {
    const backend = scriptedBackend({ request: [ok([])] });
    await fetchTop(backend, 'x&limit=1');
    assert.ok(backend.calls.request[0][1].includes('location=eq.x%26limit%3D1'));
  });
});

describe('fetchDaily', () => {
  test('не настроен — not-configured', async () => {
    assert.deepEqual(await fetchDaily(scriptedBackend({ configured: false }), '2026-11-22'), { ok: false, error: 'not-configured' });
  });

  test('читает по дате, склеивает попытки одного игрока и режет до топа', async () => {
    const data = [
      raw(90, 10, { nick: 'A' }),
      raw(80, 10, { nick: 'A' }),
      raw(70, 10, { nick: 'B' }),
      raw(60, 10, { nick: 'C' }),
    ];
    const backend = scriptedBackend({ request: [ok(data)] });
    const result = await fetchDaily(backend, '2026-11-22', 2);
    assert.deepEqual(result.rows.map((r) => r.nick), ['A', 'B']);
    const query = backend.calls.request[0][1];
    assert.ok(query.includes('daily=eq.2026-11-22'));
    assert.ok(!query.includes('location='));
    assert.ok(query.includes('limit=50'), 'просит с запасом на склейку попыток');
  });

  test('сервер без колонки daily: к обычной таблице не откатывается', async () => {
    const backend = scriptedBackend({ request: [fail('42703', 400)] });
    const result = await fetchDaily(backend, '2026-11-22');
    assert.equal(result.ok, false);
    // Ступеней с колонкой daily две (с ником и без): обычную таблицу под видом дня не показываем.
    for (const [, query] of backend.calls.request) assert.ok(query.includes('daily=eq.'), query);
  });

  test('по умолчанию в топе TOP_SIZE строк', async () => {
    const data = Array.from({ length: 30 }, (_, i) => raw(100 - i, 10, { nick: `P${i}` }));
    const backend = scriptedBackend({ request: [ok(data)] });
    assert.equal((await fetchDaily(backend, '2026-11-22')).rows.length, TOP_SIZE);
  });
});
