/**
 * Локальный рекорд: лучшие показатели за все забеги в этом браузере.
 *
 * Каждый показатель хранит свой максимум отдельно — рекорд по убийствам
 * можно поставить и в коротком, но злом забеге. Хранилище бывает
 * недоступно (приватный режим, запрет сайта), поэтому любая ошибка
 * localStorage молча превращается в «рекорда пока нет».
 */

const STORAGE_KEY = 'survive-or-die:record';

/** Показатели, по которым ведётся рекорд, в порядке вывода на экран итогов. */
export const RECORD_FIELDS = ['time', 'kills', 'level', 'damage'];

function emptyRecord() {
  return { runs: 0, time: 0, kills: 0, level: 0, damage: 0 };
}

export function loadRecord() {
  const record = emptyRecord();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(record)) {
        if (Number.isFinite(saved[key]) && saved[key] > 0) record[key] = saved[key];
      }
    }
  } catch {
    // Испорченная запись или нет доступа — начинаем с нуля.
  }
  return record;
}

function saveRecord(record) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Не сохранилось — рекорд проживёт до перезагрузки страницы.
  }
}

/**
 * Учитывает завершённый забег.
 * @returns {{ previous: object, record: object, beaten: Set<string> }}
 *   прошлый рекорд, новый рекорд и какие показатели побиты.
 *   Первый забег рекордом не считается — бить было нечего.
 */
export function submitRun(stats) {
  const previous = loadRecord();
  const record = { ...previous, runs: previous.runs + 1 };
  const beaten = new Set();

  for (const field of RECORD_FIELDS) {
    if (stats[field] > previous[field]) {
      record[field] = stats[field];
      if (previous.runs > 0) beaten.add(field);
    }
  }

  saveRecord(record);
  return { previous, record, beaten };
}
