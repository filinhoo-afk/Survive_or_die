/**
 * Подделки для тестов онлайн-части: ответ fetch и бэкенд, который отвечает по сценарию.
 */

/** Ответ, каким его видит createBackend: ok, status, text(), headers.get(). */
export function response({ status = 200, body = null, range = null, rawText } = {}) {
  const text = rawText ?? (body === null ? '' : JSON.stringify(body));
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    headers: { get: (name) => (name.toLowerCase() === 'content-range' ? range : null) },
  };
}

/**
 * Бэкенд-пустышка: каждый вызов request/count/rpc отдаёт следующий ответ из
 * сценария (функция или готовое значение) и записывается в calls.
 */
export function scriptedBackend({ configured = true, request = [], count = [] } = {}) {
  const calls = { request: [], count: [] };
  const next = (queue, args, bucket) => {
    bucket.push(args);
    const step = queue.length > 1 ? queue.shift() : queue[0];
    return typeof step === 'function' ? step(...args) : step;
  };
  return {
    configured,
    calls,
    request: async (...args) => next(request, args, calls.request),
    count: async (...args) => next(count, args, calls.count),
  };
}

export const ok = (data = null) => ({ ok: true, status: 200, data });
export const fail = (error, status = 400, data = null) => ({ ok: false, status, error, data });
