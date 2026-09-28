/**
 * Двигает кристаллы и собирает те, что долетели до игрока.
 * @returns {number} опыт, собранный в этом кадре
 */
export function updateGems(gems, player, dt) {
  let xp = 0;

  for (let i = gems.length - 1; i >= 0; i -= 1) {
    const gem = gems[i];
    gem.update(dt, player);
    if (!gem.collected) continue;

    xp += gem.value;
    gems[i] = gems[gems.length - 1];
    gems.pop();
  }

  return xp;
}
