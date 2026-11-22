import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_VERSION, patchSave, readSave, resetSaveCache } from '../src/systems/save.js';
import { dropStorage, useBrokenStorage, useStorage } from './helpers/storage.js';

const KEY = 'survive-or-die:save';

describe('единое сохранение', () => {
  afterEach(dropStorage);

  test('в пустом хранилище — пустое сохранение текущей версии', () => {
    useStorage();
    assert.deepEqual(readSave(), {
      version: SAVE_VERSION,
      cleared: [],
      meta: null,
      record: null,
      hero: null,
      location: null,
      settings: null,
      nick: null,
    });
  });

  test('первое чтение сразу записывает сохранение в хранилище', () => {
    const storage = useStorage();
    readSave();
    assert.equal(JSON.parse(storage.data.get(KEY)).version, SAVE_VERSION);
  });

  test('переезд со старых ключей: данные переносятся, старые ключи удаляются', () => {
    const storage = useStorage({
      'survive-or-die:campaign': JSON.stringify(['wasteland', 'forest']),
      'survive-or-die:meta': JSON.stringify({ gold: 120, levels: { might: 2 } }),
      'survive-or-die:record': JSON.stringify({ runs: 3, kills: 500 }),
      'survive-or-die:hero': 'warden',
    });

    const save = readSave();
    assert.deepEqual(save.cleared, ['wasteland', 'forest']);
    assert.deepEqual(save.meta, { gold: 120, levels: { might: 2 } });
    assert.deepEqual(save.record, { runs: 3, kills: 500 });
    assert.equal(save.hero, 'warden');

    for (const old of ['campaign', 'meta', 'record', 'hero']) {
      assert.equal(storage.getItem(`survive-or-die:${old}`), null, `старый ключ ${old} остался`);
    }
    assert.equal(JSON.parse(storage.getItem(KEY)).hero, 'warden');
  });

  test('сломанные старые ключи не мешают переезду', () => {
    useStorage({ 'survive-or-die:campaign': '{не json', 'survive-or-die:meta': 'null' });
    const save = readSave();
    assert.deepEqual(save.cleared, []);
    assert.equal(save.meta, null);
  });

  test('записанное сохранение читается заново после перезагрузки страницы', () => {
    useStorage();
    patchSave({ nick: 'BOB', cleared: ['forest'] });
    resetSaveCache();
    assert.equal(readSave().nick, 'BOB');
    assert.deepEqual(readSave().cleared, ['forest']);
  });

  test('patchSave меняет только указанные поля', () => {
    useStorage();
    patchSave({ hero: 'thrower' });
    patchSave({ nick: 'BOB' });
    assert.equal(readSave().hero, 'thrower');
    assert.equal(readSave().nick, 'BOB');
  });

  test('чтение дополняет недостающие поля — запись могла быть сделана до их появления', () => {
    useStorage({ [KEY]: JSON.stringify({ version: SAVE_VERSION, cleared: ['wasteland'] }) });
    const save = readSave();
    assert.deepEqual(save.cleared, ['wasteland']);
    assert.equal(save.settings, null);
    assert.equal(save.nick, null);
  });

  test('испорченный JSON не роняет игру', () => {
    useStorage({ [KEY]: '{oops' });
    assert.equal(readSave().version, SAVE_VERSION);
    assert.deepEqual(readSave().cleared, []);
  });

  test('запись чужой версии не читается как своя', () => {
    useStorage({ [KEY]: JSON.stringify({ version: SAVE_VERSION + 1, nick: 'FUTURE' }) });
    assert.equal(readSave().nick, null);
  });

  test('хранилище недоступно — прогресс живёт в памяти до перезагрузки', () => {
    useBrokenStorage();
    assert.doesNotThrow(() => readSave());
    patchSave({ nick: 'BOB' });
    assert.equal(readSave().nick, 'BOB');
  });

  test('хранилища нет вовсе — то же самое', () => {
    dropStorage();
    patchSave({ hero: 'warden' });
    assert.equal(readSave().hero, 'warden');
  });
});
