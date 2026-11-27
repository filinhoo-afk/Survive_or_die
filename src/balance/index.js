/**
 * Баланс игры — JSON-таблицы рядом с этим файлом. Все игровые числа правятся
 * там, а не по коду. Это единственное место, где таблицы читаются.
 *
 * Комментариев в JSON не бывает, поэтому поля описаны здесь.
 *
 *   player.json    hero — радиус, скорость (пикселей в секунду), здоровье и секунды
 *                  неуязвимости после удара (без неё толпа снимает всё за миг);
 *                  xp — опыт до второго уровня (base), надбавка за каждый следующий (step),
 *                  радиус магнита, ускорение и предел скорости притянутого кристалла;
 *                  crit — шанс и множитель крита; maxWeapons — слоты оружия.
 *   enemies.json   knockback — отброс от попадания в пикселях; shot — снаряд врага
 *                  по умолчанию; types — враги:
 *                    radius, speed, hp, damage, xp;
 *                    from — с какой секунды забега появляется;
 *                    weight — относительный шанс выпасть при спавне;
 *                    pack — сколько появляется разом, кучкой;
 *                    mass — кто кого расталкивает: тяжёлый почти не сдвигается;
 *                    knockbackResist — доля отброса, которую враг гасит;
 *                    wobble — насколько петляет на бегу, радиан;
 *                    ranged — стрелок: дистанция, перезарядка, прицеливание и снаряд.
 *                  У боссов нет from, weight, pack и wobble: они выходят по таймеру.
 *   elites.json    elite — множители любой элиты (size, hp, xp, mass) и шанс появления:
 *                  с секунды from, chance, прирост за минуту и потолок;
 *                  modifiers — множители модификаторов, knockbackResist — добавка,
 *                  drop — всегда роняет предмет.
 *   spawner.json   interval — секунд между волнами, waveSize — типов в волне,
 *                  maxEnemies — потолок врагов, margin — отступ за кадром. ramp — линейный
 *                  рост сложности: раз в waveSizeEvery секунд в волне прибавляется один;
 *                  за минуту интервал сокращается на intervalShrinkPerMinute (не ниже
 *                  minInterval), растут потолок и здоровье врагов.
 *   locations.json duration — секунд до босса (null — забег без босса); enemies — кто водится.
 *   bosses.json    фазы боссов. Фаза действует, пока доля здоровья выше until;
 *                  windup — секунды замаха, cooldown — паузы, ring и fan — снарядов
 *                  в залпе; summonLimit — при стольких врагах на карте призыв пропускается.
 *                  speed первой фазы совпадает со speed босса в enemies.json.
 *   weapons.json   projectile — снаряд по умолчанию; weapons — base первого уровня и
 *                  levels: mul умножает характеристику, add прибавляет, show — какую
 *                  показать на карточке; evolutions — рецепт (from + пассивка requires)
 *                  и характеристики. cooldown — секунд между залпами, spread — угол веера
 *                  в радианах, rotation — радиан в секунду. Отброс ауры (knockback, доля
 *                  обычного) мал, иначе она выталкивает толпу из себя; орбита щита заметно
 *                  шире ауры, иначе их кольца сливаются; heal — здоровья за импульс,
 *                  задевший хотя бы одного врага.
 *   upgrades.json  cardWeight — шансы карточек попасть в выбор; passives — потолок
 *                  ранга и что даёт один ранг (mul или add).
 *   heroes.json    стартовое оружие и уклон в характеристиках (mul, add).
 *   meta.json      gold — золото за забег; upgrades — постоянные улучшения: потолок,
 *                  цена первого уровня (дальше cost × уровень) и бонус за уровень (step).
 *   items.json     crates — число ящиков, их прочность и опыт в кристалле из ящика;
 *                  pickups — предметы; enemyDropChance — шанс предмета из врага;
 *                  loot — веса того, что выпадает.
 *
 * Тексты с цифрами лежат в словарях (src/i18n), а сервер проверяет рекорды по тем же
 * числам (supabase/migrations/002_plausibility.sql). Расхождение с таблицами ловят тесты
 * tests/balance.test.js.
 */
import player from './player.json' with { type: 'json' };
import enemies from './enemies.json' with { type: 'json' };
import elites from './elites.json' with { type: 'json' };
import spawner from './spawner.json' with { type: 'json' };
import locations from './locations.json' with { type: 'json' };
import bosses from './bosses.json' with { type: 'json' };
import weapons from './weapons.json' with { type: 'json' };
import upgrades from './upgrades.json' with { type: 'json' };
import heroes from './heroes.json' with { type: 'json' };
import meta from './meta.json' with { type: 'json' };
import items from './items.json' with { type: 'json' };

export const BALANCE = {
  player,
  enemies,
  elites,
  spawner,
  locations,
  bosses,
  weapons,
  upgrades,
  heroes,
  meta,
  items,
};

/** Уровни оружия из таблицы: `show` для карточки и функция, меняющая характеристики. */
export function weaponLevels(rows) {
  return rows.map((row) => ({
    show: row.show,
    apply: (stats) => {
      applyChange(stats, row);
    },
  }));
}

/**
 * Изменение характеристик из таблицы: сначала множители `mul`, потом добавки `add`.
 * Меняет `target` на месте — это игрок или характеристики оружия, не сама таблица.
 */
export function applyChange(target, { mul = {}, add = {} }) {
  for (const [key, factor] of Object.entries(mul)) target[key] *= factor;
  for (const [key, amount] of Object.entries(add)) target[key] += amount;
  return target;
}
