/**
 * Никнейм игрока: что в нём можно, как он набирается и где хранится.
 *
 * Шрифт игры знает только заглавные буквы и цифры, поэтому ник хранится
 * заглавными: что набрано, то и видно. Правило допустимого ника одно и то же
 * здесь и на сервере (`nick_valid` в supabase/migrations/003_nickname.sql):
 * от 1 до 12 символов — латиница, кириллица, цифры и одиночные пробелы
 * или дефисы между ними. Поменялось здесь — правь и там.
 */

import { patchSave, readSave } from './save.js';

export const NICK_MAX = 12;

/** Ник целиком: слова из букв и цифр через одиночный пробел или дефис. */
const VALID = /^[A-ZА-Я0-9]+(?:[ -][A-ZА-Я0-9]+)*$/;
const TYPABLE = /^[A-ZА-Я0-9 -]$/;
const SEPARATOR = /[ -]/;

/** Заглавные, «Ё» как «Е» — в шрифте игры её нет. */
function upper(text) {
  return String(text).toUpperCase().replace(/Ё/g, 'Е');
}

/** Годится ли ник для отправки на сервер: пустой — не годится, его просто не шлют. */
export function isValidNick(nick) {
  return typeof nick === 'string' && nick.length <= NICK_MAX && VALID.test(nick);
}

/**
 * Приводит любую строку к допустимому нику или к пустой строке:
 * лишние символы выбрасываются, разделители на краях и подряд — тоже.
 */
export function cleanNick(text) {
  let nick = '';
  for (const char of upper(text ?? '')) {
    const next = typeChar(nick, char);
    if (next !== null) nick = next;
  }
  nick = nick.replace(/[ -]+$/, '');
  return isValidNick(nick) ? nick : '';
}

/**
 * Дописывает набранный символ к нику. null — символ не принят: не из
 * разрешённых, ник уже полный, или разделитель стоит первым или второй раз подряд.
 * Ник по ходу набора может кончаться разделителем — перед сохранением его срезает cleanNick.
 */
export function typeChar(nick, char) {
  const c = upper(char);
  if (c.length !== 1 || !TYPABLE.test(c)) return null;
  if (nick.length >= NICK_MAX) return null;
  if (SEPARATOR.test(c) && (nick === '' || SEPARATOR.test(nick.at(-1)))) return null;
  return nick + c;
}

/** Ник из сохранения; пустая строка — игрок ещё не назвался. */
export function loadNick() {
  return cleanNick(readSave().nick);
}

export function saveNick(nick) {
  patchSave({ nick: cleanNick(nick) || null });
}
