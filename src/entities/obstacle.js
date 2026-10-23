import { atlas } from '../art/index.js';
import { drawFrame } from '../gfx/atlas.js';

/** Неподвижное препятствие: круг столкновений и спрайт, стоящий на его нижней кромке. */
export class Obstacle {
  constructor(x, y, kind) {
    this.x = x;
    this.y = y;
    this.radius = kind.radius;
    this.clip = atlas.clips[kind.clip];
    this.scale = kind.scale;
  }

  get footY() {
    return this.y + this.radius;
  }

  draw(ctx) {
    drawFrame(ctx, atlas, this.clip.rects[0], this.clip.anchor, this.x, this.footY, {
      scale: this.scale,
    });
  }
}
