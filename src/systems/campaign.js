/**
 * Прогресс кампании: какие локации пройдены (побеждён их босс).
 *
 * Локации идут по порядку: следующая открывается, когда пройдена
 * предыдущая. Первая открыта всегда. Хранилище бывает недоступно,
 * поэтому любая ошибка localStorage превращается в «ничего не пройдено».
 */

const STORAGE_KEY = 'survive-or-die:campaign';

export function loadCleared() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return new Set(saved.filter((id) => typeof id === 'string'));
  } catch {
    // Испорченная запись или нет доступа — кампания с нуля.
  }
  return new Set();
}

/** Запоминает пройденную локацию и возвращает обновлённое множество. */
export function markCleared(cleared, id) {
  const next = new Set(cleared).add(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Не сохранилось — прогресс проживёт до перезагрузки страницы.
  }
  return next;
}

/** Открыта ли локация с номером index в списке list. */
export function isUnlocked(list, index, cleared) {
  return index === 0 || cleared.has(list[index - 1].id);
}
