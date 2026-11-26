/**
 * Обучение: шаги сменяются по делам игрока и по времени, кому его показывать —
 * решается по сохранению, а каждая подсказка помещается в свою рамку.
 */
import './helpers/dom.js';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SKIP_DELAY,
  STEP_DONE_TIME,
  STEP_MIN_TIME,
  TUTORIAL_STEPS,
  Tutorial,
  loadTutorialPending,
  saveTutorialPending,
} from '../src/systems/tutorial.js';
import { HINT_WIDTH, drawTutorialHint, movementKeys } from '../src/ui/tutorialHint.js';
import { DEFAULT_LANGUAGE, LANGUAGES, setLanguage, t } from '../src/i18n/index.js';
import { measureText } from '../src/gfx/font.js';
import { DEFAULT_BINDINGS } from '../src/systems/settings.js';
import { readSave } from '../src/systems/save.js';
import { dropStorage, useBrokenStorage, useStorage } from './helpers/storage.js';

const SAVE_KEY = 'survive-or-die:save';
const saved = (fields) => ({ [SAVE_KEY]: JSON.stringify({ version: 1, ...fields }) });

/** Крутит обучение seconds секунд мелкими кадрами; true, если оно на этом отрезке закончилось. */
function run(tutorial, seconds) {
  let finished = false;
  for (let left = seconds; left > 1e-9; left -= 0.05) finished = tutorial.update(Math.min(0.05, left)) || finished;
  return finished;
}

/** Выполняет всё, что нужно текущему шагу, и дожидается следующего. */
function pass(tutorial) {
  const step = tutorial.step;
  if (step.duration) return run(tutorial, step.duration + STEP_DONE_TIME + 0.1);
  tutorial.add(step.counter, step.goal);
  return run(tutorial, STEP_MIN_TIME + STEP_DONE_TIME + 0.1);
}

describe('шаги обучения', () => {
  test('у каждого шага есть либо цель, либо время показа', () => {
    const ids = TUTORIAL_STEPS.map((step) => step.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const step of TUTORIAL_STEPS) {
      if (step.duration) assert.ok(step.duration > 0, step.id);
      else {
        assert.ok(step.counter in new Tutorial().counters, step.id);
        assert.ok(step.goal > 0, step.id);
      }
    }
  });

  test('начинается с движения и не идёт дальше без дела', () => {
    const tutorial = new Tutorial();
    assert.equal(tutorial.step.id, 'move');
    run(tutorial, 30);
    assert.equal(tutorial.step.id, 'move');
    assert.equal(tutorial.progress, 0);
  });

  test('выполненный шаг горит «готово» и сменяется следующим', () => {
    const tutorial = new Tutorial();
    tutorial.add('distance', 120);
    assert.equal(tutorial.progress, 0.5);
    tutorial.add('distance', 120);
    run(tutorial, STEP_MIN_TIME + 0.05);
    assert.equal(tutorial.step.id, 'move');
    assert.notEqual(tutorial.completed, null);
    assert.equal(tutorial.progress, 1);
    run(tutorial, STEP_DONE_TIME + 0.05);
    assert.equal(tutorial.step.id, 'attack');
    assert.equal(tutorial.completed, null);
  });

  test('сделанное заранее засчитывается, но подсказка всё равно успевает прочитаться', () => {
    const tutorial = new Tutorial();
    tutorial.add('kills', 5);
    pass(tutorial);
    assert.equal(tutorial.step.id, 'attack');
    assert.equal(tutorial.count, 3, 'счётчик не показывает больше цели');
    run(tutorial, 1);
    assert.equal(tutorial.completed, null);
    run(tutorial, STEP_MIN_TIME);
    assert.equal(tutorial.step.id, 'gems');
  });

  test('счётчик «2/3» есть только у шагов, где считать понятно', () => {
    const tutorial = new Tutorial();
    assert.equal(tutorial.count, null);
    pass(tutorial);
    tutorial.add('kills', 2);
    assert.equal(tutorial.count, 2);
  });

  test('неизвестный счётчик и отрицательные числа ничего не меняют', () => {
    const tutorial = new Tutorial();
    tutorial.add('gold', 10);
    tutorial.add('distance', -50);
    tutorial.add('kills', 0);
    assert.deepEqual(tutorial.counters, { distance: 0, kills: 0, xp: 0, upgrades: 0 });
  });

  test('все шаги по очереди заканчивают обучение, и об этом сообщается один раз', () => {
    const tutorial = new Tutorial();
    const order = [];
    let finished = 0;
    while (!tutorial.finished) {
      order.push(tutorial.step.id);
      if (pass(tutorial)) finished += 1;
    }
    assert.deepEqual(order, TUTORIAL_STEPS.map((step) => step.id));
    assert.equal(finished, 1);
    assert.equal(tutorial.step, null);
    assert.equal(tutorial.update(1), false);
  });

  test('пропустить можно не в первую секунду', () => {
    const tutorial = new Tutorial();
    assert.equal(tutorial.canSkip, false);
    run(tutorial, SKIP_DELAY + 0.05);
    assert.equal(tutorial.canSkip, true);
    tutorial.skip();
    assert.equal(tutorial.finished, true);
    assert.equal(tutorial.canSkip, false);
    assert.equal(tutorial.step, null);
  });
});

describe('кому показывать обучение', () => {
  afterEach(dropStorage);

  test('новичку — да, и решение сразу записывается', () => {
    useStorage();
    assert.equal(loadTutorialPending(), true);
    assert.equal(readSave().tutorial, 'pending');
  });

  test('новичок остаётся с обучением после первой гибели и перезагрузки', () => {
    useStorage(saved({ tutorial: 'pending', record: { runs: 1 } }));
    assert.equal(loadTutorialPending(), true);
  });

  test('уже игравшему — нет', () => {
    const veterans = [
      { record: { runs: 4 } },
      { meta: { gold: 12 } },
      { meta: { gold: 0, levels: { might: 1 } } },
      { cleared: ['forest'] },
    ];
    for (const fields of veterans) {
      useStorage(saved(fields));
      assert.equal(loadTutorialPending(), false, JSON.stringify(fields));
      assert.equal(readSave().tutorial, 'done');
    }
  });

  test('пустые поля прогресса — это ещё новичок', () => {
    useStorage(saved({ record: { runs: 0 }, meta: { gold: 0, levels: {} }, cleared: [] }));
    assert.equal(loadTutorialPending(), true);
  });

  test('пройденное не возвращается, включённое в настройках — возвращается', () => {
    useStorage();
    saveTutorialPending(false);
    assert.equal(loadTutorialPending(), false);
    saveTutorialPending(true);
    assert.equal(loadTutorialPending(), true);
  });

  test('без хранилища игра не падает', () => {
    useBrokenStorage();
    assert.equal(loadTutorialPending(), true);
    saveTutorialPending(false);
    assert.equal(loadTutorialPending(), false);
  });
});

describe('подсказка на экране', () => {
  afterEach(() => setLanguage(DEFAULT_LANGUAGE));

  test('клавиши берутся из назначений игрока', () => {
    assert.equal(movementKeys(DEFAULT_BINDINGS), 'W A S D');
    const arrows = { up: ['ArrowUp', null], left: [null, 'ArrowLeft'], down: ['KeyK', 'KeyS'], right: ['KeyL', null] };
    assert.equal(movementKeys(arrows), '↑ ← K L');
  });

  test('все тексты помещаются в рамку на обоих языках', () => {
    // Самые длинные названия клавиш, какие бывают после переназначения.
    const keys = 'NUM 8 NUM 4 NUM 2 NUM 6';
    for (const { id } of LANGUAGES) {
      setLanguage(id);
      const texts = [...TUTORIAL_STEPS.map((step) => t(step.textKey, { keys })), t('tutorial.skip')];
      for (const text of texts) assert.ok(measureText(text, 2) <= HINT_WIDTH - 32, `${id}: ${text}`);
    }
  });

  test('рисуется на каждом шаге и молчит после конца', () => {
    const calls = [];
    const ctx = new Proxy({}, { get: (_, name) => () => calls.push(name), set: () => true });
    const canvas = { width: 960, height: 540 };
    const tutorial = new Tutorial();
    while (!tutorial.finished) {
      calls.length = 0;
      drawTutorialHint(ctx, canvas, tutorial, DEFAULT_BINDINGS);
      assert.ok(calls.includes('fillRect'), tutorial.step.id);
      pass(tutorial);
    }
    calls.length = 0;
    drawTutorialHint(ctx, canvas, tutorial, DEFAULT_BINDINGS);
    assert.deepEqual(calls, []);
  });
});
