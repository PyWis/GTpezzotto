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

const toWorld = (d) => [(d.x + 0.5) * TILE, (d.y + 0.5) * TILE];

/**
 * Doorsteps that respect the distance limits from `from` (world px). If none
 * is far enough (or close enough), falls back to the best 3% of the city.
 */
function candidates({ from, minDist = 0, maxDist = Infinity }) {
  if (!from || (minDist <= 0 && maxDist === Infinity)) return doorsteps;
  const dist = (d) => Math.hypot(toWorld(d)[0] - from[0], toWorld(d)[1] - from[1]);
  const ok = doorsteps.filter((d) => {
    const r = dist(d);
    return r >= minDist && r <= maxDist;
  });
  if (ok.length >= 10) return ok;
  const sorted = [...doorsteps].sort((a, b) => (minDist > 0 ? dist(b) - dist(a) : dist(a) - dist(b)));
  return sorted.slice(0, Math.max(10, Math.ceil(sorted.length * 0.03)));
}

/**
 * Picks a random doorstep at least MIN_SPACING away from every point in `avoid`.
 * Options: `from` (world point), `minDist`/`maxDist` from it, in px.
 */
export function findAddress(rng, avoid = [], options = {}) {
  const pool = candidates(options);
  for (let attempt = 0; attempt < 200; attempt++) {
    const d = pool[Math.floor(rng() * pool.length)];
    const [x, y] = toWorld(d);
    if (avoid.some(([ax, ay]) => Math.hypot(ax - x, ay - y) < MIN_SPACING)) continue;
    const civic = 1 + Math.floor(hash(d.x, d.y, 42) * 180);
    return { x, y, street: d.street, label: `${d.street}, ${civic}`, district: districtAt(d.x, d.y) };
  }
  throw new Error('no free doorstep found');
}
