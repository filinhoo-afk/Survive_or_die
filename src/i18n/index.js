/**
 * Локализация: словари ru / en и функция t(). Весь видимый игроку текст лежит
 * в словарях, а код ссылается на него по ключу.
 *
 * Язык — одно состояние на всю игру, как генератор в rng.js. По умолчанию
 * русский: в тестах и до чтения сохранения всё остаётся как было. Выбор
 * игрока и первичное определение по браузеру — в systems/language.js.
 *
 * Тексты рисуются пиксельным шрифтом (gfx/font.js), который знает латиницу,
 * кириллицу, цифры и немного знаков, — другие символы в словарях недопустимы,
 * их ловит tests/i18n.test.js.
 */
import { ru } from './ru.js';
import { en } from './en.js';

/** Языки игры; name — название на самом языке, его показывает переключатель. */
export const LANGUAGES = [
  { id: 'ru', name: 'РУССКИЙ' },
  { id: 'en', name: 'ENGLISH' },
];

export const DEFAULT_LANGUAGE = 'ru';
/** Язык тем, чей браузер не говорит ни на одном из языков игры. */
const FALLBACK_LANGUAGE = 'en';

export const DICTIONARIES = { ru, en };

let current = DEFAULT_LANGUAGE;

export function isLanguage(id) {
  return typeof id === 'string' && Object.hasOwn(DICTIONARIES, id);
}

export function getLanguage() {
  return current;
}

/** Включает язык; неизвестный id игнорируется. Возвращает, получилось ли. */
export function setLanguage(id) {
  if (!isLanguage(id)) return false;
  current = id;
  return true;
}

/** Следующий язык по кругу — для переключателя. */
export function nextLanguage(id = current, step = 1) {
  const index = Math.max(0, LANGUAGES.findIndex((language) => language.id === id));
  return LANGUAGES[(index + step + LANGUAGES.length) % LANGUAGES.length].id;
}

/**
 * Перевод по ключу. `{имя}` в тексте заменяется значением из params;
 * нет перевода на текущем языке — берётся русский, нет и его — сам ключ,
 * чтобы дыру в словаре было видно на экране.
 */
export function t(key, params) {
  const text = DICTIONARIES[current][key] ?? DICTIONARIES[DEFAULT_LANGUAGE][key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (placeholder, name) => (name in params ? String(params[name]) : placeholder));
}

/**
 * Язык по списку предпочтений браузера (navigator.languages): первый из тех,
 * что знает игра. Если ни одного — английский.
 */
export function detectLanguage(preferences = []) {
  for (const tag of preferences) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return FALLBACK_LANGUAGE;
}

/**
 * Превращает поля данных в геттеры: значение читается из словаря по ключу
 * `${prefix}.${поле}` в момент обращения, а не при загрузке модуля. Поэтому
 * враги, оружие и апгрейды сразу меняют язык, а код, читающий `type.title`,
 * ничего не знает про переводы.
 */
export function localize(target, prefix, fields) {
  for (const field of fields) {
    Object.defineProperty(target, field, {
      get: () => t(`${prefix}.${field}`),
      enumerable: true,
      configurable: true,
    });
  }
  return target;
}

/** Тексты уровней оружия: levels[0] — второй уровень, ключи `${prefix}.level2` и дальше. */
export function localizeLevels(target, prefix) {
  target.levels.forEach((level, index) => {
    Object.defineProperty(level, 'text', {
      get: () => t(`${prefix}.level${index + 2}`),
      enumerable: true,
      configurable: true,
    });
  });
  return target;
}
