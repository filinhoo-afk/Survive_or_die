/**
 * Достижения: за что открываются, что копится между забегами, как переживает
 * перезагрузку и помещается ли всё на экран на обоих языках.
 */
import './helpers/dom.js';
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, loadAchievements, progressOf, recordRun, unlock } from '../src/systems/achievements.js';
import { TOAST_TIME, TOAST_WIDTH, LIST_WIDTH, createToasts, drawUnlockedList } from '../src/ui/achievementToast.js';
import { CARD_WIDTH, TEXT_LEFT, cardRect, drawAchievementsScreen } from '../src/ui/achievementsScreen.js';
import { DEFAULT_LANGUAGE, LANGUAGES, setLanguage, t } from '../src/i18n/index.js';
import { measureText } from '../src/gfx/font.js';
import { HEROES } from '../src/systems/heroes.js';
import { LOCATION_LIST } from '../src/locations/index.js';
import { readSave, resetSaveCache } from '../src/systems/save.js';
import { dropStorage, useBrokenStorage, useStorage } from './helpers/storage.js';

const SAVE_KEY = 'survive-or-die:save';
const saved = (fields) => ({ [SAVE_KEY]: JSON.stringify({ version: 1, ...fields }) });
const canvas = { width: 960, height: 540 };

const run = (fields = {}) => ({
  time: 0,
  kills: 0,
  level: 1,
  weapons: 1,
  evolved: 0,
  elites: 0,
  hurt: true,
  victory: false,
  locationId: 'wasteland',
  heroId: 'gunner',
  ...fields,
});

const ids = (list) => list.map((achievement) => achievement.id);

describe('за что открываются', () => {
  beforeEach(() => useStorage());
  afterEach(dropStorage);

  test('у каждого достижения свой id и цель', () => {
    assert.equal(new Set(ids(ACHIEVEMENTS)).size, ACHIEVEMENTS.length);
    for (const achievement of ACHIEVEMENTS) assert.ok(achievement.goal > 0, achievement.id);
  });

  test('пустой забег не даёт ничего', () => {
    const state = loadAchievements();
    const result = unlock(state, run());
    assert.deepEqual(result.fresh, []);
    assert.equal(result.state, state);
  });

  test('пороги одного забега: на единицу меньше — ещё нет, ровно — уже да', () => {
    const cases = [
      ['firstBlood', 'kills', 1],
      ['survivor', 'time', 300],
      ['reaper', 'kills', 500],
      ['veteran', 'level', 15],
      ['arsenal', 'weapons', 4],
      ['evolution', 'evolved', 1],
      ['hunter', 'elites', 10],
    ];
    for (const [id, field, goal] of cases) {
      const state = loadAchievements();
      assert.ok(!ids(unlock(state, run({ [field]: goal - 1 })).fresh).includes(id), `${id}: рано`);
      assert.ok(ids(unlock(state, run({ [field]: goal })).fresh).includes(id), `${id}: не открылось`);
      useStorage();
    }
  });

  test('«ни царапины» — только минута без урона', () => {
    const state = loadAchievements();
    assert.deepEqual(ids(unlock(state, run({ time: 59, hurt: false })).fresh), []);
    assert.deepEqual(ids(unlock(state, run({ time: 60, hurt: true })).fresh), []);
    assert.deepEqual(ids(unlock(state, run({ time: 60, hurt: false })).fresh), ['untouched']);
  });

  test('за каждого босса кампании есть достижение, и нужна именно победа', () => {
    for (const location of LOCATION_LIST.filter((l) => l.boss)) {
      const achievement = ACHIEVEMENTS.find((a) => a.locationId === location.id);
      assert.ok(achievement, location.id);
      assert.equal(achievement.id, location.boss);
      useStorage();
      const state = loadAchievements();
      assert.deepEqual(ids(unlock(state, run({ locationId: location.id })).fresh), []);
      assert.deepEqual(ids(unlock(state, run({ locationId: location.id, victory: true })).fresh), [achievement.id]);
    }
  });

  test('открытое не открывается второй раз', () => {
    const first = unlock(loadAchievements(), run({ kills: 3 }));
    assert.deepEqual(ids(first.fresh), ['firstBlood']);
    assert.deepEqual(unlock(first.state, run({ kills: 4 })).fresh, []);
  });

  test('прежнее состояние не меняется — возвращается новое', () => {
    const state = loadAchievements();
    const result = unlock(state, run({ kills: 1 }));
    assert.equal(state.unlocked.size, 0);
    assert.equal(result.state.unlocked.size, 1);
  });
});

describe('накопительные', () => {
  beforeEach(() => useStorage());
  afterEach(dropStorage);

  const legion = ACHIEVEMENTS.find((a) => a.id === 'legion');
  const trio = ACHIEVEMENTS.find((a) => a.id === 'trio');

  test('убийства складываются по законченным забегам', () => {
    let state = loadAchievements();
    state = recordRun(state, run({ kills: 400 })).state;
    state = recordRun(state, run({ kills: 100 })).state;
    assert.equal(state.kills, 500);
    assert.deepEqual(progressOf(state, legion), { value: 500, goal: 5000 });
  });

  test('«легион» открывается и посреди забега, а забег не считается дважды', () => {
    const state = recordRun(loadAchievements(), run({ kills: 4900 })).state;
    assert.ok(!ids(unlock(state, run({ kills: 99 })).fresh).includes('legion'));
    const live = unlock(state, run({ kills: 100 }));
    assert.ok(ids(live.fresh).includes('legion'));
    assert.equal(live.state.kills, 4900, 'идущий забег в общий счёт ещё не вошёл');
    assert.equal(recordRun(live.state, run({ kills: 100 })).state.kills, 5000);
  });

  test('«трое героев» — победа каждым, в любом порядке и с повторами', () => {
    let state = loadAchievements();
    const win = (heroId) => recordRun(state, run({ victory: true, locationId: 'forest', heroId }));
    state = win('gunner').state;
    state = win('gunner').state;
    assert.deepEqual(progressOf(state, trio), { value: 1, goal: HEROES.length });
    state = win('warden').state;
    state = recordRun(state, run({ heroId: 'thrower' })).state;
    assert.equal(progressOf(state, trio).value, 2, 'поражение героя не засчитывает');
    const last = win('thrower');
    assert.ok(ids(last.fresh).includes('trio'));
    assert.deepEqual(progressOf(last.state, trio), { value: 3, goal: 3 });
  });

  test('у достижений одного забега хода нет', () => {
    const state = loadAchievements();
    assert.equal(progressOf(state, ACHIEVEMENTS.find((a) => a.id === 'reaper')), null);
  });
});

describe('сохранение', () => {
  afterEach(dropStorage);

  test('открытое и накопленное переживают перезагрузку', () => {
    useStorage();
    recordRun(loadAchievements(), run({ kills: 20, victory: true, locationId: 'forest', heroId: 'warden' }));
    resetSaveCache();
    const state = loadAchievements();
    assert.deepEqual([...state.unlocked].sort(), ['firstBlood', 'guardian']);
    assert.equal(state.kills, 20);
    assert.deepEqual([...state.heroes], ['warden']);
  });

  test('открытое по ходу забега записывается сразу', () => {
    useStorage();
    unlock(loadAchievements(), run({ kills: 1 }));
    assert.deepEqual(readSave().achievements.unlocked, ['firstBlood']);
  });

  test('игравшему раньше открывается то, что доказывают рекорд и кампания', () => {
    useStorage(saved({ record: { runs: 5, time: 320, kills: 640, level: 12, damage: 100 }, cleared: ['forest', 'ruins'] }));
    const state = loadAchievements();
    assert.deepEqual([...state.unlocked].sort(), ['firstBlood', 'guardian', 'necromancer', 'reaper', 'survivor']);
    assert.equal(state.kills, 0);
  });

  test('испорченная запись не роняет игру и чужих id не приносит', () => {
    useStorage(saved({ achievements: { unlocked: ['reaper', 'нет-такого', 7], kills: 'много', heroes: 'все' } }));
    const state = loadAchievements();
    assert.deepEqual([...state.unlocked], ['reaper']);
    assert.equal(state.kills, 0);
    assert.equal(state.heroes.size, 0);
    useStorage(saved({ achievements: 'мусор' }));
    assert.equal(loadAchievements().unlocked.size, 0);
  });

  test('без хранилища достижения живут в памяти', () => {
    useBrokenStorage();
    unlock(loadAchievements(), run({ kills: 1 }));
    assert.ok(loadAchievements().unlocked.has('firstBlood'));
  });
});

describe('всплывашки', () => {
  test('показываются по одной и гаснут по времени', () => {
    const toasts = createToasts();
    assert.equal(toasts.current, null);
    toasts.push(ACHIEVEMENTS.slice(0, 2));
    assert.equal(toasts.current.id, ACHIEVEMENTS[0].id);
    toasts.update(TOAST_TIME - 0.1);
    assert.equal(toasts.current.id, ACHIEVEMENTS[0].id);
    toasts.update(0.2);
    assert.equal(toasts.current.id, ACHIEVEMENTS[1].id);
    toasts.update(TOAST_TIME);
    assert.equal(toasts.current, null);
  });

  test('пока очередь пуста, время не копится', () => {
    const toasts = createToasts();
    toasts.update(100);
    toasts.push([ACHIEVEMENTS[0]]);
    toasts.update(0.1);
    assert.equal(toasts.current.id, ACHIEVEMENTS[0].id);
  });

  test('новый забег очищает очередь', () => {
    const toasts = createToasts();
    toasts.push(ACHIEVEMENTS);
    toasts.clear();
    assert.equal(toasts.current, null);
  });
});

describe('на экране', () => {
  afterEach(() => {
    setLanguage(DEFAULT_LANGUAGE);
    dropStorage();
  });

  const recorder = () => {
    const calls = [];
    return { calls, ctx: new Proxy({}, { get: (_, name) => () => calls.push(name), set: () => true }) };
  };

  test('все карточки помещаются на экран над подсказкой', () => {
    for (let i = 0; i < ACHIEVEMENTS.length; i += 1) {
      const rect = cardRect(i, canvas);
      assert.ok(rect.x >= 0 && rect.x + rect.width <= canvas.width, ACHIEVEMENTS[i].id);
      assert.ok(rect.y + rect.height <= canvas.height - 32, ACHIEVEMENTS[i].id);
    }
  });

  test('тексты помещаются в карточку, всплывашку и колонку итогов на обоих языках', () => {
    useStorage();
    for (const { id } of LANGUAGES) {
      setLanguage(id);
      for (const achievement of ACHIEVEMENTS) {
        const room = CARD_WIDTH - TEXT_LEFT - 14;
        const counter = achievement.lifetime ? measureText(`${achievement.goal}/${achievement.goal}  `, 2) : 0;
        assert.ok(measureText(achievement.title, 2) + counter <= room, `${id}: ${achievement.title}`);
        assert.ok(measureText(achievement.desc, 2) <= room, `${id}: ${achievement.desc}`);
        assert.ok(measureText(achievement.title, 2) <= TOAST_WIDTH - 24, `${id}: ${achievement.title}`);
        for (const word of achievement.title.split(' ')) {
          assert.ok(measureText(word, 2) <= LIST_WIDTH - 16, `${id}: ${word}`);
        }
      }
      assert.ok(measureText(t('achievements.new'), 2) <= LIST_WIDTH, id);
      // Строка в меню не должна дотянуться до даты испытания дня по центру.
      const line = t('menu.achievements', { count: 14, total: 14 });
      const daily = t('menu.daily.title', { date: '2026-11-26' });
      assert.ok(16 + measureText(line, 2) < (canvas.width - measureText(daily, 2)) / 2, `${id}: ${line}`);
    }
  });

  test('экран достижений рисуется и пустым, и открытым', () => {
    useStorage();
    const { ctx, calls } = recorder();
    drawAchievementsScreen(ctx, canvas, loadAchievements());
    drawAchievementsScreen(ctx, canvas, { unlocked: new Set(ids(ACHIEVEMENTS)), kills: 9000, heroes: new Set() });
    assert.ok(calls.includes('fillRect'));
  });

  test('колонка итогов молчит без новых достижений и переживает все сразу', () => {
    const { ctx, calls } = recorder();
    drawUnlockedList(ctx, []);
    assert.deepEqual(calls, []);
    drawUnlockedList(ctx, ACHIEVEMENTS);
    assert.ok(calls.includes('drawImage'));
  });

  test('полная колонка итогов не уходит за нижний край экрана', () => {
    let bottom = 0;
    const ctx = new Proxy(
      {},
      {
        get: (_, name) => (...args) => {
          if (name === 'fillRect') bottom = Math.max(bottom, args[1] + args[3]);
        },
        set: () => true,
      },
    );
    for (const { id } of LANGUAGES) {
      setLanguage(id);
      drawUnlockedList(ctx, ACHIEVEMENTS);
    }
    assert.ok(bottom > 0 && bottom <= canvas.height - 20, String(bottom));
  });
});
