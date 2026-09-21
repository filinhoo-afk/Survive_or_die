const KEY_MAP = {
  KeyW: 'up',    ArrowUp: 'up',
  KeyS: 'down',  ArrowDown: 'down',
  KeyA: 'left',  ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

/** Состояние клавиатуры + нормализованный вектор направления. */
export function createInput(target = window) {
  const pressed = new Set();

  target.addEventListener('keydown', (e) => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    pressed.add(action);
    e.preventDefault();
  });

  target.addEventListener('keyup', (e) => {
    const action = KEY_MAP[e.code];
    if (action) pressed.delete(action);
  });

  // Отпускаем всё, когда вкладка теряет фокус — иначе игрок «залипает».
  target.addEventListener('blur', () => pressed.clear());

  return {
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
      return { x, y };
    },
  };
}
