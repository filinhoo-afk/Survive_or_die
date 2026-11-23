import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, formatTime } from '../src/ui/format.js';

describe('formatTime', () => {
  test('минуты и секунды с ведущим нулём', () => {
    assert.equal(formatTime(0), '0:00');
    assert.equal(formatTime(5), '0:05');
    assert.equal(formatTime(65), '1:05');
    assert.equal(formatTime(600), '10:00');
  });

  test('дробные секунды отбрасываются, а не округляются', () => {
    assert.equal(formatTime(59.99), '0:59');
  });

  test('часы не выделяются — минут просто больше 59', () => {
    assert.equal(formatTime(3600), '60:00');
  });
});

describe('formatNumber', () => {
  test('разряды разделены обычными пробелами — другого пробела в пиксельном шрифте нет', () => {
    assert.equal(formatNumber(1234567), '1 234 567');
    assert.equal(formatNumber(999), '999');
    // Неразрывный (U+00A0) и узкий неразрывный (U+202F) пробелы, которые ставит toLocaleString.
    assert.ok(!/[\u00a0\u202f]/.test(formatNumber(1234567)));
  });

  test('округляет до целого', () => {
    assert.equal(formatNumber(12.4), '12');
    assert.equal(formatNumber(12.6), '13');
    assert.equal(formatNumber(0), '0');
  });
});
