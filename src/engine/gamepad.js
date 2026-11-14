/**
 * Геймпад: левый стик и крестовина двигают героя, кнопки заменяют клавиши меню.
 * Опрашивается каждый кадр — события у Gamepad API нет, только состояние.
 */

const DEADZONE = 0.25;
/** Стик больше этого порога листает меню как нажатие стрелки. */
const MENU_THRESHOLD = 0.6;

/** Кнопки стандартной раскладки → имена, которые понимает main.js. */
const BUTTONS = {
  0: 'a', 1: 'b', 2: 'x', 3: 'y', 4: 'lb', 9: 'start',
  12: 'up', 13: 'down', 14: 'left', 15: 'right',
};

/** Мёртвая зона по длине вектора, а не по осям — иначе стик «прилипает» к осям. */
export function applyDeadzone(x, y, deadzone = DEADZONE) {
  const length = Math.hypot(x, y);
  if (length < deadzone) return { x: 0, y: 0 };
  const k = Math.min(1, (length - deadzone) / (1 - deadzone)) / length;
  return { x: x * k, y: y * k };
}

export function createGamepad(nav = globalThis.navigator) {
  let previous = new Set();

  function active() {
    const pads = nav?.getGamepads?.() ?? [];
    for (const pad of pads) if (pad?.connected) return pad;
    return null;
  }

  const held = (pad, index) => (pad.buttons[index]?.pressed ? 1 : 0);

  return {
    get connected() {
      return active() !== null;
    },

    /** @returns {{x: number, y: number}} вектор длиной не больше 1 */
    getAxis() {
      const pad = active();
      if (!pad) return { x: 0, y: 0 };
      const stick = applyDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      let x = stick.x + held(pad, 15) - held(pad, 14);
      let y = stick.y + held(pad, 13) - held(pad, 12);
      const length = Math.hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }
      return { x, y };
    },

    /** Имена кнопок, нажатых с прошлого опроса; стик в стороны даёт 'up'/'down'/'left'/'right'. */
    justPressed() {
      const pad = active();
      const now = new Set();
      if (pad) {
        for (const [index, name] of Object.entries(BUTTONS)) {
          if (pad.buttons[index]?.pressed) now.add(name);
        }
        const sx = pad.axes[0] ?? 0;
        const sy = pad.axes[1] ?? 0;
        if (sx > MENU_THRESHOLD) now.add('right');
        if (sx < -MENU_THRESHOLD) now.add('left');
        if (sy > MENU_THRESHOLD) now.add('down');
        if (sy < -MENU_THRESHOLD) now.add('up');
      }
      const fresh = [...now].filter((name) => !previous.has(name));
      previous = now;
      return fresh;
    },
  };
}
