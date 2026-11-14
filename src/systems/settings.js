/**
 * Настройки игрока: громкость трёх каналов и клавиши движения.
 * Хранятся в едином сохранении (save.js). Чтение всегда проверяет данные:
 * запись могла испортиться или прийти из старой версии без нужных полей.
 */

import { patchSave, readSave } from './save.js';

/** Действия движения, которые можно переназначить; на каждое — две клавиши. */
export const BINDING_ACTIONS = [
  { id: 'up', title: 'Вверх' },
  { id: 'down', title: 'Вниз' },
  { id: 'left', title: 'Влево' },
  { id: 'right', title: 'Вправо' },
];

export const DEFAULT_BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

/** Клавиши, которые заняты меню и общими командами, — на движение их не отдаём. */
export const RESERVED_KEYS = new Set([
  'Escape', 'Enter', 'Space', 'F3', 'KeyN', 'KeyP', 'KeyR', 'KeyM', 'KeyB', 'KeyO',
  'Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3',
]);

/** Громкость идёт шагами по 10 %, чтобы значения на экране и в файле совпадали. */
export const VOLUME_STEPS = 10;
export const VOLUME_CHANNELS = [
  { id: 'master', title: 'Общая' },
  { id: 'music', title: 'Музыка' },
  { id: 'sfx', title: 'Эффекты' },
];

export function defaultSettings() {
  return {
    master: 1,
    music: 1,
    sfx: 1,
    bindings: Object.fromEntries(Object.entries(DEFAULT_BINDINGS).map(([k, v]) => [k, [...v]])),
  };
}

export function clampVolume(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.round(Math.min(1, Math.max(0, value)) * VOLUME_STEPS) / VOLUME_STEPS;
}

function cleanSlot(value) {
  return typeof value === 'string' && value.length > 0 && !RESERVED_KEYS.has(value) ? value : null;
}

/** Приводит любые данные к настройкам: плохие поля заменяются значениями по умолчанию. */
export function sanitize(raw) {
  const base = defaultSettings();
  if (!raw || typeof raw !== 'object') return base;
  for (const { id } of VOLUME_CHANNELS) {
    if (id in raw) base[id] = clampVolume(Number(raw[id]));
  }
  const bindings = raw.bindings;
  if (bindings && typeof bindings === 'object') {
    const used = new Set();
    for (const { id } of BINDING_ACTIONS) {
      const slots = Array.isArray(bindings[id]) ? bindings[id] : [];
      const next = [cleanSlot(slots[0]), cleanSlot(slots[1])].map((code) => {
        if (!code || used.has(code)) return null;
        used.add(code);
        return code;
      });
      // Действие без единой клавиши делает игру непроходимой — возвращаем умолчание.
      base.bindings[id] = next[0] || next[1] ? next : [...DEFAULT_BINDINGS[id]];
    }
  }
  return base;
}

export function loadSettings() {
  return sanitize(readSave().settings);
}

export function saveSettings(settings) {
  patchSave({ settings });
}

/**
 * Назначает клавишу действию как основную. Если она уже стояла на другом
 * действии, оттуда она снимается; прежняя основная клавиша уходит в запасную.
 * Возвращает новые настройки или null, если клавиша зарезервирована.
 */
export function rebind(settings, action, code) {
  if (RESERVED_KEYS.has(code)) return null;
  const bindings = {};
  for (const [id, slots] of Object.entries(settings.bindings)) {
    bindings[id] = slots.map((slot) => (slot === code ? null : slot));
  }
  const old = settings.bindings[action][0];
  bindings[action] = [code, old && old !== code ? old : bindings[action][1]];
  // У остальных действий не должно остаться пустых мест вместо единственной клавиши.
  for (const { id } of BINDING_ACTIONS) {
    if (!bindings[id][0] && !bindings[id][1]) bindings[id] = [...DEFAULT_BINDINGS[id]];
  }
  return { ...settings, bindings };
}

/** Человекочитаемое имя клавиши для экрана настроек. */
export function keyLabel(code) {
  if (!code) return '—';
  const arrows = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  if (arrows[code]) return arrows[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  return code.toUpperCase();
}
