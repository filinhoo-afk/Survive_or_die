/**
 * Пул объектов: отжившие снаряды, кристаллы и частицы не выбрасываются
 * сборщику мусора, а ждут следующего выстрела. В разгар боя игра рождает
 * сотни таких объектов в секунду — без пула это рывки на сборке мусора.
 *
 * Объект из пула обязан сам переинициализироваться: пул лишь хранит
 * свободные экземпляры и считает, сколько их создано и сколько раз
 * они пошли в дело повторно.
 */
export class Pool {
  /**
   * @param {() => object} create как сделать новый экземпляр, когда свободных нет
   * @param {number} [limit] сколько свободных держать про запас; лишние уходят сборщику
   */
  constructor(create, limit = 2048) {
    this.create = create;
    this.limit = limit;
    this.free = [];
    /** Всего экземпляров, сделанных через create. */
    this.created = 0;
    /** Сколько раз выдан уже использованный экземпляр. */
    this.reused = 0;
  }

  /** Свободный экземпляр или новый; поля задаёт вызывающий. */
  obtain() {
    const item = this.free.pop();
    if (item) {
      this.reused += 1;
      return item;
    }
    this.created += 1;
    return this.create();
  }

  /** Возвращает экземпляр; recycle() — чтобы он не держал ссылок, пока ждёт. */
  release(item) {
    item.recycle?.();
    if (this.free.length < this.limit) this.free.push(item);
  }

  /** Возвращает в пул всё содержимое массива и очищает его. */
  releaseAll(list) {
    for (const item of list) this.release(item);
    list.length = 0;
  }

  /**
   * Убирает из массива то, что прошло проверку dead, и возвращает в пул.
   * Замена последним вместо splice: порядок не важен, а удаление
   * из середины не двигает весь хвост массива.
   */
  sweep(list, dead) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const item = list[i];
      if (!dead(item)) continue;
      list[i] = list[list.length - 1];
      list.pop();
      this.release(item);
    }
  }
}
