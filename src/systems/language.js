/**
 * Язык интерфейса: выбор игрока хранится в едином сохранении (save.js).
 * Пока игрок не выбирал, язык берётся из настроек браузера: русский —
 * русскоязычным, всем остальным английский.
 */

import { detectLanguage, isLanguage } from '../i18n/index.js';
import { patchSave, readSave } from './save.js';

/** Язык при запуске: сохранённый, иначе по списку языков браузера. */
export function loadLanguage(env = globalThis.navigator) {
  const saved = readSave().lang;
  if (isLanguage(saved)) return saved;
  const preferences = env?.languages?.length ? env.languages : [env?.language].filter(Boolean);
  return detectLanguage(preferences);
}

export function saveLanguage(id) {
  if (isLanguage(id)) patchSave({ lang: id });
}
