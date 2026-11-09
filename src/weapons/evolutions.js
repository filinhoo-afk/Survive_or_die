import { cannon } from './cannon.js';
import { knife } from './knife.js';
import { orbit } from './orbit.js';
import { aura } from './aura.js';

/**
 * Эволюции: оружие на максимальном уровне плюс взятая пассивка
 * превращаются в новое оружие. Поведение берётся у исходного оружия,
 * меняются характеристики и внешний вид.
 *
 *   evolvesFrom — какое оружие превращается;
 *   requires    — какая пассивка нужна (хотя бы первый ранг).
 *
 * Уровней у эволюции нет: это вершина ветки.
 */
export const EVOLUTIONS = [
  {
    ...cannon,
    id: 'thunder',
    title: 'Громобой',
    description: 'Пушка + Сила: три тяжёлых заряда прошивают толпу',
    color: '#ffd65a',
    icon: 'thunder',
    evolvesFrom: 'cannon',
    requires: 'might',
    shotClip: 'shot.thunder',
    base: {
      cooldown: 0.4,
      damage: 48,
      range: 480,
      speed: 620,
      count: 3,
      pierce: 3,
      shotRadius: 7,
    },
    levels: [],
  },
  {
    ...knife,
    id: 'blades',
    title: 'Вихрь клинков',
    description: 'Нож + Спешка: клинки летят во все восемь сторон',
    color: '#ffe9a0',
    icon: 'blades',
    evolvesFrom: 'knife',
    requires: 'haste',
    shotClip: 'shot.blade',
    base: {
      cooldown: 0.5,
      damage: 30,
      speed: 680,
      lifetime: 0.7,
      count: 8,
      pierce: 5,
      spread: Math.PI / 4,
    },
    levels: [],
  },
  {
    ...orbit,
    id: 'bastion',
    title: 'Бастион',
    description: 'Щит + Броня: шесть тяжёлых шаров сбивают вражеские снаряды',
    color: '#f2c14e',
    icon: 'bastion',
    evolvesFrom: 'orbit',
    requires: 'armor',
    ballClip: 'orbit.bastion',
    base: {
      count: 6,
      damage: 26,
      radius: 120,
      orbSize: 13,
      rotation: 4.2,
      hitInterval: 0.4,
      blocksShots: true,
    },
    levels: [],
  },
  {
    ...aura,
    id: 'sanctum',
    title: 'Святая земля',
    description: 'Аура + Регенерация: жжёт шире и лечит, пока задевает врагов',
    color: '#ffe27a',
    icon: 'sanctum',
    evolvesFrom: 'aura',
    requires: 'regen',
    auraColor: '#ffd65a',
    base: {
      radius: 135,
      damage: 24,
      cooldown: 0.3,
      knockback: 0.35,
      /** Здоровья за импульс, задевший хотя бы одного врага. */
      heal: 1,
    },
    levels: [],
  },
];
