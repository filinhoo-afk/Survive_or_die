import { drawFrame } from './atlas.js';

/** Проигрывает клипы атласа: помнит текущий клип и время в нём. */
export class Animator {
  /**
   * @param {{canvas: HTMLCanvasElement, clips: Record<string, object>}} atlas
   * @param {string} initial клип, с которого начинаем
   */
  constructor(atlas, initial) {
    this.atlas = atlas;
    this.clip = null;
    this.time = 0;
    this.play(initial, true);
  }

  /**
   * Переключает клип. Повторный вызов с тем же именем ничего не сбрасывает,
   * поэтому его безопасно звать каждый кадр из логики «стоит или идёт».
   */
  play(name, restart = false) {
    const clip = this.atlas.clips[name];
    if (!clip) throw new Error(`нет клипа «${name}» в атласе`);
    if (this.clip === clip && !restart) return;
    this.clip = clip;
    this.time = 0;
  }

  /**
   * Переключает клип, не сбрасывая время: для клипов с одинаковым циклом
   * (ходьба и её белая вспышка), когда шаг не должен начинаться заново.
   */
  swap(name) {
    const time = this.time;
    this.play(name);
    this.time = time;
  }

  update(dt) {
    this.time += dt;
  }

  /** Номер показываемого кадра внутри клипа (с учётом order). */
  get frameIndex() {
    const { fps, loop, rects } = this.clip;
    if (fps <= 0 || rects.length <= 1) return 0;
    const step = Math.floor(this.time * fps);
    return loop ? step % rects.length : Math.min(step, rects.length - 1);
  }

  /** Клип без цикла доиграл до последнего кадра — по этому можно сменить состояние. */
  get finished() {
    const { fps, loop, rects } = this.clip;
    if (loop || fps <= 0) return false;
    return Math.floor(this.time * fps) >= rects.length - 1;
  }

  draw(ctx, x, y, options) {
    drawFrame(ctx, this.atlas, this.clip.rects[this.frameIndex], this.clip.anchor, x, y, options);
  }
}
