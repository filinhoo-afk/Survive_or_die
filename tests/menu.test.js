/**
 * Раскладка главного меню: рамка с подсказками не должна наезжать на мигающую
 * строку «начать». Длиннее всего рамка у того, кто уже играл, — с рекордом.
 */
import './helpers/dom.js';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { drawMenuScreen } from '../src/ui/menuScreens.js';
import { DEFAULT_LANGUAGE, LANGUAGES, setLanguage } from '../src/i18n/index.js';
import { HEROES } from '../src/systems/heroes.js';
import { LOCATION_LIST } from '../src/locations/index.js';

const canvas = { width: 960, height: 540 };
/** Верх строки «начать»; между ней и рамкой нужен хотя бы маленький зазор. */
const START_TOP = canvas.height - 24;
const GAP = 4;

describe('главное меню', () => {
  afterEach(() => setLanguage(DEFAULT_LANGUAGE));

  test('рамка с рекордом кончается выше строки «начать»', (context) => {
    // Строка мигает: останавливаем часы на фазе, когда она видна.
    context.mock.method(performance, 'now', () => 0);
    const record = { runs: 3, time: 320, kills: 240, level: 11, damage: 900 };
    const daily = { date: '2026-11-26', location: 'АБИСС', hero: 'СТРЕЛОК', seed: '99B0587F' };

    for (const { id } of LANGUAGES) {
      setLanguage(id);
      // Открытая локация и закрытая — подписи под рамкой у них разные.
      for (const selected of [0, 1]) {
        let panelBottom = 0;
        const textTops = [];
        const ctx = new Proxy(
          {},
          {
            get: (_, name) => (...args) => {
              const [, y, , height] = args;
              // Затемнение во весь экран — не рамка.
              if (name === 'fillRect' && height < canvas.height) panelBottom = Math.max(panelBottom, y + height);
              if (name === 'drawImage') textTops.push(args[2]);
            },
            set: () => true,
          },
        );
        const campaign = { list: LOCATION_LIST, selected, cleared: new Set() };
        drawMenuScreen(ctx, canvas, record, campaign, 120, HEROES[0], 'ok', 'BOB', daily, { count: 3, total: 14 });

        assert.ok(textTops.includes(START_TOP), 'строка «начать» нарисована там, где ждёт проверка');
        assert.ok(panelBottom > 0 && panelBottom <= START_TOP - GAP, `${id}: рамка до ${panelBottom}`);
      }
    }
  });
});
