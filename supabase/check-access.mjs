/**
 * Проверка правил доступа к таблице рекордов — глазами обычного игрока.
 *
 *   node supabase/check-access.mjs
 *
 * Берёт адрес и публичный ключ из src/config.js и пробует сделать то, что
 * можно, и то, что нельзя. В таблицу при этом ничего не попадает: «плохие»
 * запросы составлены так, что база обязана их отклонить, а update и delete
 * нацелены на строку, которой не бывает (id = -1).
 *
 * Правила правдоподобия (002_plausibility.sql) проверяются вызовом функции
 * score_problem — она только отвечает, ничего не записывая. Вставку
 * подделки скрипт пробует, лишь убедившись, что эта функция на месте:
 * без миграции 002 подделка легла бы в таблицу.
 *
 * Никнейм (003_nickname.sql) проверяется так же: функцией nick_valid.
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

/** Честный, но очень удачный забег: должен проходить всегда. */
const strongRun = {
  location: 'forest',
  hero: 'warden',
  time_sec: 540,
  kills: 1400,
  level: 45,
  damage: 260000,
  victory: true,
};

/** Подделки: у каждой одна неправдоподобная деталь. */
const fakes = [
  ['победа там, где нет босса', { ...strongRun, location: 'wasteland' }],
  ['победа раньше выхода босса', { ...strongRun, time_sec: 300 }],
  ['тысячи убийств за минуту', { ...strongRun, victory: false, time_sec: 60, kills: 5000, damage: 900000 }],
  ['убийства без урона', { ...strongRun, damage: 3000 }],
  ['урона больше, чем у врагов здоровья', { ...strongRun, damage: 999000000 }],
  ['сотый уровень при десятке убийств', { ...strongRun, victory: false, kills: 10, level: 100, damage: 2000 }],
];

/** Строка таблицы → параметры функции score_problem. */
const problemOf = (row) =>
  backend.rpc('score_problem', {
    p_location: row.location,
    p_time_sec: row.time_sec,
    p_kills: row.kills,
    p_level: row.level,
    p_damage: row.damage,
    p_victory: row.victory,
  });

const probe = await problemOf(strongRun);
if (probe.ok) {
  cases.push({
    name: 'честный удачный забег правдоподобен',
    run: () => problemOf(strongRun),
    pass: (r) => r.ok && r.data === null,
  });
  for (const [name, row] of fakes) {
    cases.push({
      name: `подделка отклонена: ${name}`,
      run: () => problemOf(row),
      pass: (r) => r.ok && typeof r.data === 'string',
    });
  }
  cases.push({
    name: 'неправдоподобную строку база не принимает',
    run: () => backend.request('POST', '', fakes[2][1], { Prefer: 'return=minimal' }),
    pass: (r) => r.error === CHECK,
  });
}

/**
 * Правило никнейма (003_nickname.sql) — тоже вызовом чистой функции nick_valid.
 * Колонку и право на неё проверяем строкой, которую база всё равно отклонит
 * (такой локации нет): ошибка check значит «колонка есть и право выдано».
 */
const goodNicks = ['ИГРОК', 'AB 12', 'X', 'ВОИН-7', 'ABCDEFGHIJKL'];
const badNicks = ['', 'lowercase', 'A  B', '-AB', 'AB-', 'ABCDEFGHIJKLM', '<SCRIPT>', 'ИГРОК_1'];
const nickValid = (nick) => backend.rpc('nick_valid', { p_nick: nick });

const nickProbe = await nickValid('ИГРОК');
if (nickProbe.ok) {
  for (const nick of goodNicks) {
    cases.push({
      name: `ник допустим: «${nick}»`,
      run: () => nickValid(nick),
      pass: (r) => r.ok && r.data === true,
    });
  }
  for (const nick of badNicks) {
    cases.push({
      name: `ник отклонён: «${nick}»`,
      run: () => nickValid(nick),
      pass: (r) => r.ok && r.data === false,
    });
  }
  cases.push({
    name: 'колонка nick есть, добавлять в неё можно',
    run: () => backend.request('POST', '', { ...badRow, nick: 'ИГРОК' }, { Prefer: 'return=minimal' }),
    pass: (r) => r.error === CHECK,
  });
}

let failed = 0;
for (const test of cases) {
  const result = await test.run();
  const ok = test.pass(result);
  if (!ok) failed += 1;
  const detail = result.ok ? `HTTP ${result.status}` : `HTTP ${result.status}, ${result.error}`;
  const reason = typeof result.data === 'string' ? ` — ${result.data}` : '';
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${test.name} (${detail})${reason}`);
}

if (!probe.ok) {
  failed += 1;
  console.log(`FAIL правила правдоподобия не найдены (HTTP ${probe.status}, ${probe.error})`);
  console.log('     Выполни supabase/migrations/002_plausibility.sql в SQL Editor.');
}

if (!nickProbe.ok) {
  failed += 1;
  console.log(`FAIL правило никнейма не найдено (HTTP ${nickProbe.status}, ${nickProbe.error})`);
  console.log('     Выполни supabase/migrations/003_nickname.sql в SQL Editor.');
}

console.log(failed === 0 ? '\nПравила доступа работают.' : `\nНе прошло проверок: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
