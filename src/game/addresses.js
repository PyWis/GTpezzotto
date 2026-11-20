// Indirizzi dei clienti: portoni su un marciapiede, davanti a un palazzo,
// sparsi in tutta Napoli.

import { hash } from '../core/math.js';
import { districtAt, MAP_H, MAP_W, TILE } from '../data/city.js';
import { grid, index, inBounds, nearestStreetName } from '../world/map.js';
import { Tile } from '../world/tiles.js';

const MIN_SPACING = 10 * TILE; // non due clienti (o la pizzeria) sullo stesso portone

const doorsteps = [];
for (let y = 0; y < MAP_H; y++)
  for (let x = 0; x < MAP_W; x++) {
    if (grid.tile[index(x, y)] !== Tile.SIDEWALK) continue;
    const facesBuilding = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ].some(([dx, dy]) => inBounds(x + dx, y + dy) && grid.tile[index(x + dx, y + dy)] === Tile.BUILDING);
    const street = nearestStreetName(x, y, 2);
    if (facesBuilding && street) doorsteps.push({ x, y, street });
  }

/** Picks a random doorstep at least MIN_SPACING away from every point in `avoid`. */
export function findAddress(rng, avoid = []) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const d = doorsteps[Math.floor(rng() * doorsteps.length)];
    const x = (d.x + 0.5) * TILE;
    const y = (d.y + 0.5) * TILE;
    if (avoid.some(([ax, ay]) => Math.hypot(ax - x, ay - y) < MIN_SPACING)) continue;
    const civic = 1 + Math.floor(hash(d.x, d.y, 42) * 180);
    return { x, y, street: d.street, label: `${d.street}, ${civic}`, district: districtAt(d.x, d.y) };
  }
  throw new Error('no free doorstep found');
}
