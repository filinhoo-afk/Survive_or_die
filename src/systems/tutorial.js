/**
 * Обучение при первом запуске: короткие подсказки прямо во время забега.
 *
 * Мир не останавливается и играется как обычно — подсказка лишь говорит, что
 * делать, и сменяется, когда игрок это сделал. Все шаги — данные: у шага есть
 * либо цель (что и сколько раз сделать), либо время показа.
 *
 * Пройдено ли обучение, лежит в едином сохранении (save.js): null — ещё не
 * решали, 'pending' — показывать, 'done' — пройдено, пропущено или не нужно.
 */

import { patchSave, readSave } from './save.js';

export const TUTORIAL_STEPS = [
  { id: 'move', textKey: 'tutorial.move', counter: 'distance', goal: 240 },
  { id: 'attack', textKey: 'tutorial.attack', counter: 'kills', goal: 3, countable: true },
  { id: 'gems', textKey: 'tutorial.gems', counter: 'xp', goal: 3, countable: true },
  { id: 'upgrade', textKey: 'tutorial.upgrade', counter: 'upgrades', goal: 1 },
  { id: 'crates', textKey: 'tutorial.crates', duration: 6 },
  { id: 'survive', textKey: 'tutorial.survive', duration: 5 },
];

/** Подсказка с целью висит не меньше этого — иначе выполненную заранее не успеть прочесть. */
export const STEP_MIN_TIME = 2.5;
/** Сколько секунд выполненный шаг горит «готово», прежде чем смениться. */
export const STEP_DONE_TIME = 0.8;
/** Раньше пропустить нельзя: Enter, которым начали забег, не должен снести обучение. */
export const SKIP_DELAY = 1;

/** Ход обучения в одном забеге. */
export class Tutorial {
  constructor(steps = TUTORIAL_STEPS) {
    this.steps = steps;
    this.index = 0;
    /** Всё сделанное с начала забега: выполненное раньше своего шага тоже засчитано. */
    this.counters = { distance: 0, kills: 0, xp: 0, upgrades: 0 };
    /** Секунд на текущем шаге. */
    this.time = 0;
    /** Секунд с начала обучения. */
    this.age = 0;
    /** Секунд с выполнения текущего шага или null, пока он не выполнен. */
    this.completed = null;
    this.skipped = false;
  }

  get finished() {
    return this.skipped || this.index >= this.steps.length;
  }

  /** Текущий шаг или null, когда обучение закончилось. */
  get step() {
    return this.finished ? null : this.steps[this.index];
  }

  get canSkip() {
    return !this.finished && this.age >= SKIP_DELAY;
  }

  /** Доля выполнения текущего шага от 0 до 1 — для полоски под подсказкой. */
  get progress() {
    const step = this.step;
    if (!step || this.completed !== null) return 1;
    const ratio = step.duration ? this.time / step.duration : this.counters[step.counter] / step.goal;
    return Math.min(1, Math.max(0, ratio));
  }

  /** Сколько из нужного уже сделано — для подписи «2/3». */
  get count() {
    const step = this.step;
    return step?.countable ? Math.min(step.goal, Math.floor(this.counters[step.counter])) : null;
  }

  /** Игрок что-то сделал: прошёл путь, убил, подобрал опыт, взял улучшение. */
  add(counter, amount = 1) {
    if (counter in this.counters && amount > 0) this.counters[counter] += amount;
  }

  /** Идёт только вместе с миром. @returns {boolean} закончилось ли обучение на этом кадре */
  update(dt) {
    if (this.finished) return false;
    this.age += dt;
    this.time += dt;

    if (this.completed !== null) {
      this.completed += dt;
      if (this.completed < STEP_DONE_TIME) return false;
      this.index += 1;
      this.time = 0;
      this.completed = null;
      return this.finished;
    }

    const step = this.step;
    const ready = step.duration
      ? this.time >= step.duration
      : this.counters[step.counter] >= step.goal && this.time >= STEP_MIN_TIME;
    if (ready) this.completed = 0;
    return false;
  }

  skip() {
    this.skipped = true;
  }
}

/** Играл ли уже владелец сохранения — таким обучение не навязываем. */
function hasPlayed({ record, meta, cleared }) {
  return (
    record?.runs > 0 ||
    meta?.gold > 0 ||
    Object.keys(meta?.levels ?? {}).length > 0 ||
    (Array.isArray(cleared) && cleared.length > 0)
  );
}

export function saveTutorialPending(pending) {
  patchSave({ tutorial: pending ? 'pending' : 'done' });
}

/**
 * Нужно ли показывать обучение. При первом запуске решение принимается по
 * сохранению и сразу записывается: иначе после первой же гибели и перезагрузки
 * новичок выглядел бы бывалым.
 */
export function loadTutorialPending() {
  const save = readSave();
  if (save.tutorial === 'done') return false;
  if (save.tutorial === 'pending') return true;
  const pending = !hasPlayed(save);
  saveTutorialPending(pending);
  return pending;
}
