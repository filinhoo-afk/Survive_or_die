/**
 * Игровой цикл с фиксированным шагом физики.
 * update(dt) вызывается ровно step секунд игрового времени,
 * render(alpha) — один раз за кадр.
 */
export function createLoop(update, render, step = 1 / 60) {
  let running = false;
  let lastTime = 0;
  let accumulator = 0;

  function frame(time) {
    if (!running) return;

    // Переводим в секунды и защищаемся от «скачка» после потери фокуса вкладки.
    const delta = Math.min((time - lastTime) / 1000, 0.25);
    lastTime = time;
    accumulator += delta;

    while (accumulator >= step) {
      update(step);
      accumulator -= step;
    }

    render(accumulator / step);
    requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      accumulator = 0;
      requestAnimationFrame(frame);
    },
    stop() {
      running = false;
    },
  };
}
