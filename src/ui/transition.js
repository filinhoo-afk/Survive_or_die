const FADE_OUT = 0.16;
const FADE_IN = 0.22;
/** Число ступеней затемнения — плавный градиент выбился бы из пиксельного стиля. */
const STEPS = 5;

/**
 * Переход между экранами: экран темнеет, в чёрный момент вызывается
 * действие (смена режима), затем проясняется. Пока идёт переход, ввод глушится.
 */
export function createTransition() {
  let phase = 'idle';
  let time = 0;
  let action = null;

  return {
    get busy() {
      return phase !== 'idle';
    },

    go(fn) {
      if (phase !== 'idle') return;
      phase = 'out';
      time = 0;
      action = fn;
    },

    update(dt) {
      if (phase === 'idle') return;
      time += dt;
      if (phase === 'out' && time >= FADE_OUT) {
        action();
        action = null;
        phase = 'in';
        time = 0;
      } else if (phase === 'in' && time >= FADE_IN) {
        phase = 'idle';
      }
    },

    draw(ctx, canvas) {
      if (phase === 'idle') return;
      const ratio = phase === 'out' ? time / FADE_OUT : 1 - time / FADE_IN;
      const alpha = Math.ceil(Math.min(1, Math.max(0, ratio)) * STEPS) / STEPS;
      if (alpha <= 0) return;
      ctx.fillStyle = `rgba(5, 6, 12, ${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    },
  };
}
