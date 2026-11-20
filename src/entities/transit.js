import { cumulativeLengths, pointAlong } from '../core/math.js';
import { FUNICULARS, METRO_LINES, RAILYARD, TILE } from '../data/city.js';
import { snapToWalkable } from '../world/map.js';
import { player } from './player.js';

const STATION_RANGE = 28;
const FUNICULAR_SPEED = 150; // px/s

// Snap every station to the nearest walkable tile.
for (const f of FUNICULARS) {
  f.A = snapToWalkable(...f.lower.at);
  f.B = snapToWalkable(...f.upper.at);
  f.length = Math.hypot(f.B[0] - f.A[0], f.B[1] - f.A[1]);
  f.angle = Math.atan2(f.B[1] - f.A[1], f.B[0] - f.A[0]);
}
for (const line of METRO_LINES) for (const st of line.stations) st.pos = snapToWalkable(...st.at);

// ---------------------------------------------------------------------------
// Funicolari
// ---------------------------------------------------------------------------
export const funicularRide = { line: null, t: 0, dir: 1 };

export function nearestFunicularStation(x, y) {
  for (const f of FUNICULARS) {
    if (Math.hypot(f.A[0] - x, f.A[1] - y) < STATION_RANGE + 2) return { line: f, atLower: true };
    if (Math.hypot(f.B[0] - x, f.B[1] - y) < STATION_RANGE + 2) return { line: f, atLower: false };
  }
  return null;
}

export const destinationName = ({ line, atLower }) => (atLower ? line.upper.name : line.lower.name);

export function boardFunicular({ line, atLower }) {
  Object.assign(funicularRide, { line, dir: atLower ? 1 : -1, t: atLower ? 0 : 1 });
  player.mode = 'funicular';
}

export function updateFunicular(dt) {
  const r = funicularRide;
  const f = r.line;
  r.t += (r.dir * dt * FUNICULAR_SPEED) / f.length;
  if (r.t >= 1 || r.t <= 0) {
    const arrivedUp = r.t >= 1;
    [player.x, player.y] = arrivedUp ? f.B : f.A;
    player.a = f.angle + (arrivedUp ? 0 : Math.PI);
    player.mode = 'foot';
    r.line = null;
    return;
  }
  player.x = f.A[0] + (f.B[0] - f.A[0]) * r.t;
  player.y = f.A[1] + (f.B[1] - f.A[1]) * r.t;
}

// ---------------------------------------------------------------------------
// Metropolitana
// ---------------------------------------------------------------------------
export const metroRide = { line: null, from: 0, to: 0, path: null, cumulative: null, length: 0, s: 0, speed: 600 };

export function nearestMetroStation(x, y) {
  for (const line of METRO_LINES)
    for (let k = 0; k < line.stations.length; k++) {
      const [sx, sy] = line.stations[k].pos;
      if (Math.hypot(sx - x, sy - y) < STATION_RANGE) return { line, index: k };
    }
  return null;
}

export function boardMetro(line, from, to) {
  const dir = to > from ? 1 : -1;
  const path = [];
  for (let k = from; k !== to + dir; k += dir) path.push(line.stations[k].pos);
  const cumulative = cumulativeLengths(path);
  const length = cumulative.at(-1);
  // Short hops take ~7 s, long rides are capped at 700 px/s.
  const speed = Math.max(length / 7, Math.min(700, length / 2.2));
  Object.assign(metroRide, { line, from, to, path, cumulative, length, s: 0, speed });
  player.mode = 'metro';
}

export const metroPosition = () => pointAlong(metroRide.path, metroRide.cumulative, metroRide.s);

/** Returns true on arrival. */
export function updateMetro(dt) {
  const m = metroRide;
  m.s += m.speed * dt;
  if (m.s >= m.length) {
    [player.x, player.y] = m.path.at(-1);
    player.mode = 'foot';
    return true;
  }
  const [x, y, a] = metroPosition();
  Object.assign(player, { x, y, a });
  return false;
}

// ---------------------------------------------------------------------------
// Freight train in the San Giovanni rail yard (pure decoration).
// ---------------------------------------------------------------------------
const [yardX0, , yardX1] = RAILYARD.rect;
export const freightTrain = { x: yardX0 * TILE, y: RAILYARD.trackY * TILE, minX: yardX0 * TILE, maxX: yardX1 * TILE };

export function updateFreightTrain(dt) {
  freightTrain.x += 55 * dt;
  if (freightTrain.x > freightTrain.maxX + 300) freightTrain.x = freightTrain.minX - 300;
}
