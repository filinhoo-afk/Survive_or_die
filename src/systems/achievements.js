/**
 * Достижения: цели, которые остаются открытыми навсегда.
 *
 * Достижение — это данные: `goal` и функция `value(run, totals)`, которая
 * говорит, сколько уже набрано. `run` — снимок идущего забега, `totals` —
 * накопленное за все прошлые (убийства и герои, побеждавшие боссов). Открыто,
 * когда набрано не меньше цели.
 *
 * Проверяются по ходу забега и в его конце; в общий счёт забег попадает только
 * законченным — гибелью или победой, как рекорд и золото. Хранит единое
 * сохранение (save.js).
 */

import { localize } from '../i18n/index.js';
import { loadCleared } from './campaign.js';
import { HEROES } from './heroes.js';
import { loadRecord } from './records.js';
import { patchSave, readSave } from './save.js';

/** Достижение за один забег: показатель снимка не меньше цели. */
const inRun = (id, field, goal) => ({ id, goal, value: (run) => run[field] });

/** Достижение за победу над боссом локации. */
const bossOf = (id, locationId) => ({
  id,
  locationId,
  goal: 1,
  value: (run) => (run.victory && run.locationId === locationId ? 1 : 0),
});

export const ACHIEVEMENTS = [
  inRun('firstBlood', 'kills', 1),
  inRun('survivor', 'time', 300),
  { id: 'untouched', goal: 60, value: (run) => (run.hurt ? 0 : run.time) },
  inRun('reaper', 'kills', 500),
  inRun('veteran', 'level', 15),
  inRun('arsenal', 'weapons', 4),
  inRun('evolution', 'evolved', 1),
  inRun('hunter', 'elites', 10),
  bossOf('guardian', 'forest'),
  bossOf('necromancer', 'ruins'),
  bossOf('iceworm', 'glacier'),
  bossOf('abyssal', 'abyss'),
  // Накопительные: их ход виден на экране достижений.
  { id: 'legion', goal: 5000, lifetime: true, value: (run, totals) => totals.kills + run.kills },
  {
    id: 'trio',
    goal: HEROES.length,
    lifetime: true,
    value: (run, totals) =>
      HEROES.filter((hero) => totals.heroes.has(hero.id) || (run.victory && run.heroId === hero.id)).length,
  },
];

for (const achievement of ACHIEVEMENTS) {
  localize(achievement, `achievement.${achievement.id}`, ['title', 'desc']);
}

/** Забег, в котором ещё ничего не произошло. */
const NO_RUN = {
  time: 0,
  kills: 0,
  level: 1,
  weapons: 0,
  evolved: 0,
  elites: 0,
  hurt: true,
  victory: false,
  locationId: null,
  heroId: null,
};

function emptyState() {
  return { unlocked: new Set(), kills: 0, heroes: new Set() };
}

function save({ unlocked, kills, heroes }) {
  patchSave({ achievements: { unlocked: [...unlocked], kills, heroes: [...heroes] } });
}

/**
 * Открывает всё, что заслужено этим забегом.
 * @returns {{ state: object, fresh: object[] }} новое состояние и только что открытое;
 *   если открывать нечего, состояние то же самое и в хранилище ничего не пишется.
 */
export function unlock(state, run) {
  const fresh = ACHIEVEMENTS.filter(
    (achievement) => !state.unlocked.has(achievement.id) && achievement.value(run, state) >= achievement.goal,
  );
  if (fresh.length === 0) return { state, fresh };
  const next = { ...state, unlocked: new Set([...state.unlocked, ...fresh.map((a) => a.id)]) };
  save(next);
  return { state: next, fresh };
}

/** Законченный забег: открывает заслуженное и кладёт забег в общий счёт. */
export function recordRun(state, run) {
  // Сначала открываем: value() сам прибавляет забег к накопленному.
  const { state: opened, fresh } = unlock(state, run);
  const next = {
    ...opened,
    kills: opened.kills + run.kills,
    heroes: run.victory ? new Set(opened.heroes).add(run.heroId) : opened.heroes,
  };
  save(next);
  return { state: next, fresh };
}

/**
 * Для тех, кто играл до появления достижений: открывает то, что доказывают
 * рекорд и пройденные локации. Чего по ним не узнать, придётся заслужить.
 */
function fromHistory() {
  const record = loadRecord();
  let { state } = unlock(emptyState(), { ...NO_RUN, time: record.time, kills: record.kills, level: record.level });
  for (const locationId of loadCleared()) {
    state = unlock(state, { ...NO_RUN, victory: true, locationId }).state;
  }
  return state;
}

export function loadAchievements() {
  const saved = readSave().achievements;
  if (!saved || typeof saved !== 'object') {
    const state = fromHistory();
    save(state);
    return state;
  }
  const state = emptyState();
  const known = (list, items) =>
    new Set(Array.isArray(list) ? list.filter((id) => items.some((item) => item.id === id)) : []);
  state.unlocked = known(saved.unlocked, ACHIEVEMENTS);
  state.heroes = known(saved.heroes, HEROES);
  if (Number.isFinite(saved.kills) && saved.kills > 0) state.kills = Math.floor(saved.kills);
  return state;
}

/** Ход накопительного достижения для экрана или null, если оно из одного забега. */
export function progressOf(state, achievement) {
  if (!achievement.lifetime) return null;
  const done = state.unlocked.has(achievement.id);
  const value = done ? achievement.goal : Math.min(achievement.goal, achievement.value(NO_RUN, state));
  return { value, goal: achievement.goal };
}
