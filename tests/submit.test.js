import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { REJECTED_CODE, SUBMIT, buildScoreRow, submitScore } from '../src/online/submit.js';
import { fail, ok, scriptedBackend } from './helpers/backend.js';

const run = (overrides = {}) => ({
  stats: { time: 125.6, kills: 240, level: 9, damage: 18000 },
  locationId: 'forest',
  heroId: 'thrower',
  victory: false,
  ...overrides,
});

describe('buildScoreRow', () => {
  test('собирает строку таблицы из итогов забега', () => {
    assert.deepEqual(buildScoreRow(run()), {
      location: 'forest',
      hero: 'thrower',
      time_sec: 126,
      kills: 240,
      level: 9,
      damage: 18000,
      victory: false,
    });
  });

  test('числа округляются до целых и зажимаются в рамки таблицы', () => {
    const row = buildScoreRow(run({ stats: { time: 0.2, kills: -5, level: 0, damage: 5e12 } }));
    assert.equal(row.time_sec, 1);
    assert.equal(row.kills, 0);
    assert.equal(row.level, 1);
    assert.equal(row.damage, 1000000000);

    const long = buildScoreRow(run({ stats: { time: 99999, kills: 5e7, level: 5000, damage: 1 } }));
    assert.equal(long.time_sec, 14400);
    assert.equal(long.kills, 1000000);
    assert.equal(long.level, 999);
  });

  test('мусор вместо чисел не роняет, а превращается в минимум', () => {
    const row = buildScoreRow(run({ stats: { time: NaN, kills: undefined, level: 'много', damage: null } }));
    assert.deepEqual([row.time_sec, row.kills, row.level, row.damage], [1, 0, 1, 0]);
  });

  test('победа приводится к булеву', () => {
    assert.equal(buildScoreRow(run({ victory: 1 })).victory, true);
    assert.equal(buildScoreRow(run({ victory: undefined })).victory, false);
  });

  test('допустимый ник кладётся в строку, недопустимый и пустой — нет', () => {
    assert.equal(buildScoreRow(run({ nick: 'BOB' })).nick, 'BOB');
    for (const nick of ['bob', '', 'A  B', undefined, null, 'X'.repeat(13)]) {
      assert.equal('nick' in buildScoreRow(run({ nick })), false, String(nick));
    }
  });

  test('дата испытания дня кладётся только у испытания', () => {
    assert.equal(buildScoreRow(run({ daily: '2026-11-22' })).daily, '2026-11-22');
    assert.equal('daily' in buildScoreRow(run()), false);
    assert.equal('daily' in buildScoreRow(run({ daily: null })), false);
  });
});

describe('submitScore', () => {
  test('бэкенд не настроен — отправлять некуда, в сеть не идёт', async () => {
    const backend = scriptedBackend({ configured: false, request: [ok()] });
    assert.equal(await submitScore(backend, run()), SUBMIT.off);
    assert.equal(backend.calls.request.length, 0);
  });

  test('успех: POST строки без ответа в теле', async () => {
    const backend = scriptedBackend({ request: [ok()] });
    assert.equal(await submitScore(backend, run({ nick: 'BOB' })), SUBMIT.sent);
    const [method, query, body, headers] = backend.calls.request[0];
    assert.equal(method, 'POST');
    assert.equal(query, '');
    assert.equal(body.nick, 'BOB');
    assert.deepEqual(headers, { Prefer: 'return=minimal' });
  });

  test('код отказа — 23514 «нарушено ограничение check»: им отвечает и таблица, и проверка правдоподобия', () => {
    assert.equal(REJECTED_CODE, '23514');
  });

  test('сервер отклонил (check/правдоподобие) — rejected, без повторов', async () => {
    const backend = scriptedBackend({ request: [fail('23514')] });
    assert.equal(await submitScore(backend, run()), SUBMIT.rejected);
    assert.equal(backend.calls.request.length, 1);
  });

  test('сеть или сервер упали — failed', async () => {
    for (const error of ['network', 'timeout', 'http-500', '42501']) {
      const backend = scriptedBackend({ request: [fail(error, 0)] });
      assert.equal(await submitScore(backend, run()), SUBMIT.failed, error);
    }
  });

  test('сервер без колонки nick: результат уходит повторно, но уже без ника', async () => {
    const missing = fail('PGRST204', 400, { message: "Could not find the 'nick' column of 'scores' in the schema cache" });
    const backend = scriptedBackend({ request: [missing, ok()] });
    assert.equal(await submitScore(backend, run({ nick: 'BOB' })), SUBMIT.sent);
    assert.equal(backend.calls.request.length, 2);
    assert.equal('nick' in backend.calls.request[1][2], false);
    assert.equal(backend.calls.request[1][2].kills, 240);
  });

  test('повтор без ника тоже может быть отклонён сервером', async () => {
    const missing = fail('PGRST204', 400, { message: "Could not find the 'nick' column of 'scores'" });
    const backend = scriptedBackend({ request: [missing, fail(REJECTED_CODE)] });
    assert.equal(await submitScore(backend, run({ nick: 'BOB' })), SUBMIT.rejected);
  });

  test('сервер без колонки daily: испытание не уходит, чтобы не лечь в таблицу локации', async () => {
    const missing = fail('PGRST204', 400, { message: "Could not find the 'daily' column of 'scores'" });
    const backend = scriptedBackend({ request: [missing, ok()] });
    assert.equal(await submitScore(backend, run({ nick: 'BOB', daily: '2026-11-22' })), SUBMIT.failed);
    assert.equal(backend.calls.request.length, 1, 'повтора без daily быть не должно');
  });

  test('нет колонки, но ника в строке не было — повторять нечего', async () => {
    const missing = fail('PGRST204', 400, { message: "Could not find the 'nick' column of 'scores'" });
    const backend = scriptedBackend({ request: [missing] });
    assert.equal(await submitScore(backend, run()), SUBMIT.failed);
    assert.equal(backend.calls.request.length, 1);
  });
});
