import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NICK_MAX, cleanNick, isValidNick, loadNick, saveNick, typeChar } from '../src/systems/nickname.js';
import { readSave } from '../src/systems/save.js';
import { dropStorage, useStorage } from './helpers/storage.js';

describe('isValidNick', () => {
  test('допустимые ники', () => {
    for (const nick of ['A', 'BOB', 'ИГРОК 1', 'A-B', 'MAX-POWER 7', '123', 'A'.repeat(NICK_MAX)]) {
      assert.equal(isValidNick(nick), true, nick);
    }
  });

  test('недопустимые ники', () => {
    const bad = [
      '', // пусто
      'bob', // шрифт знает только заглавные
      'A'.repeat(NICK_MAX + 1), // длиннее предела
      ' A', 'A ', '-A', 'A-', // разделитель на краю
      'A  B', 'A--B', 'A -B', // два разделителя подряд
      'A_B', 'A!', 'А.Б', // посторонние символы
      'Ё', // в шрифте игры её нет
    ];
    for (const nick of bad) assert.equal(isValidNick(nick), false, JSON.stringify(nick));
  });

  test('не строка — не ник', () => {
    for (const value of [null, undefined, 42, ['A'], {}]) assert.equal(isValidNick(value), false);
  });
});

describe('typeChar', () => {
  test('дописывает допустимый символ, строчные поднимает', () => {
    assert.equal(typeChar('', 'a'), 'A');
    assert.equal(typeChar('AB', 'я'), 'ABЯ');
    assert.equal(typeChar('A', '7'), 'A7');
  });

  test('«ё» становится «Е»', () => {
    assert.equal(typeChar('', 'ё'), 'Е');
    assert.equal(typeChar('', 'Ё'), 'Е');
  });

  test('чужие символы и не одиночные символы отклоняются', () => {
    for (const char of ['!', '_', '.', '', 'ab', '😀', 'ß']) assert.equal(typeChar('A', char), null, JSON.stringify(char));
  });

  test('разделитель нельзя первым и нельзя дважды подряд', () => {
    assert.equal(typeChar('', ' '), null);
    assert.equal(typeChar('', '-'), null);
    assert.equal(typeChar('A', ' '), 'A ');
    assert.equal(typeChar('A ', '-'), null);
    assert.equal(typeChar('A-', ' '), null);
  });

  test('полный ник больше не растёт', () => {
    assert.equal(typeChar('A'.repeat(NICK_MAX), 'B'), null);
    assert.equal(typeChar('A'.repeat(NICK_MAX - 1), 'B'), 'A'.repeat(NICK_MAX - 1) + 'B');
  });
});

describe('cleanNick', () => {
  test('приводит набранное к допустимому нику', () => {
    assert.equal(cleanNick('bob'), 'BOB');
    assert.equal(cleanNick('  ёж  '), 'ЕЖ');
    assert.equal(cleanNick('a  b'), 'A B');
    assert.equal(cleanNick('hello!!world'), 'HELLOWORLD');
    assert.equal(cleanNick('---a--'), 'A');
    assert.equal(cleanNick('Игрок-1'), 'ИГРОК-1');
  });

  test('длинное обрезает по пределу и не оставляет разделитель в конце', () => {
    assert.equal(cleanNick('abcdefghijklmnop'), 'ABCDEFGHIJKL');
    assert.equal(cleanNick('abcdefghijk lmn'), 'ABCDEFGHIJK');
  });

  test('когда ничего не осталось — пустая строка', () => {
    for (const value of ['', '   ', '!!!', null, undefined, '---']) assert.equal(cleanNick(value), '', JSON.stringify(value));
  });

  test('результат всегда проходит isValidNick, что бы ни пришло на вход', () => {
    const inputs = ['  --a b-- ', 'ёЁёЁ', 'x'.repeat(50), '1 2 3 4 5 6 7 8 9', '😀a😀', 'a - b'];
    for (const input of inputs) {
      const nick = cleanNick(input);
      assert.ok(nick === '' || isValidNick(nick), `${JSON.stringify(input)} → ${JSON.stringify(nick)}`);
    }
  });

  test('чистка идемпотентна', () => {
    for (const input of ['bob', 'a  b', '  ёж ']) {
      assert.equal(cleanNick(cleanNick(input)), cleanNick(input));
    }
  });
});

describe('ник в сохранении', () => {
  beforeEach(() => useStorage());
  afterEach(dropStorage);

  test('без сохранения ника нет', () => {
    assert.equal(loadNick(), '');
  });

  test('сохраняется очищенным и читается после перезагрузки страницы', () => {
    saveNick('  bob ');
    assert.equal(loadNick(), 'BOB');
    assert.equal(readSave().nick, 'BOB');
  });

  test('негодный ник стирает прежний', () => {
    saveNick('BOB');
    saveNick('!!!');
    assert.equal(readSave().nick, null);
    assert.equal(loadNick(), '');
  });

  test('испорченная запись очищается при чтении', () => {
    useStorage({ 'survive-or-die:save': JSON.stringify({ version: 1, nick: 'bad nick!!' }) });
    assert.equal(loadNick(), 'BAD NICK');
  });
});
