/** Стартовая локация: тёмная пустошь с травой, камнями и костями. */
export const WASTELAND = {
  id: 'wasteland',
  title: 'Пустошь',
  /** Секунд до босса; null — забег бесконечный, босса пока нет. */
  duration: null,
  world: { width: 2880, height: 1800 },
  colors: {
    outside: '#080a10',
    border: '#31405e',
  },
  /** Какие враги тут водятся — id из enemies/types.js. */
  enemies: ['grunt', 'swarm', 'tank', 'shooter'],
  ground: {
    /** Цвета зерна плитки: a — основа, остальные — пятна. */
    palette: { a: '#1b2418', b: '#1f2a1b', c: '#17201a', d: '#243020' },
    /** Доля плиток с декором. */
    decorChance: 0.18,
    /** Декор: клип из art/terrain.js и вес — травы много, черепа редкость. */
    decor: [
      { clip: 'decor.tuft', weight: 6 },
      { clip: 'decor.stone', weight: 3 },
      { clip: 'decor.bone', weight: 2 },
      { clip: 'decor.skull', weight: 1 },
    ],
  },
};
