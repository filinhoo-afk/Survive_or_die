/**
 * Единое сохранение прогресса: одна запись в localStorage вместо россыпи
 * ключей. В ней всё, что должно пережить перезагрузку: пройденные локации,
 * золото и улучшения, рекорд, выбранный герой и последняя локация.
 *
 * Запись версионируется. Первое чтение подбирает данные из старых ключей
 * (до дня 51 каждая система хранила своё отдельно) и переносит их в новую
 * запись. Хранилище бывает недоступно, поэтому копия держится ещё и в памяти:
 * прогресс проживёт хотя бы до перезагрузки страницы.
 */

const SAVE_KEY = 'survive-or-die:save';
export const SAVE_VERSION = 1;

/** Старые ключи: из них переезжаем, после переезда удаляем. */
const LEGACY = {
  cleared: 'survive-or-die:campaign',
  meta: 'survive-or-die:meta',
  record: 'survive-or-die:record',
  hero: 'survive-or-die:hero',
};

let cache = null;

function emptySave() {
  return { version: SAVE_VERSION, cleared: [], meta: null, record: null, hero: null, location: null };
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function migrateLegacy() {
  const save = emptySave();
  const cleared = readJson(LEGACY.cleared);
  if (Array.isArray(cleared)) save.cleared = cleared;
  save.meta = readJson(LEGACY.meta);
  save.record = readJson(LEGACY.record);
  try {
    save.hero = localStorage.getItem(LEGACY.hero);
  } catch {
    // Нет доступа — героя выберем заново.
  }
  return save;
}

function persist(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    for (const key of Object.values(LEGACY)) localStorage.removeItem(key);
  } catch {
    // Не сохранилось — живёт в памяти до перезагрузки страницы.
  }
}

/** Текущее сохранение; поля нужно проверять самим — запись могла испортиться. */
export function readSave() {
  if (cache) return cache;
  const saved = readJson(SAVE_KEY);
  if (saved && typeof saved === 'object' && saved.version === SAVE_VERSION) {
    cache = { ...emptySave(), ...saved };
  } else {
    cache = migrateLegacy();
    persist(cache);
  }
  return cache;
}

/** Обновляет часть сохранения и записывает его. */
export function patchSave(patch) {
  cache = { ...readSave(), ...patch };
  persist(cache);
}

/** Забывает кэш — для проверок и для «сбросить прогресс». */
export function resetSaveCache() {
  cache = null;
}
