/**
 * Пространственная сетка: мир делится на квадратные клетки, каждый объект
 * лежит в клетке своего центра. Запрос «кто рядом с точкой» смотрит только
 * соседние клетки — вместо перебора всех объектов.
 *
 * Сетка лишь отбирает кандидатов: точную проверку расстояния делает тот,
 * кто спрашивает. Поэтому лишний кандидат безвреден, а пропуск — нет.
 *
 * Объект с радиусом больше половины клетки (боссы, крупная элита) торчит
 * в соседние клетки сильнее, чем закладывает запрос. Таких единицы, и они
 * лежат отдельным списком, который попадает в ответ на любой запрос.
 */
export class SpatialGrid {
  /**
   * @param {number} cellSize сторона клетки; вдвое больше радиуса обычного объекта
   * @param {number} [slack] запас на смещения после постройки: отброс, расталкивание
   */
  constructor(width, height, cellSize = 64, slack = 24) {
    this.cellSize = cellSize;
    this.slack = slack;
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
    /** Номера непустых клеток: очистка не обходит всю сетку. */
    this.used = [];
    this.large = [];
    this.scratch = [];
  }

  /** Перекладывает объекты заново: враги двигаются, сетку строим каждый кадр. */
  rebuild(items) {
    for (const index of this.used) this.cells[index].length = 0;
    this.used.length = 0;
    this.large.length = 0;
    for (const item of items) this.insert(item);
    return this;
  }

  insert(item) {
    if (item.radius > this.cellSize / 2) {
      this.large.push(item);
      return;
    }
    const index = this.row(item.y) * this.cols + this.col(item.x);
    const cell = this.cells[index];
    if (cell.length === 0) this.used.push(index);
    cell.push(item);
  }

  /**
   * Кандидаты, которые могут касаться круга (x, y, range).
   *
   * Ответ по умолчанию пишется в общий буфер сетки: его надо разобрать
   * до следующего запроса. Для вложенных запросов передайте свой out.
   */
  query(x, y, range, out = this.scratch) {
    out.length = 0;
    // Объект в соседней клетке торчит из неё не больше чем на полклетки.
    const reach = range + this.cellSize / 2 + this.slack;
    const left = this.col(x - reach);
    const right = this.col(x + reach);
    const top = this.row(y - reach);
    const bottom = this.row(y + reach);

    for (let row = top; row <= bottom; row += 1) {
      for (let col = left; col <= right; col += 1) {
        for (const item of this.cells[row * this.cols + col]) out.push(item);
      }
    }
    for (const item of this.large) out.push(item);
    return out;
  }

  /** За краем мира — крайняя клетка: так и кладём, и ищем. */
  col(x) {
    return Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cellSize)));
  }

  row(y) {
    return Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cellSize)));
  }
}
