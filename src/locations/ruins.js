/**
 * Третья локация: руины с узкими проходами. Стены собраны из блоков, между
 * отрезками оставлены проходы — в них толпа вытягивается в цепочку, зато
 * призраки идут сквозь камень.
 */
export const RUINS = {
  id: 'ruins',
  title: 'Руины',
  /** Секунд до босса: восемь минут. */
  duration: 480,
  world: { width: 3200, height: 2000 },
  colors: {
    outside: '#07060b',
    border: '#4a4468',
  },
  /** Босс, который выходит, когда истекает duration. */
  boss: 'necromancer',
  enemies: ['ghost', 'grunt', 'shooter', 'wraith', 'tank'],
  obstacles: {
    count: 28,
    seed: 36,
    clearRadius: 220,
    gap: 70,
    kinds: [
      { clip: 'obstacle.pillar', radius: 16, scale: 5, weight: 3 },
      { clip: 'obstacle.boulder', radius: 22, scale: 4, weight: 1 },
    ],
    /** Блок стены ставится каждые step пикселей вдоль отрезка. */
    wall: { clip: 'obstacle.ruinwall', radius: 18, scale: 4, step: 30 },
    /** Отрезки стен: промежутки между ними — проходы шириной ~200. */
    walls: [
      ...[
        [160, 760],
        [960, 1560],
        [1760, 2360],
        [2560, 3040],
      ].map(([x1, x2]) => ({ x1, y1: 600, x2, y2: 600 })),
      ...[
        [160, 560],
        [760, 1360],
        [1560, 2160],
        [2360, 3040],
      ].map(([x1, x2]) => ({ x1, y1: 1400, x2, y2: 1400 })),
      ...[900, 2300].flatMap((x) =>
        [
          [100, 460],
          [740, 1260],
          [1540, 1900],
        ].map(([y1, y2]) => ({ x1: x, y1, x2: x, y2 })),
      ),
    ],
  },
  ground: {
    palette: { a: '#1c1b26', b: '#211f2c', c: '#16151f', d: '#282536' },
    decorChance: 0.16,
    decor: [
      { clip: 'decor.rubble', weight: 5 },
      { clip: 'decor.rune', weight: 2 },
      { clip: 'decor.bone', weight: 2 },
      { clip: 'decor.skull', weight: 1 },
    ],
  },
};
