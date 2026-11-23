import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isUnlocked, loadCleared, markCleared } from '../src/systems/campaign.js';
import { readSave, resetSaveCache } from '../src/systems/save.js';
import { LOCATION_LIST } from '../src/locations/index.js';
import { dropStorage, useStorage } from './helpers/storage.js';

describe('кампания', () => {
  beforeEach(() => useStorage());
  afterEach(dropStorage);

  test('сначала ничего не пройдено', () => {
    assert.equal(loadCleared().size, 0);
  });

  test('пройденная локация запоминается и переживает перезагрузку', () => {
    const cleared = markCleared(new Set(), 'wasteland');
    assert.deepEqual([...cleared], ['wasteland']);
    resetSaveCache();
    assert.deepEqual([...loadCleared()], ['wasteland']);
  });

  test('повторное прохождение ничего не дублирует', () => {
    const once = markCleared(new Set(), 'forest');
    markCleared(once, 'forest');
    assert.deepEqual(readSave().cleared, ['forest']);
  });

  test('множество не мутируется: возвращается новое', () => {
    const before = new Set(['wasteland']);
    const after = markCleared(before, 'forest');
    assert.equal(before.size, 1);
    assert.equal(after.size, 2);
  });

  test('из сохранения читаются только строки', () => {
    useStorage({ 'survive-or-die:save': JSON.stringify({ version: 1, cleared: ['forest', 7, null, { a: 1 }] }) });
    assert.deepEqual([...loadCleared()], ['forest']);
  });

  test('не массив в сохранении — ничего не пройдено', () => {
    useStorage({ 'survive-or-die:save': JSON.stringify({ version: 1, cleared: 'forest' }) });
    assert.equal(loadCleared().size, 0);
  });
});

describe('isUnlocked', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  test('первая локация открыта всегда', () => {
    assert.equal(isUnlocked(list, 0, new Set()), true);
  });

  test('следующая открывается, когда пройдена предыдущая', () => {
    assert.equal(isUnlocked(list, 1, new Set()), false);
    assert.equal(isUnlocked(list, 1, new Set(['a'])), true);
  });

  test('через одну не перескочить', () => {
    assert.equal(isUnlocked(list, 2, new Set(['a'])), false);
    assert.equal(isUnlocked(list, 2, new Set(['b'])), true);
  });

  test('в настоящем списке локаций первая открыта, остальные закрыты', () => {
    const cleared = new Set();
    assert.equal(isUnlocked(LOCATION_LIST, 0, cleared), true);
    for (let i = 1; i < LOCATION_LIST.length; i += 1) assert.equal(isUnlocked(LOCATION_LIST, i, cleared), false);
  });

  test('проходя по порядку, открываешь всю кампанию', () => {
    const cleared = new Set(LOCATION_LIST.slice(0, -1).map((location) => location.id));
    for (let i = 0; i < LOCATION_LIST.length; i += 1) assert.equal(isUnlocked(LOCATION_LIST, i, cleared), true);
  });
});
