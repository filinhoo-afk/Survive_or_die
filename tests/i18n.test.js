/**
 * Локализация: словари ru и en совпадают по ключам, шрифт умеет рисовать
 * каждый символ, данные игры переводятся на лету, а язык выбирается и
 * запоминается. Без этих проверок дыру в переводе увидел бы только игрок,
 * дошедший до нужного экрана, — на месте текста там стоял бы ключ.
 */
import './helpers/dom.js';
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_LANGUAGE,
  DICTIONARIES,
  LANGUAGES,
  detectLanguage,
  getLanguage,
  isLanguage,
  nextLanguage,
  setLanguage,
  t,
} from '../src/i18n/index.js';
import { hasGlyph } from '../src/gfx/font.js';
import { loadLanguage, saveLanguage } from '../src/systems/language.js';
import { ENEMY_TYPE_LIST } from '../src/enemies/types.js';
import { ELITE_MODIFIERS } from '../src/enemies/elites.js';
import { LOCATION_LIST } from '../src/locations/index.js';
import { HEROES } from '../src/systems/heroes.js';
import { META_UPGRADES } from '../src/systems/meta.js';
import { PASSIVES, UpgradeState } from '../src/systems/upgrades.js';
import { Arsenal } from '../src/systems/arsenal.js';
import { EVOLUTIONS, WEAPONS } from '../src/weapons/index.js';
import { BINDING_ACTIONS, VOLUME_CHANNELS } from '../src/systems/settings.js';
import { SETTINGS_ROWS } from '../src/ui/settingsScreen.js';
import { dropStorage, useStorage } from './helpers/storage.js';

const ruKeys = Object.keys(DICTIONARIES.ru);
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

// Язык в модуле один на всех: каждый тест возвращает его как был.
afterEach(() => setLanguage(DEFAULT_LANGUAGE));

describe('словари', () => {
  test('в каждом языке игры есть словарь, а язык по умолчанию — русский', () => {
    for (const { id } of LANGUAGES) assert.ok(DICTIONARIES[id], id);
    assert.equal(DEFAULT_LANGUAGE, 'ru');
    assert.equal(getLanguage(), 'ru');
  });

  test('ключи всех словарей совпадают с русским', () => {
    for (const { id } of LANGUAGES) {
      const keys = Object.keys(DICTIONARIES[id]);
      assert.deepEqual(keys.filter((key) => !(key in DICTIONARIES.ru)), [], `${id}: лишние ключи`);
      assert.deepEqual(ruKeys.filter((key) => !(key in DICTIONARIES[id])), [], `${id}: нет перевода`);
    }
  });

  test('подстановки {имя} в переводе те же, что в русском тексте', () => {
    for (const { id } of LANGUAGES) {
      for (const key of ruKeys) {
        assert.deepEqual(placeholders(DICTIONARIES[id][key]), placeholders(DICTIONARIES.ru[key]), `${id}: ${key}`);
      }
    }
  });

  test('тексты непустые и без лишних пробелов по краям (кроме приставок статуса)', () => {
    for (const { id } of LANGUAGES) {
      for (const [key, text] of Object.entries(DICTIONARIES[id])) {
        assert.equal(typeof text, 'string', `${id}: ${key}`);
        assert.ok(text.trim().length > 0, `${id}: ${key} пуст`);
        if (!key.startsWith('menu.status.')) assert.equal(text, text.trim(), `${id}: ${key}`);
      }
    }
  });

  test('пиксельный шрифт умеет рисовать каждый символ каждого перевода', () => {
    for (const { id } of LANGUAGES) {
      for (const [key, text] of Object.entries(DICTIONARIES[id])) {
        for (const char of text.replace(/\{\w+\}/g, '')) {
          assert.ok(hasGlyph(char), `${id}: ${key} — шрифт не знает «${char}»`);
        }
      }
    }
  });

  test('названия языков тоже рисуются шрифтом', () => {
    for (const { name } of LANGUAGES) {
      for (const char of name) assert.ok(hasGlyph(char), name);
    }
  });
});

describe('t()', () => {
  test('подставляет значения и оставляет неизвестные {имена} на месте', () => {
    assert.equal(t('shop.gold', { gold: 15 }), 'Золото: 15');
    assert.equal(t('shop.gold', {}), 'Золото: {gold}');
    assert.equal(t('shop.gold'), 'Золото: {gold}');
    assert.equal(t('summary.rank', { place: 3, total: 40 }), 'Место: 3 из 40');
  });

  test('ноль и пустая строка — тоже значения', () => {
    assert.equal(t('shop.gold', { gold: 0 }), 'Золото: 0');
    assert.equal(t('shop.gold', { gold: '' }), 'Золото: ');
  });

  test('нет ключа — виден сам ключ', () => {
    assert.equal(t('нет.такого.ключа'), 'нет.такого.ключа');
  });

  test('английский язык переключается сразу и без перезагрузки', () => {
    assert.equal(setLanguage('en'), true);
    assert.equal(t('shop.gold', { gold: 15 }), 'Gold: 15');
    assert.equal(t('summary.rank', { place: 3, total: 40 }), 'Rank: 3 of 40');
    setLanguage('ru');
    assert.equal(t('shop.gold', { gold: 15 }), 'Золото: 15');
  });

  test('неизвестный язык игнорируется', () => {
    assert.equal(setLanguage('de'), false);
    assert.equal(setLanguage(undefined), false);
    assert.equal(setLanguage('toString'), false);
    assert.equal(getLanguage(), 'ru');
    assert.equal(isLanguage('constructor'), false);
  });

  test('ключ, которого нет в языке, берётся из русского', () => {
    DICTIONARIES.en['test.only.ru'] = undefined;
    DICTIONARIES.ru['test.only.ru'] = 'только по-русски';
    try {
      setLanguage('en');
      assert.equal(t('test.only.ru'), 'только по-русски');
    } finally {
      delete DICTIONARIES.en['test.only.ru'];
      delete DICTIONARIES.ru['test.only.ru'];
    }
  });

  test('nextLanguage ходит по кругу в обе стороны', () => {
    assert.equal(nextLanguage('ru', 1), 'en');
    assert.equal(nextLanguage('en', 1), 'ru');
    assert.equal(nextLanguage('ru', -1), 'en');
    assert.equal(nextLanguage('xx', 1), 'en', 'неизвестный язык считается первым');
    setLanguage('en');
    assert.equal(nextLanguage(), 'ru');
  });
});

describe('ключи в коде', () => {
  /** Все .js под src/, кроме самих словарей. */
  function sources(dir = 'src') {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === 'i18n' ? [] : sources(path);
      return path.endsWith('.js') ? [path] : [];
    });
  }

  // Пространства имён интерфейса: у данных (hero, enemy…) ключи собираются из id, их ловят тесты ниже.
  const UI_KEY = /'((?:menu|pause|settings|nick|shop|upgrade|hud|board|summary|fmt|page)\.[\w.]+)'/g;

  test('каждый ключ интерфейса, упомянутый в коде, есть в словаре', () => {
    const missing = [];
    let found = 0;
    for (const file of sources()) {
      for (const [, key] of readFileSync(file, 'utf8').matchAll(UI_KEY)) {
        found += 1;
        if (!(key in DICTIONARIES.ru)) missing.push(`${file}: ${key}`);
      }
    }
    assert.ok(found > 40, 'код должен ссылаться на словарь — проверка ничего не нашла');
    assert.deepEqual(missing, []);
  });

  test('в словаре нет ключей, на которые никто не ссылается', () => {
    // Ключи данных собираются из id (`enemy.${id}.title`), у интерфейса — через шаблоны и литералы.
    const dynamic = /^(hero|enemy|elite|location|weapon|passive|meta)\.|^summary\.row\.|^settings\.(volume|key)\./;
    const code = sources().map((file) => readFileSync(file, 'utf8')).join('\n');
    const unused = ruKeys.filter((key) => !dynamic.test(key) && !code.includes(`'${key}'`));
    assert.deepEqual(unused, []);
  });

  test('строки настроек и итогов ссылаются на существующие ключи', () => {
    for (const row of SETTINGS_ROWS) assert.ok(row.titleKey in DICTIONARIES.ru, row.titleKey);
    assert.deepEqual(
      [...VOLUME_CHANNELS, ...BINDING_ACTIONS].map((item) => item.id).filter(
        (id) => !(`settings.volume.${id}` in DICTIONARIES.ru) && !(`settings.key.${id}` in DICTIONARIES.ru),
      ),
      [],
    );
    for (const field of ['time', 'kills', 'level', 'damage', 'wave', 'crits']) {
      assert.ok(`summary.row.${field}` in DICTIONARIES.ru, field);
    }
  });
});

describe('данные игры говорят на выбранном языке', () => {
  /** Для каждой записи и поля: русский и английский тексты есть и различаются. */
  function checkFields(entries, fields, prefix = '') {
    for (const entry of entries) {
      for (const field of fields) {
        const key = `${prefix}${entry.id}.${field}`;
        setLanguage('ru');
        const ru = entry[field];
        setLanguage('en');
        const en = entry[field];
        assert.ok(ru && ru !== key, `${key}: нет русского текста`);
        assert.ok(en && en !== key, `${key}: нет английского текста`);
        assert.notEqual(en, ru, `${key}: перевод совпал с оригиналом`);
        assert.ok(key in DICTIONARIES.ru, key);
      }
    }
  }

  test('враги и боссы', () => checkFields(ENEMY_TYPE_LIST, ['title'], 'enemy.'));
  test('модификаторы элиты', () => checkFields(Object.values(ELITE_MODIFIERS), ['title'], 'elite.'));
  test('локации', () => checkFields(LOCATION_LIST, ['title'], 'location.'));
  test('герои', () => checkFields(HEROES, ['title', 'desc'], 'hero.'));
  test('постоянные улучшения', () => checkFields(META_UPGRADES, ['title', 'desc'], 'meta.'));
  test('пассивки', () => checkFields(PASSIVES, ['title', 'text'], 'passive.'));
  test('оружие и эволюции', () => checkFields([...WEAPONS, ...EVOLUTIONS], ['title', 'description'], 'weapon.'));

  test('уровни оружия', () => {
    for (const weapon of WEAPONS) {
      weapon.levels.forEach((level, index) => {
        const key = `weapon.${weapon.id}.level${index + 2}`;
        setLanguage('ru');
        const ru = level.text;
        setLanguage('en');
        assert.equal(ru, DICTIONARIES.ru[key]);
        assert.equal(level.text, DICTIONARIES.en[key]);
        assert.notEqual(level.text, ru, key);
      });
    }
  });

  test('эволюции не перетирают тексты исходного оружия', () => {
    setLanguage('en');
    const [cannon] = WEAPONS;
    assert.equal(cannon.title, 'Cannon');
    assert.equal(EVOLUTIONS.find((e) => e.id === 'thunder').title, 'Thunderer');
    assert.equal(cannon.title, 'Cannon');
  });

  test('карточки выбора на английском: значки, форматы и подписи', () => {
    const arsenal = new Arsenal();
    arsenal.add('cannon');
    const player = { speed: 200, maxHp: 100, hp: 100, regen: 0, armor: 0, magnetRadius: 100, mods: { damage: 1, cooldown: 1, area: 1 } };
    const state = new UpgradeState(arsenal, player);
    const card = (id) => state.candidates().find((c) => c.id === id);

    setLanguage('en');
    assert.equal(card('level:cannon').badge, 'level 1 → 2');
    assert.equal(card('level:cannon').text, 'Damage +25%');
    assert.equal(card('new:knife').badge, 'new weapon');
    assert.equal(card('new:knife').fresh, true);
    assert.equal(card('passive:might').badge, 'evolution key');
    assert.equal(card('passive:speed').badge, 'new');
    assert.equal(card('passive:speed').fresh, true);
    assert.equal(card('passive:regen').preview[1], '0.4/s');
    assert.equal(card('passive:speed').title, 'Light Boots');

    card('passive:speed').apply();
    assert.equal(card('passive:speed').badge, 'rank 1 → 2');
    assert.equal(card('passive:speed').fresh, false);
    assert.equal(state.summary(), 'Cannon 1 · Light Boots 1');

    setLanguage('ru');
    assert.equal(card('passive:speed').badge, 'ранг 1 → 2');
    assert.equal(state.summary(), 'Пушка 1 · Лёгкие ботинки 1');
  });
});

describe('detectLanguage', () => {
  test('берёт первый знакомый язык из предпочтений, регион отбрасывает', () => {
    assert.equal(detectLanguage(['ru-RU', 'en']), 'ru');
    assert.equal(detectLanguage(['en-GB', 'ru']), 'en');
    assert.equal(detectLanguage(['de-DE', 'ru-RU']), 'ru');
    assert.equal(detectLanguage(['RU']), 'ru');
  });

  test('незнакомые языки и пустой список — английский', () => {
    assert.equal(detectLanguage(['de', 'fr-CA']), 'en');
    assert.equal(detectLanguage([]), 'en');
    assert.equal(detectLanguage(), 'en');
  });
});

describe('выбор языка игроком', () => {
  beforeEach(() => useStorage());
  afterEach(dropStorage);

  test('без сохранения язык берётся из браузера', () => {
    assert.equal(loadLanguage({ languages: ['ru-RU', 'en-US'] }), 'ru');
    assert.equal(loadLanguage({ languages: ['en-US'] }), 'en');
    assert.equal(loadLanguage({ languages: [], language: 'ru' }), 'ru', 'нет списка — один язык браузера');
    assert.equal(loadLanguage({ languages: ['pl'] }), 'en');
  });

  test('среда без navigator — английский, и ничего не падает', () => {
    assert.equal(loadLanguage(null), 'en');
    assert.equal(loadLanguage({}), 'en');
  });

  test('сохранённый выбор сильнее браузера', () => {
    saveLanguage('en');
    assert.equal(loadLanguage({ languages: ['ru-RU'] }), 'en');
    saveLanguage('ru');
    assert.equal(loadLanguage({ languages: ['en-US'] }), 'ru');
  });

  test('выбор лежит в общем сохранении и переживает перезагрузку', () => {
    const storage = useStorage();
    saveLanguage('en');
    assert.equal(JSON.parse(storage.data.get('survive-or-die:save')).lang, 'en');
  });

  test('чужое значение в сохранении не принимается', () => {
    saveLanguage('klingon');
    assert.equal(loadLanguage({ languages: ['ru'] }), 'ru');
    useStorage({ 'survive-or-die:save': JSON.stringify({ version: 1, lang: 'klingon' }) });
    assert.equal(loadLanguage({ languages: ['en'] }), 'en');
    useStorage({ 'survive-or-die:save': JSON.stringify({ version: 1, lang: 42 }) });
    assert.equal(loadLanguage({ languages: ['ru'] }), 'ru');
  });
});
