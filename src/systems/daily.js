/**
 * Испытание дня: у всех игроков в мире один и тот же забег.
 *
 * День считается по UTC, чтобы он был общим для всех часовых поясов. Всё, что
 * делает день особенным, выводится из его номера — числа дней с 1970 года:
 * сид генератора, локация и герой. Хранить расписание не нужно, и сервер
 * пересчитывает те же значения сам (функция `daily_challenge` в
 * supabase/migrations/004_daily.sql): подсунуть в таблицу испытания «своих»
 * локацию или героя нельзя. Поменялась формула здесь — правь и там.
 *
 * Постоянные улучшения из магазина в испытании не действуют, а закрытые
 * локации открыты: всем достаётся один и тот же мир и один и тот же старт.
 */

/** Порядок важен — он совпадает с массивами в SQL. */
export const DAILY_LOCATIONS = ['wasteland', 'forest', 'ruins', 'glacier', 'abyss'];
export const DAILY_HEROES = ['gunner', 'thrower', 'warden'];

/** Множитель Кнута (2^32 / φ): соседние дни разбрасывает по всему диапазону. */
const MIX = 2654435761;
const MODULUS = 4294967296;
const MS_PER_DAY = 86400000;

/** Сегодняшняя дата по UTC, `ГГГГ-ММ-ДД`. */
export function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** Строка вида `ГГГГ-ММ-ДД` — настоящая дата. */
export function isDateString(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const time = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === text;
}

/** Сколько суток прошло от 1970-01-01 до этой даты. */
export function dayNumber(date) {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / MS_PER_DAY);
}

/**
 * Испытание на дату: сид (32 бита), локация и герой.
 * Произведение остаётся меньше 2^53, так что целочисленная арифметика точна.
 */
export function dailyChallenge(date = todayUtc()) {
  const seed = (dayNumber(date) * MIX) % MODULUS;
  // Локация и герой берут разные биты сида: на одних и тех же они шагали бы
  // в лад (шаг сида между днями кратен трём), и герой почти не менялся бы.
  return {
    date,
    seed,
    locationId: DAILY_LOCATIONS[Math.floor(seed / 65536) % DAILY_LOCATIONS.length],
    heroId: DAILY_HEROES[Math.floor(seed / 256) % DAILY_HEROES.length],
  };
}
