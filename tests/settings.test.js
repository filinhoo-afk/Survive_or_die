import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BINDING_ACTIONS,
  DEFAULT_BINDINGS,
  RESERVED_KEYS,
  clampVolume,
  defaultSettings,
  keyLabel,
  loadSettings,
  rebind,
  sanitize,
  saveSettings,
} from '../src/systems/settings.js';
import { dropStorage, useStorage } from './helpers/storage.js';

/** Ни одна клавиша не отвечает за два действия, и у каждого действия есть хоть одна. */
function assertConsistent(bindings) {
  const seen = new Map();
  for (const { id } of BINDING_ACTIONS) {
    const keys = bindings[id].filter(Boolean);
    assert.ok(keys.length > 0, `у действия ${id} нет клавиш`);
    for (const key of keys) {
      assert.ok(!seen.has(key), `${key} занята и под ${seen.get(key)}, и под ${id}`);
      seen.set(key, id);
    }
  }
}

describe('clampVolume', () => {
  test('зажимает в [0, 1] и округляет до шага в 10 %', () => {
    assert.equal(clampVolume(0.5), 0.5);
    assert.equal(clampVolume(1.7), 1);
    assert.equal(clampVolume(-3), 0);
    assert.equal(clampVolume(0.34), 0.3);
    assert.equal(clampVolume(0.36), 0.4);
  });

  test('мусор — полная громкость', () => {
    for (const value of [NaN, Infinity, -Infinity, undefined]) assert.equal(clampVolume(value), 1);
  });
});

describe('defaultSettings', () => {
  test('полная громкость и клавиши по умолчанию', () => {
    const settings = defaultSettings();
    assert.equal(settings.master, 1);
    assert.deepEqual(settings.bindings, DEFAULT_BINDINGS);
    assertConsistent(settings.bindings);
  });

  test('каждый вызов даёт свою копию: правка одной не портит умолчания', () => {
    const settings = defaultSettings();
    settings.bindings.up[0] = 'KeyZ';
    assert.equal(DEFAULT_BINDINGS.up[0], 'KeyW');
    assert.equal(defaultSettings().bindings.up[0], 'KeyW');
  });

  test('клавиши по умолчанию не зарезервированы', () => {
    for (const slots of Object.values(DEFAULT_BINDINGS)) {
      for (const key of slots) assert.equal(RESERVED_KEYS.has(key), false, key);
    }
  });
});

describe('sanitize', () => {
  test('не объект — настройки по умолчанию', () => {
    for (const raw of [null, undefined, 5, 'text', []]) assert.deepEqual(sanitize(raw), defaultSettings());
  });

  test('громкость очищается по каналам', () => {
    const settings = sanitize({ master: 0.55, music: 'громко', sfx: 9 });
    assert.equal(settings.master, 0.6);
    assert.equal(settings.music, 1);
    assert.equal(settings.sfx, 1);
  });

  test('хорошие клавиши сохраняются', () => {
    const bindings = { up: ['KeyU', null], down: ['KeyK', 'ArrowDown'], left: ['KeyJ', null], right: ['KeyL', null] };
    assert.deepEqual(sanitize({ bindings }).bindings, bindings);
  });

  test('зарезервированные клавиши выбрасываются', () => {
    const settings = sanitize({ bindings: { up: ['Escape', 'KeyU'], down: ['Enter', 'F3'] } });
    assert.deepEqual(settings.bindings.up, [null, 'KeyU']);
    assert.deepEqual(settings.bindings.down, DEFAULT_BINDINGS.down);
  });

  test('одна клавиша на два действия остаётся только за первым', () => {
    const settings = sanitize({
      bindings: { up: ['KeyW', 'ArrowUp'], down: ['KeyW', 'KeyS'], left: DEFAULT_BINDINGS.left, right: DEFAULT_BINDINGS.right },
    });
    assert.deepEqual(settings.bindings.down, [null, 'KeyS']);
    assertConsistent(settings.bindings);
  });

  test('действие без единой клавиши получает умолчание', () => {
    const settings = sanitize({ bindings: { up: [], left: [null, 42], right: 'KeyD' } });
    assert.deepEqual(settings.bindings.up, DEFAULT_BINDINGS.up);
    assert.deepEqual(settings.bindings.left, DEFAULT_BINDINGS.left);
    assert.deepEqual(settings.bindings.right, DEFAULT_BINDINGS.right);
  });
});

describe('rebind', () => {
  test('новая клавиша становится основной, прежняя уходит в запасную', () => {
    const next = rebind(defaultSettings(), 'up', 'KeyU');
    assert.deepEqual(next.bindings.up, ['KeyU', 'KeyW']);
    assertConsistent(next.bindings);
  });

  test('зарезервированная клавиша отклоняется', () => {
    for (const key of ['Escape', 'Enter', 'KeyP', 'Digit1']) assert.equal(rebind(defaultSettings(), 'up', key), null, key);
  });

  test('не меняет исходные настройки', () => {
    const settings = defaultSettings();
    rebind(settings, 'up', 'KeyU');
    assert.deepEqual(settings, defaultSettings());
  });

  test('клавиша другого действия переезжает: оттуда она снимается', () => {
    const next = rebind(defaultSettings(), 'up', 'KeyD');
    assert.deepEqual(next.bindings.up, ['KeyD', 'KeyW']);
    assert.deepEqual(next.bindings.right, [null, 'ArrowRight']);
    assertConsistent(next.bindings);
  });

  test('основная клавиша того же действия — ничего не меняется', () => {
    assert.deepEqual(rebind(defaultSettings(), 'up', 'KeyW').bindings, DEFAULT_BINDINGS);
  });

  test('запасная клавиша того же действия — они меняются местами', () => {
    assert.deepEqual(rebind(defaultSettings(), 'up', 'ArrowUp').bindings.up, ['ArrowUp', 'KeyW']);
  });

  test('если у другого действия отняли единственную клавишу, ему возвращаются свободные умолчания', () => {
    const settings = {
      ...defaultSettings(),
      bindings: { ...DEFAULT_BINDINGS, right: ['KeyD', null] },
    };
    // Клавишу KeyD у «вправо» забираем, а KeyD по умолчанию его: свободна только запасная.
    const next = rebind(settings, 'up', 'KeyD');
    assert.deepEqual(next.bindings.right, ['ArrowRight', null]);
    assertConsistent(next.bindings);
  });

  test('отнять у действия последнюю клавишу, когда вернуть нечего, нельзя', () => {
    // Вверх забрал KeyD, у «вправо» осталась одна ArrowRight; заберём и её.
    const once = rebind(defaultSettings(), 'up', 'KeyD');
    assert.equal(rebind(once, 'up', 'ArrowRight'), null);
  });

  test('любая последовательность переназначений оставляет настройки согласованными', () => {
    const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyU', 'KeyJ'];
    let seed = 12345;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed;
    };

    let settings = defaultSettings();
    for (let step = 0; step < 500; step += 1) {
      const action = BINDING_ACTIONS[next() % BINDING_ACTIONS.length].id;
      const result = rebind(settings, action, keys[next() % keys.length]);
      if (result) settings = result;
      assertConsistent(settings.bindings);
    }
  });
});

describe('keyLabel', () => {
  test('человекочитаемые подписи', () => {
    assert.equal(keyLabel(null), '—');
    assert.equal(keyLabel('ArrowUp'), '↑');
    assert.equal(keyLabel('KeyW'), 'W');
    assert.equal(keyLabel('Digit4'), '4');
    assert.equal(keyLabel('Numpad8'), 'NUM 8');
    assert.equal(keyLabel('ShiftLeft'), 'SHIFTLEFT');
  });
});

describe('настройки в сохранении', () => {
  beforeEach(() => useStorage());
  afterEach(dropStorage);

  test('сохранённые настройки читаются обратно', () => {
    const settings = { ...defaultSettings(), music: 0.3 };
    saveSettings(settings);
    assert.equal(loadSettings().music, 0.3);
  });

  test('без сохранения — умолчания', () => {
    assert.deepEqual(loadSettings(), defaultSettings());
  });
});
