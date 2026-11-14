import { createGamepad } from './gamepad.js';

const DEFAULT_BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

/** Код клавиши → действие по таблице назначений (до двух клавиш на действие). */
function buildKeyMap(bindings) {
  const map = {};
  for (const [action, codes] of Object.entries(bindings)) {
    for (const code of codes) if (code) map[code] = action;
  }
  return map;
}

/** Состояние клавиатуры и геймпада + нормализованный вектор направления. */
export function createInput(target = window, bindings = DEFAULT_BINDINGS, gamepad = createGamepad()) {
  const pressed = new Set();
  let keyMap = buildKeyMap(bindings);

  target.addEventListener('keydown', (e) => {
    const action = keyMap[e.code];
    if (!action) return;
    pressed.add(action);
    e.preventDefault();
  });

  target.addEventListener('keyup', (e) => {
    const action = keyMap[e.code];
    if (action) pressed.delete(action);
  });

  // Отпускаем всё, когда вкладка теряет фокус — иначе игрок «залипает».
  target.addEventListener('blur', () => pressed.clear());

  return {
    gamepad,
    /** Новые назначения вступают в силу сразу; зажатое под старыми — отпускаем. */
    setBindings(next) {
      keyMap = buildKeyMap(next);
      pressed.clear();
    },
    isDown: (action) => pressed.has(action),
    /** @returns {{x: number, y: number}} вектор длиной 0 или 1 */
    getAxis() {
      let x = (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0);
      let y = (pressed.has('down') ? 1 : 0) - (pressed.has('up') ? 1 : 0);

      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.SQRT2;
        x *= inv;
        y *= inv;
      }

      // Клавиши главнее: если они зажаты, стик не мешает; иначе движет аналог.
      if (x === 0 && y === 0) return gamepad.getAxis();
      return { x, y };
    },
  };
}
