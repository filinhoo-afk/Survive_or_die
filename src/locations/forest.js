/** Вторая локация: тёмный лес с папоротником, грибами и соснами. */
export const FOREST = {
  id: 'forest',
  title: 'Лес',
  /** Секунд до босса: восемь минут. */
  duration: 480,
  world: { width: 3200, height: 2000 },
  colors: {
    outside: '#060b08',
    border: '#2f5a3a',
  },
  enemies: ['wolf', 'grunt', 'treant', 'shooter'],
  obstacles: {
    count: 90,
    seed: 33,
    clearRadius: 200,
    gap: 60,
    kinds: [
      { clip: 'obstacle.pine', radius: 16, scale: 5, weight: 4 },
      { clip: 'obstacle.stump', radius: 18, scale: 4, weight: 2 },
      { clip: 'obstacle.boulder', radius: 22, scale: 4, weight: 1 },
    ],
  },
  ground: {
    palette: { a: '#14281a', b: '#183020', c: '#10221a', d: '#1d3a24' },
    decorChance: 0.2,
    decor: [
      { clip: 'decor.fern', weight: 5 },
      { clip: 'decor.leaves', weight: 4 },
      { clip: 'decor.mushroom', weight: 2 },
      { clip: 'decor.stone', weight: 1 },
    ],
  },
};
