import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { RECORD_FIELDS, loadRecord, submitRun } from '../src/systems/records.js';
import { dropStorage, useStorage } from './helpers/storage.js';

const run = (overrides = {}) => ({ time: 60, kills: 50, level: 3, damage: 1000, ...overrides });

describe('локальный рекорд', () => {
  beforeEach(() => useStorage());
  afterEach(dropStorage);

  test('рекорда пока нет', () => {
    assert.deepEqual(loadRecord(), { runs: 0, time: 0, kills: 0, level: 0, damage: 0 });
  });

  test('первый забег записывается, но рекордом не считается — бить было нечего', () => {
    const { previous, record, beaten } = submitRun(run());
    assert.equal(previous.runs, 0);
    assert.equal(record.runs, 1);
    assert.equal(record.kills, 50);
    assert.equal(beaten.size, 0);
  });

  test('второй забег побивает только те показатели, где вышло лучше', () => {
    submitRun(run());
    const { record, beaten } = submitRun(run({ kills: 80, time: 30 }));
    assert.deepEqual([...beaten], ['kills']);
    assert.equal(record.kills, 80);
    assert.equal(record.time, 60);
    assert.equal(record.runs, 2);
  });

  test('худший забег рекорд не снижает', () => {
    submitRun(run());
    const { record, beaten } = submitRun(run({ time: 5, kills: 1, level: 1, damage: 1 }));
    assert.equal(beaten.size, 0);
    assert.deepEqual(
      Object.fromEntries(RECORD_FIELDS.map((field) => [field, record[field]])),
      { time: 60, kills: 50, level: 3, damage: 1000 },
    );
  });

  test('равный результат рекордом не считается', () => {
    submitRun(run());
    assert.equal(submitRun(run()).beaten.size, 0);
  });

  test('рекорд переживает перезагрузку', () => {
    submitRun(run());
    useStorage(Object.fromEntries(globalThis.localStorage.data));
    assert.equal(loadRecord().kills, 50);
  });

  test('испорченные поля при чтении обнуляются', () => {
    useStorage({
      'survive-or-die:save': JSON.stringify({ version: 1, record: { runs: 4, time: -3, kills: 'много', level: 7, damage: NaN } }),
    });
    assert.deepEqual(loadRecord(), { runs: 4, time: 0, kills: 0, level: 7, damage: 0 });
  });
});
