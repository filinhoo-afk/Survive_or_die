/**
 * Поддельный localStorage для тестов сохранения.
 *
 * В браузере хранилище одно на страницу, в тестах — своё у каждого теста:
 * useStorage() ставит чистое и сбрасывает кэш save.js, иначе одно сохранение
 * текло бы из теста в тест.
 */

import { resetSaveCache } from '../../src/systems/save.js';

export function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function install(value) {
  Object.defineProperty(globalThis, 'localStorage', { value, configurable: true, writable: true });
  resetSaveCache();
}

/** Чистое хранилище (или с готовыми записями); возвращает его для проверок. */
export function useStorage(initial) {
  const storage = fakeStorage(initial);
  install(storage);
  return storage;
}

/** Хранилище, которое бросает на любом обращении: приватный режим, запрет сайта. */
export function useBrokenStorage() {
  const fail = () => {
    throw new Error('SecurityError');
  };
  install({ getItem: fail, setItem: fail, removeItem: fail });
}

/** Убирает подделку после теста. */
export function dropStorage() {
  delete globalThis.localStorage;
  resetSaveCache();
}

/** Сравнение чисел с плавающей точкой. */
export function near(actual, expected, epsilon = 1e-9) {
  return Math.abs(actual - expected) <= epsilon;
}
