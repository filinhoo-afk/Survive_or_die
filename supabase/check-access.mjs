/**
 * Проверка правил доступа к таблице рекордов — глазами обычного игрока.
 *
 *   node supabase/check-access.mjs
 *
 * Берёт адрес и публичный ключ из src/config.js и пробует сделать то, что
 * можно, и то, что нельзя. В таблицу при этом ничего не попадает: «плохие»
 * запросы составлены так, что база обязана их отклонить, а update и delete
 * нацелены на строку, которой не бывает (id = -1).
 */

import { createBackend } from '../src/online/backend.js';

const backend = createBackend();
if (!backend.configured) {
  console.error('В src/config.js не заданы online.url и online.key — проверять нечего.');
  process.exit(1);
}

/** Строка, которую база принять не должна: такой локации нет. */
const badRow = {
  location: 'check-access',
  hero: 'gunner',
  time_sec: 60,
  kills: 10,
  level: 2,
  damage: 100,
  victory: false,
};

/** Коды ошибок Postgres: нет прав и нарушено ограничение check. */
const DENIED = '42501';
const CHECK = '23514';

const cases = [
  {
    name: 'читать рекорды можно',
    run: () => backend.request('GET', 'select=id&limit=1'),
    pass: (r) => r.ok,
  },
  {
    name: 'добавлять можно, но мусор отсекает check',
    run: () => backend.request('POST', '', badRow, { Prefer: 'return=minimal' }),
    pass: (r) => r.error === CHECK,
  },
  {
    name: 'подставить своё время создания нельзя',
    run: () =>
      backend.request('POST', '', { ...badRow, created_at: '2000-01-01T00:00:00Z' }, { Prefer: 'return=minimal' }),
    pass: (r) => r.error === DENIED,
  },
  {
    name: 'исправить чужой рекорд нельзя',
    run: () => backend.request('PATCH', 'id=eq.-1', { kills: 0 }),
    pass: (r) => r.error === DENIED,
  },
  {
    name: 'удалить рекорд нельзя',
    run: () => backend.request('DELETE', 'id=eq.-1'),
    pass: (r) => r.error === DENIED,
  },
];

let failed = 0;
for (const test of cases) {
  const result = await test.run();
  const ok = test.pass(result);
  if (!ok) failed += 1;
  const detail = result.ok ? `HTTP ${result.status}` : `HTTP ${result.status}, ${result.error}`;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${test.name} (${detail})`);
}

console.log(failed === 0 ? '\nПравила доступа работают.' : `\nНе прошло проверок: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
