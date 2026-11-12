/**
 * Прогресс кампании: какие локации пройдены (побеждён их босс).
 *
 * Локации идут по порядку: следующая открывается, когда пройдена
 * предыдущая. Первая открыта всегда. Хранит единое сохранение (save.js).
 */

import { patchSave, readSave } from './save.js';

export function loadCleared() {
  const saved = readSave().cleared;
  return new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []);
}

/** Запоминает пройденную локацию и возвращает обновлённое множество. */
export function markCleared(cleared, id) {
  const next = new Set(cleared).add(id);
  patchSave({ cleared: [...next] });
  return next;
}

/** Открыта ли локация с номером index в списке list. */
export function isUnlocked(list, index, cleared) {
  return index === 0 || cleared.has(list[index - 1].id);
}
