import { TILE } from '../data/city.js';
import { VESPA_COLORS } from '../data/people.js';

/** Parked Vespas around the city: [tileX, tileY, heading, colour]. */
const PARKED = [
  [177, 70, -Math.PI / 2, 0], // Piazza del Plebiscito, next to the start
  [134, 91, 0, 1],
  [240, 56, Math.PI, 2],
  [135, 27, Math.PI / 2, 3],
  [190, 44, 0, 4],
  [204, 84, Math.PI / 2, 1],
  [76, 62, 0, 3],
  [60, 55, Math.PI / 2, 1],
  [282, 38, -Math.PI / 2, 4],
  [266, 64, 0, 2],
  [136, 34, 0, 0],
  [28, 72, 0, 1],
  [310, 62, Math.PI, 4],
  [330, 84, 0, 2],
];

export const vespas = PARKED.map(([tx, ty, a, c]) => ({
  x: (tx + 0.5) * TILE,
  y: (ty + 0.5) * TILE,
  a,
  v: 0,
  color: VESPA_COLORS[c],
  ridden: false,
}));

export function nearestFreeVespa(x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const v of vespas) {
    if (v.ridden) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}
