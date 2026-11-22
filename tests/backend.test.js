import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ONLINE, createBackend } from '../src/online/backend.js';
import { response } from './helpers/backend.js';

const OPTIONS = { url: 'https://proj.supabase.co', key: 'public-key', timeout: 200 };

/** Бэкенд на подменённом fetch; в calls лежат все запросы. */
function backendWith(handler, options = OPTIONS) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { backend: createBackend(options, fetchImpl), calls };
}

describe('настройка', () => {
  test('без адреса или без ключа бэкенд не настроен и в сеть не ходит', async () => {
    for (const options of [{ url: '', key: '' }, { url: 'https://x.co', key: '' }, { url: '', key: 'k' }, {}, { url: '  ', key: ' ' }]) {
      const { backend, calls } = backendWith(() => response(), options);
      assert.equal(backend.configured, false);
      assert.deepEqual(await backend.request('GET', 'select=id'), { ok: false, status: 0, error: 'not-configured' });
      assert.deepEqual(await backend.count(), { ok: false, status: 0, error: 'not-configured' });
      assert.deepEqual(await backend.rpc('f'), { ok: false, status: 0, error: 'not-configured' });
      assert.equal(await backend.check(), ONLINE.off);
      assert.equal(calls.length, 0);
    }
  });

  test('лишние пробелы и слэши в адресе срезаются', async () => {
    const { backend, calls } = backendWith(() => response({ body: [] }), { url: '  https://proj.supabase.co//  ', key: ' key ' });
    await backend.request('GET', 'select=id');
    assert.equal(calls[0].url, 'https://proj.supabase.co/rest/v1/scores?select=id');
    assert.equal(calls[0].init.headers.apikey, 'key');
  });
});

describe('request', () => {
  test('собирает адрес, метод и заголовки с публичным ключом', async () => {
    const { backend, calls } = backendWith(() => response({ body: [{ id: 1 }] }));
    const result = await backend.request('GET', 'select=id&limit=1');
    assert.equal(calls[0].url, 'https://proj.supabase.co/rest/v1/scores?select=id&limit=1');
    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.headers.apikey, 'public-key');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer public-key');
    assert.equal(calls[0].init.body, undefined);
    assert.equal('Content-Type' in calls[0].init.headers, false);
    assert.deepEqual(result.data, [{ id: 1 }]);
    assert.equal(result.ok, true);
  });

  test('без параметров — адрес без «?»', async () => {
    const { backend, calls } = backendWith(() => response());
    await backend.request('POST', '', { a: 1 });
    assert.equal(calls[0].url, 'https://proj.supabase.co/rest/v1/scores');
  });

  test('тело уходит JSON-ом, с типом содержимого; свои заголовки добавляются', async () => {
    const { backend, calls } = backendWith(() => response({ status: 201 }));
    await backend.request('POST', '', { kills: 5 }, { Prefer: 'return=minimal' });
    assert.equal(calls[0].init.body, '{"kills":5}');
    assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
    assert.equal(calls[0].init.headers.Prefer, 'return=minimal');
    assert.equal(calls[0].init.headers.apikey, 'public-key');
  });

  test('пустой ответ — data: null', async () => {
    const { backend } = backendWith(() => response({ status: 201 }));
    assert.equal((await backend.request('POST', '', {})).data, null);
  });

  test('ошибка сервера: код Postgres становится error, тело остаётся в data', async () => {
    const body = { code: '23514', message: 'new row violates check constraint' };
    const { backend } = backendWith(() => response({ status: 400, body }));
    assert.deepEqual(await backend.request('POST', '', {}), { ok: false, status: 400, error: '23514', data: body });
  });

  test('ошибка без кода — http-<статус>', async () => {
    const { backend } = backendWith(() => response({ status: 503, rawText: '<html>Bad gateway</html>' }));
    const result = await backend.request('GET', '');
    assert.equal(result.ok, false);
    assert.equal(result.error, 'http-503');
    assert.equal(result.data, null);
  });

  test('ответ не JSON при успехе — data пуст, но запрос удался', async () => {
    const { backend } = backendWith(() => response({ rawText: 'OK' }));
    const result = await backend.request('GET', '');
    assert.equal(result.ok, true);
    assert.equal(result.data, null);
  });

  test('обрыв сети — network, исключение наружу не летит', async () => {
    const { backend } = backendWith(() => {
      throw new TypeError('Failed to fetch');
    });
    assert.deepEqual(await backend.request('GET', ''), { ok: false, status: 0, error: 'network' });
  });

  test('сервер молчит дольше таймаута — timeout', async () => {
    const { backend } = backendWith(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }),
      { ...OPTIONS, timeout: 20 },
    );
    assert.deepEqual(await backend.request('GET', ''), { ok: false, status: 0, error: 'timeout' });
  });
});

describe('rpc', () => {
  test('POST на /rpc/<имя> с параметрами в теле', async () => {
    const { backend, calls } = backendWith(() => response({ body: 'ok' }));
    await backend.rpc('daily_challenge', { day: '2026-11-22' });
    assert.equal(calls[0].url, 'https://proj.supabase.co/rest/v1/rpc/daily_challenge');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.body, '{"day":"2026-11-22"}');
  });

  test('без параметров шлёт пустой объект', async () => {
    const { backend, calls } = backendWith(() => response());
    await backend.rpc('f');
    assert.equal(calls[0].init.body, '{}');
  });
});

describe('count', () => {
  test('читает число из Content-Range и просит точный счёт без строк', async () => {
    const { backend, calls } = backendWith(() => response({ body: [], range: '0-0/123' }));
    assert.deepEqual(await backend.count('location=eq.forest'), { ok: true, count: 123 });
    assert.equal(calls[0].url, 'https://proj.supabase.co/rest/v1/scores?location=eq.forest&select=id&limit=1');
    assert.equal(calls[0].init.headers.Prefer, 'count=exact');
  });

  test('без фильтра — только select и limit', async () => {
    const { backend, calls } = backendWith(() => response({ body: [], range: '*/0' }));
    assert.deepEqual(await backend.count(), { ok: true, count: 0 });
    assert.equal(calls[0].url, 'https://proj.supabase.co/rest/v1/scores?select=id&limit=1');
  });

  test('нет заголовка или он странный — no-count', async () => {
    for (const range of [null, '0-0/*', 'garbage']) {
      const { backend } = backendWith(() => response({ body: [], range }));
      const result = await backend.count('x=1');
      assert.equal(result.ok, false, String(range));
      assert.equal(result.error, 'no-count');
    }
  });

  test('ошибка сервера передаётся как есть', async () => {
    const { backend } = backendWith(() => response({ status: 400, body: { code: '42703' } }));
    const result = await backend.count('daily=is.null');
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(result.error, '42703');
  });
});

describe('check', () => {
  test('таблица читается — связь есть', async () => {
    const { backend, calls } = backendWith(() => response({ body: [] }));
    assert.equal(await backend.check(), ONLINE.ok);
    assert.equal(calls[0].url, 'https://proj.supabase.co/rest/v1/scores?select=id&limit=1');
  });

  test('сервер отвечает ошибкой или недоступен — error', async () => {
    assert.equal(await backendWith(() => response({ status: 401, body: { code: 'PGRST301' } })).backend.check(), ONLINE.error);
    assert.equal(
      await backendWith(() => {
        throw new Error('offline');
      }).backend.check(),
      ONLINE.error,
    );
  });
});
