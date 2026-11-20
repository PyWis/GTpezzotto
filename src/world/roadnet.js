// What a car finds at the end of its road: another road to turn into, the
// edge of the map (it drives out of town), or a car park (it stops for a while).

import { clamp, distToSegment, hash } from '../core/math.js';
import { MAP_H, MAP_W, PARKINGS, PLAZAS, ROADS, TILE } from '../data/city.js';
import './map.js'; // builds road.points / road.cumulative

export const DRIVABLE = ROADS.filter((r) => r.kind !== 'vicolo');

/** Nearest point of a road to (x, y) in tile units: { s (px along the road), d (tiles) }. */
function nearestOnRoad(road, x, y) {
  let best = { s: 0, d: Infinity };
  for (let k = 0; k < road.path.length - 1; k++) {
    const [ax, ay] = road.path[k];
    const [bx, by] = road.path[k + 1];
    const d = distToSegment(x, y, ax, ay, bx, by);
    if (d >= best.d) continue;
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = len2 ? clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2, 0, 1) : 0;
    best = { s: road.cumulative[k] + t * (road.cumulative[k + 1] - road.cumulative[k]), d };
  }
  return best;
}

const inRect = ([x0, y0, x1, y1], x, y, m) => x >= x0 - m && x <= x1 + m && y >= y0 - m && y <= y1 + m;
const outside = ([x, y]) => x < 0 || y < 0 || x > MAP_W || y > MAP_H;

/** Directions a car may take from position s on a road (not straight back off its end). */
function directions(road, s) {
  if (s < TILE) return [1];
  if (s > road.length - TILE) return [-1];
  return [1, -1];
}

/**
 * For every drivable road, what lies at its start (`ends[0]`) and its end (`ends[1]`):
 *  - `links`: roads to continue on, with the entry point and allowed directions;
 *  - `exit`: true if the road leaves the map (cars drive out and others come in);
 *  - `parking`: index into PARKINGS of the car park at a dead end.
 */
function buildNetwork() {
  for (const road of DRIVABLE) {
    road.ends = [0, 1].map((end) => {
      const [x, y] = end ? road.path.at(-1) : road.path[0];
      const links = [];
      for (const other of DRIVABLE) {
        if (other === road) continue;
        const near = nearestOnRoad(other, x, y);
        if (near.d <= (road.width + other.width) / 2 + 0.6) links.push({ road: other, s: near.s });
      }
      // Ends that open onto a square: carry on with the other roads around it.
      if (!links.length)
        for (const plaza of PLAZAS) {
          if (plaza.parking || !inRect(plaza.rect, x, y, 1.5)) continue;
          for (const other of DRIVABLE) {
            if (other === road || links.some((l) => l.road === other)) continue;
            const [px0, py0, px1, py1] = plaza.rect;
            const cx = clamp(x, px0, px1);
            const cy = clamp(y, py0, py1);
            const near = nearestOnRoad(other, cx, cy);
            if (near.d <= other.width / 2 + 1.5 || touchesRect(other, plaza.rect)) {
              links.push({ road: other, s: nearestOnRoad(other, x, y).s });
            }
          }
        }
      for (const l of links) l.dirs = directions(l.road, l.s);
      const exit = outside([x, y]);
      const parking = links.length || exit ? -1 : PARKINGS.findIndex((p) => inRect(p.rect, x, y, 1.5));
      return { x: x * TILE, y: y * TILE, links, exit, parking };
    });
  }
}

function touchesRect(road, rect) {
  for (let k = 0; k < road.path.length - 1; k++) {
    const [ax, ay] = road.path[k];
    const [bx, by] = road.path[k + 1];
    for (let t = 0; t <= 1; t += 0.05) if (inRect(rect, ax + (bx - ax) * t, ay + (by - ay) * t, 1.5)) return true;
  }
  return false;
}

buildNetwork();

/** Road ends outside the map: where cars leave town and new ones arrive. */
export const GATES = DRIVABLE.flatMap((road) =>
  road.ends.flatMap((e, end) => (e.exit ? [{ road, end, x: e.x, y: e.y }] : [])),
);

// ---------------------------------------------------------------------------
// Car parks: a row of stalls along the long side of each lot.
// ---------------------------------------------------------------------------
export const parkingLots = PARKINGS.map((p, pi) => {
  const [x0, y0, x1, y1] = p.rect;
  const wide = x1 - x0 >= y1 - y0;
  const stalls = [];
  // Stalls are ~1.3 tiles wide, nose in, on one row (two if the lot is deep enough).
  const rows = (wide ? y1 - y0 : x1 - x0) >= 4 ? 2 : 1;
  const along = wide ? x1 - x0 : y1 - y0;
  const count = Math.max(1, Math.floor(along / 1.3));
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < count; k++) {
      const u = (k + 0.5) * (along / count);
      const v = r === 0 ? 0.9 : (wide ? y1 - y0 : x1 - x0) - 0.9;
      const [tx, ty] = wide ? [x0 + u, y0 + v] : [x0 + v, y0 + u];
      const a = wide ? (r === 0 ? -Math.PI / 2 : Math.PI / 2) : r === 0 ? Math.PI : 0;
      stalls.push({ x: tx * TILE, y: ty * TILE, a, car: null, parked: hash(pi, stalls.length, 77) < 0.55 });
    }
  return { ...p, stalls };
});
