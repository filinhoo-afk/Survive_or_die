import { drawText, measureText, textHeight } from '../gfx/font.js';
import { pixelPanel, UI_COLORS } from '../ui/panel.js';

/** Сколько последних кадров хранит график. */
const HISTORY = 120;
/** Вес нового кадра в сглаженном среднем: цифры не прыгают каждый кадр. */
const SMOOTHING = 0.08;
/** Бюджет кадра при 60 FPS, мс. */
const BUDGET = 1000 / 60;

/**
 * Профилировщик кадра: сколько миллисекунд уходит на каждую часть логики
 * и отрисовки, частота кадров, худший кадр и заполненность пулов.
 *
 * Замеры — «круги секундомера»: begin(группа) запускает его, каждый
 * lap(имя) записывает время с прошлой отметки. Выключенный профилировщик
 * не трогает часы вовсе — его можно оставлять в коде навсегда.
 */
export class Profiler {
  constructor() {
    this.enabled = false;
    /** @type {Map<string, {group: string, current: number, average: number}>} */
    this.sections = new Map();
    this.group = '';
    this.mark = 0;
    /** Интервалы между кадрами, мс, — по кругу. */
    this.frames = new Float32Array(HISTORY);
    this.frameIndex = 0;
    this.lastFrame = 0;
    this.frameAverage = BUDGET;
    /** Шагов логики за кадр: больше одного — логика не успевает за экраном. */
    this.steps = 0;
    this.stepsShown = 0;
  }

  toggle() {
    this.enabled = !this.enabled;
    this.lastFrame = 0;
    this.frames.fill(0);
    this.sections.clear();
  }

  /** Начинает группу замеров: «логика» или «отрисовка». */
  begin(group) {
    if (!this.enabled) return;
    this.group = group;
    this.mark = performance.now();
    if (group === 'логика') this.steps += 1;
  }

  /** Время с прошлой отметки уходит в раздел name текущей группы. */
  lap(name) {
    if (!this.enabled) return;
    const now = performance.now();
    let section = this.sections.get(name);
    if (!section) {
      section = { group: this.group, current: 0, average: 0 };
      this.sections.set(name, section);
    }
    section.current += now - this.mark;
    this.mark = now;
  }

  /** Конец кадра: сглаживаем разделы и запоминаем интервал между кадрами. */
  endFrame() {
    if (!this.enabled) return;
    for (const section of this.sections.values()) {
      section.average += (section.current - section.average) * SMOOTHING;
      section.current = 0;
    }

    const now = performance.now();
    if (this.lastFrame > 0) {
      const interval = now - this.lastFrame;
      this.frames[this.frameIndex] = interval;
      this.frameIndex = (this.frameIndex + 1) % HISTORY;
      this.frameAverage += (interval - this.frameAverage) * SMOOTHING;
    }
    this.lastFrame = now;
    this.stepsShown = this.steps;
    this.steps = 0;
  }

  /** Сумма сглаженных разделов группы, мс. */
  total(group) {
    let sum = 0;
    for (const section of this.sections.values()) if (section.group === group) sum += section.average;
    return sum;
  }

  get worstFrame() {
    let worst = 0;
    for (const interval of this.frames) worst = Math.max(worst, interval);
    return worst;
  }

  /**
   * Панель поверх игры — столбец у правого края, под миникартой:
   * герой в центре экрана остаётся на виду.
   * @param {[string, import('./pool.js').Pool, number][]} pools пул и сколько его объектов сейчас в деле
   */
  draw(ctx, canvas, pools) {
    if (!this.enabled) return;

    const scale = 2;
    const line = textHeight(scale) + 3;
    const width = 292;
    const graphHeight = 24;
    const groups = ['логика', 'отрисовка'];
    const rows = this.sections.size + groups.length + pools.length + 1;
    const height = 20 + textHeight(3) + 4 + line + graphHeight + 6 + line * rows + 4 * (groups.length + 1);
    const x = canvas.width - width - 10;
    const y = Math.max(8, Math.min(100, canvas.height - height - 8));

    ctx.save();
    ctx.globalAlpha = 0.9;
    pixelPanel(ctx, x, y, width, height, UI_COLORS.well, UI_COLORS.border);
    ctx.globalAlpha = 1;

    const left = x + 10;
    const right = x + width - 10;
    const dim = { scale, color: UI_COLORS.dim };
    const value = { scale, align: 'right', color: UI_COLORS.text };
    let cy = y + 10;

    const fps = 1000 / Math.max(1, this.frameAverage);
    const fpsColor = fps >= 55 ? UI_COLORS.accent : fps >= 40 ? UI_COLORS.record : UI_COLORS.danger;
    drawText(ctx, `FPS ${Math.round(fps)}`, left, cy, { scale: 3, color: fpsColor });
    drawText(ctx, `${this.frameAverage.toFixed(1)} MS`, right, cy + 7, value);
    cy += textHeight(3) + 4;
    drawText(ctx, `ХУДШИЙ ${this.worstFrame.toFixed(1)}`, left, cy, dim);
    // Размер кучи знает только Chromium; в других браузерах строка пустая.
    const heap = performance.memory?.usedJSHeapSize;
    if (heap) drawText(ctx, `КУЧА ${(heap / 1048576).toFixed(1)} МБ`, right, cy, { ...dim, align: 'right' });
    cy += line;

    this.drawGraph(ctx, left, cy, right - left, graphHeight);
    cy += graphHeight + 6;

    // Разделы: время в мс и полоска — доля бюджета кадра в 16.7 мс.
    const barX = left + 156;
    const barWidth = 48;
    for (const group of groups) {
      cy += 4;
      drawText(ctx, group.toUpperCase(), left, cy, { scale, color: UI_COLORS.title });
      drawText(ctx, this.total(group).toFixed(2), right, cy, { ...value, color: UI_COLORS.title });
      if (group === 'логика') drawText(ctx, `ШАГОВ ${this.stepsShown}`, left + 96, cy, dim);
      cy += line;
      for (const [name, section] of this.sections) {
        if (section.group !== group) continue;
        const share = Math.min(1, section.average / BUDGET);
        ctx.fillStyle = UI_COLORS.border;
        ctx.fillRect(barX, cy + 4, barWidth, 6);
        ctx.fillStyle = share > 0.25 ? UI_COLORS.danger : share > 0.1 ? UI_COLORS.record : UI_COLORS.accent;
        ctx.fillRect(barX, cy + 4, Math.max(1, Math.round(barWidth * share)), 6);
        drawText(ctx, name, left + 8, cy, dim);
        drawText(ctx, section.average.toFixed(2), right, cy, value);
        cy += line;
      }
    }

    // Пулы: сколько объектов в деле, сколько создано всего и какая доля
    // выдач обошлась без new.
    cy += 4;
    drawText(ctx, 'ПУЛЫ', left, cy, { scale, color: UI_COLORS.title });
    drawText(ctx, 'В ДЕЛЕ/ВСЕГО', right, cy, { ...dim, align: 'right' });
    cy += line;
    for (const [label, pool, active] of pools) {
      const given = pool.created + pool.reused;
      const reuse = given > 0 ? Math.round((pool.reused / given) * 100) : 0;
      drawText(ctx, label, left + 8, cy, dim);
      drawText(ctx, `${active}/${pool.created} ${reuse}%`, right, cy, value);
      cy += line;
    }

    ctx.restore();
  }

  /** Столбики интервалов между кадрами; линия — бюджет 60 FPS. */
  drawGraph(ctx, x, y, width, height) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(x, y, width, height);
    // Шкала до 33 мс: всё, что выше, — уже 30 FPS и хуже, упирается в потолок.
    const ceiling = BUDGET * 2;
    const bar = width / HISTORY;
    for (let i = 0; i < HISTORY; i += 1) {
      const interval = this.frames[(this.frameIndex + i) % HISTORY];
      if (interval <= 0) continue;
      const h = Math.max(1, Math.round((Math.min(interval, ceiling) / ceiling) * height));
      ctx.fillStyle = interval > BUDGET * 1.25 ? UI_COLORS.danger : UI_COLORS.accent;
      ctx.fillRect(x + i * bar, y + height - h, Math.max(1, bar - 0.5), h);
    }
    ctx.fillStyle = UI_COLORS.record;
    ctx.fillRect(x, y + height / 2, width, 1);
    drawText(ctx, '60', x + width - measureText('60', 1) - 1, y + height / 2 - 9, { scale: 1, color: UI_COLORS.record });
  }
}

export const profiler = new Profiler();
