import { clamp, distToSegment, hash, TAU } from '../core/math.js';
import { shade } from '../core/color.js';
import {
  BEACHES,
  BROWNFIELDS,
  CENTRO_ZONE,
  coastY,
  districtAt,
  FOUNTAINS,
  HILL,
  LANDMARKS,
  MAP_H,
  MAP_W,
  NISIDA,
  PARKINGS,
  PARKS,
  PLAZAS,
  QUAYS,
  RAILYARD,
  ROAD_PRIORITY,
  STADIUM_GATE,
  ROADS,
  TILE,
  VESUVIUS,
  zoneOf,
} from '../data/city.js';
import { Group, Style, Tile } from './tiles.js';

// ---------------------------------------------------------------------------
// Grid storage: one entry per tile, flat arrays for speed.
// ---------------------------------------------------------------------------
const N = MAP_W * MAP_H;
export const index = (x, y) => y * MAP_W + x;
export const inBounds = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

export const grid = {
  tile: new Uint8Array(N),
  road: new Int16Array(N).fill(-1), // index into ROADS
  plaza: new Int16Array(N).fill(-1), // index into PLAZAS
  landmark: new Int16Array(N).fill(-1), // index into LANDMARKS
  height: new Float32Array(N), // building height, in floors
  color: new Int16Array(N), // index into the palette registry
  group: new Int32Array(N), // tiles with the same group share a roof outline
  style: new Uint8Array(N),
  tunnel: new Uint8Array(N),
  highway: new Uint8Array(N),
  curb: new Uint8Array(N), // bitmask N/E/S/W of curbs toward a road
  gate: new Uint8Array(N), // the stadium gate: solid unless `stadiumGate.open`
  noise: new Float32Array(N),
};

// Colour registry: each distinct hex gets a small integer, so derived shades
// (walls, parapets…) can be precomputed once.
const COLORS = [];
const COLOR_ID = new Map();
export function colorId(hex) {
  if (!COLOR_ID.has(hex)) {
    COLOR_ID.set(hex, COLORS.length);
    COLORS.push(hex);
  }
  return COLOR_ID.get(hex);
}

const isVicolo = (i) => ROADS[grid.road[i]].kind === 'vicolo';

// ---------------------------------------------------------------------------
// Map construction
// ---------------------------------------------------------------------------
function fillRect([x0, y0, x1, y1], fn) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (inBounds(x, y)) fn(index(x, y), x, y);
}

function fillWhere(x0, y0, x1, y1, test, fn) {
  for (let y = Math.floor(y0); y <= y1; y++)
    for (let x = Math.floor(x0); x <= x1; x++) {
      if (inBounds(x, y) && test(x + 0.5, y + 0.5)) fn(index(x, y), x, y);
    }
}

function inStar(px, py, cx, cy, r) {
  const seg = TAU / 6;
  const a = ((Math.atan2(py - cy, px - cx) % seg) + seg) % seg;
  const t = Math.abs(a - seg / 2) / (seg / 2);
  return Math.hypot(px - cx, py - cy) <= r * 0.58 + r * 0.42 * t;
}

function landmarkBounds(lm) {
  if (lm.rect) return lm.rect;
  const [cx, cy] = lm.center;
  const rx = lm.rx ?? lm.radius;
  const ry = lm.ry ?? lm.radius;
  return [Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(cx + rx), Math.ceil(cy + ry)];
}

function hillTile(i, x, y) {
  const depth = Math.min(x - HILL.x0, HILL.x1 - 1 - x, y - HILL.y0, coastY(x + 0.5) - 6 - y);
  const h = Math.round((1.2 + Math.min(2.6, depth * 0.55) + hash(x >> 1, y >> 1, 11) * 0.6) * 2) / 2;
  grid.height[i] = h;
  grid.color[i] = colorId(h < 2 ? '#5f8a3c' : h < 3 ? '#557f37' : '#4b7432');
  grid.group[i] = Group.HILL;
  grid.style[i] = Style.GREEN;
}

const LANDMARK_STYLE = {
  tower: Style.TOWER,
  shed: Style.SHED,
  stadium: Style.PLAIN,
  arena: Style.PLAIN,
  chimney: Style.PLAIN,
  tank: Style.PLAIN,
  gasometer: Style.PLAIN,
  statue: Style.PLAIN,
  furnace: Style.PLAIN,
};

function buildMap() {
  const { tile } = grid;

  // Land and sea.
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const i = index(x, y);
      grid.noise[i] = hash(x, y, 1);
      tile[i] = y + 0.5 > coastY(x + 0.5) ? Tile.SEA : Tile.BUILDING;
    }

  const [vx, vy] = VESUVIUS.center;
  fillWhere(
    0,
    0,
    MAP_W - 1,
    MAP_H - 1,
    (x, y) => Math.hypot(x - vx, (y - vy) * 1.1) < VESUVIUS.radius,
    (i) => {
      tile[i] = Tile.MOUNTAIN;
    },
  );
  for (const q of QUAYS) fillRect(q.rect, (i) => (tile[i] = Tile.QUAY));
  PLAZAS.forEach((p, pi) =>
    fillRect(p.rect, (i) => {
      tile[i] = Tile.PLAZA;
      grid.plaza[i] = pi;
    }),
  );
  for (const p of PARKS)
    fillRect(p.rect, (i) => {
      if (tile[i] === Tile.BUILDING || tile[i] === Tile.PLAZA) {
        tile[i] = Tile.PARK;
        grid.plaza[i] = -1;
      }
    });
  for (const r of BROWNFIELDS) fillRect(r, (i) => tile[i] === Tile.BUILDING && (tile[i] = Tile.BROWNFIELD));
  fillRect(RAILYARD.rect, (i) => tile[i] === Tile.BUILDING && (tile[i] = Tile.RAIL));

  const [nx, ny] = NISIDA.center;
  fillWhere(
    nx - NISIDA.radius - 1,
    ny - NISIDA.radius - 1,
    nx + NISIDA.radius + 1,
    ny + NISIDA.radius + 1,
    (x, y) => Math.hypot(x - nx, y - ny) < NISIDA.radius,
    (i) => (tile[i] = Tile.MOUNTAIN),
  );
  fillRect([HILL.x0, HILL.y0, HILL.x1, MAP_H], (i, x, y) => {
    if (y + 0.5 < coastY(x + 0.5) - 6 && tile[i] === Tile.BUILDING) tile[i] = Tile.MOUNTAIN;
  });
  for (const parking of PARKINGS) {
    parking.plaza = PLAZAS.push({ name: parking.name, rect: parking.rect, parking: true }) - 1;
    fillRect(parking.rect, (i) => {
      tile[i] = Tile.PLAZA;
      grid.plaza[i] = parking.plaza;
    });
  }

  // Roads: rasterise each polyline; wider classes win where they overlap.
  ROADS.forEach((road, ri) => {
    road.points = road.path.map(([x, y]) => [x * TILE, y * TILE]);
    road.cumulative = [0];
    for (let k = 1; k < road.points.length; k++) {
      const [ax, ay] = road.points[k - 1];
      const [bx, by] = road.points[k];
      road.cumulative.push(road.cumulative[k - 1] + Math.hypot(bx - ax, by - ay));
    }
    road.length = road.cumulative.at(-1);

    for (let k = 0; k < road.path.length - 1; k++) {
      const [ax, ay] = road.path[k];
      const [bx, by] = road.path[k + 1];
      const w = road.width;
      fillWhere(
        Math.min(ax, bx) - w,
        Math.min(ay, by) - w,
        Math.ceil(Math.max(ax, bx) + w),
        Math.ceil(Math.max(ay, by) + w),
        (x, y) => distToSegment(x, y, ax, ay, bx, by) <= w / 2 + 1e-3,
        (i, x) => {
          if (tile[i] === Tile.MOUNTAIN && x >= HILL.x0 && x < HILL.x1) grid.tunnel[i] = 1;
          if (road.kind === 'hwy') grid.highway[i] = 1;
          tile[i] = Tile.ROAD;
          const cur = grid.road[i];
          if (cur < 0 || ROAD_PRIORITY[ROADS[cur].kind] < ROAD_PRIORITY[road.kind]) grid.road[i] = ri;
        },
      );
    }
  });

  // Landmarks.
  LANDMARKS.forEach((lm, li) => {
    const [x0, y0, x1, y1] = landmarkBounds(lm);
    [lm.cx, lm.cy] = lm.rect ? [(x0 + x1) / 2, (y0 + y1) / 2] : lm.center;
    lm.size = Math.max(x1 - x0, y1 - y0) / 2;
    fillRect([x0, y0, x1, y1], (i, x, y) => {
      if (tile[i] === Tile.ROAD) return;
      const px = x + 0.5;
      const py = y + 0.5;
      if (lm.shape === 'ellipse') {
        const dx = (px - lm.cx) / lm.rx;
        const dy = (py - lm.cy) / lm.ry;
        const nd = Math.hypot(dx, dy);
        if (Math.abs(dx) <= 0.42 && Math.abs(dy) <= 0.45) return void ((tile[i] = Tile.PITCH), (grid.plaza[i] = -1));
        if (nd < 0.62) return void ((tile[i] = Tile.TRACK), (grid.plaza[i] = -1));
        if (nd > 1) return;
      }
      if (lm.shape === 'circle' && Math.hypot(px - lm.cx, py - lm.cy) > lm.radius) return;
      if (lm.shape === 'star' && !inStar(px, py, lm.cx, lm.cy, lm.radius)) return;
      tile[i] = Tile.LANDMARK;
      grid.landmark[i] = li;
    });
  });

  // Esplanade around the stadium.
  for (const s of LANDMARKS.filter((l) => l.ring)) {
    const pi = PLAZAS.push({ name: 'Piazzale dello Stadio', rect: [0, 0, 0, 0] }) - 1;
    const [cx, cy] = s.center;
    fillWhere(
      cx - s.rx * 1.3,
      cy - s.ry * 1.3,
      cx + s.rx * 1.3,
      cy + s.ry * 1.3,
      () => true,
      (i, x, y) => {
        const nd = Math.hypot((x + 0.5 - cx) / s.rx, (y + 0.5 - cy) / s.ry);
        if (nd > 1 && nd < 1.2 && (tile[i] === Tile.BUILDING || tile[i] === Tile.PARK)) {
          tile[i] = Tile.PLAZA;
          grid.plaza[i] = pi;
        }
      },
    );
  }

  // The north gate of the stadium: a passage through the stands, closed by a gate.
  fillRect(STADIUM_GATE.rect, (i) => {
    tile[i] = Tile.TRACK;
    grid.landmark[i] = -1;
    grid.plaza[i] = -1;
    grid.gate[i] = 1;
  });

  buildMostraDOltremare();

  for (const f of FOUNTAINS) {
    const [cx, cy] = f.center;
    fillWhere(
      cx - f.radius,
      cy - f.radius,
      cx + f.radius,
      cy + f.radius,
      (x, y) => Math.hypot(x - cx, y - cy) <= f.radius,
      (i) => {
        tile[i] = Tile.SEA;
      },
    );
  }

  addSidewalks();
  for (const b of BEACHES)
    fillRect(b.rect, (i) => {
      if (tile[i] === Tile.BUILDING) tile[i] = Tile.SAND;
    });
  addCoast();
  addCurbs();
  assignBuildings();
}

/** La Mostra d'Oltremare: viali pedonali e la Fontana dell'Esedra. */
function buildMostraDOltremare() {
  const pi = PLAZAS.push({ name: "Mostra d'Oltremare", rect: [0, 0, 0, 0] }) - 1;
  const set = (x, y, t) => {
    if (!inBounds(x, y)) return;
    const i = index(x, y);
    if (grid.tile[i] === Tile.LANDMARK || grid.tile[i] === Tile.ROAD) return;
    grid.tile[i] = t;
    grid.plaza[i] = t === Tile.PLAZA ? pi : -1;
  };
  const area = (x0, y0, x1, y1, t, test = () => true) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (test(x + 0.5, y + 0.5)) set(x, y, t);
  };
  const exedra = (r) => (x, y) => Math.hypot(x - 62.5, y - 85) <= r;
  area(60, 68, 64, 89, Tile.PLAZA);
  area(56, 80, 69, 88, Tile.PLAZA);
  area(57, 85, 69, 90, Tile.PLAZA, exedra(4.2));
  area(57, 81, 68, 85, Tile.SEA);
  area(58, 85, 68, 89, Tile.SEA, exedra(3.1));
  area(61, 72, 63, 79, Tile.SEA);
  for (let x = 54; x < 71; x++) set(x, 72, x >= 60 && x < 64 ? Tile.SEA : Tile.PLAZA);
}

const NEIGHBOURS_4 = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

function addSidewalks() {
  const before = grid.tile.slice();
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const i = index(x, y);
      if (before[i] !== Tile.BUILDING) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++)
        for (let dx = -1; dx <= 1 && !near; dx++) {
          if (!inBounds(x + dx, y + dy)) continue;
          const j = index(x + dx, y + dy);
          near = (before[j] === Tile.ROAD && !grid.highway[j] && !isVicolo(j)) || before[j] === Tile.PLAZA;
        }
      if (near) grid.tile[i] = Tile.SIDEWALK;
    }
}

function addCoast() {
  const before = grid.tile.slice();
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const i = index(x, y);
      const touches = (pred) =>
        NEIGHBOURS_4.some(([dx, dy]) => inBounds(x + dx, y + dy) && pred(before[index(x + dx, y + dy)]));
      if (before[i] === Tile.BUILDING) {
        if (touches((t) => t === Tile.SEA)) grid.tile[i] = x < 44 ? Tile.SAND : Tile.QUAY;
        if (x < 44 && y + 0.5 > coastY(x + 0.5) - 3.5) grid.tile[i] = Tile.SAND;
      }
      // Scogliera lungo il lungomare.
      if (before[i] === Tile.SEA && x >= 96 && x < 190 && y > 80 && grid.noise[i] < 0.6) {
        if (touches((t) => t !== Tile.SEA && t !== Tile.ROCK)) grid.tile[i] = Tile.ROCK;
      }
    }
}

function addCurbs() {
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const i = index(x, y);
      const t = grid.tile[i];
      if (t !== Tile.SIDEWALK && t !== Tile.PLAZA && t !== Tile.QUAY) continue;
      let mask = 0;
      NEIGHBOURS_4.forEach(([dx, dy], bit) => {
        if (!inBounds(x + dx, y + dy)) return;
        const j = index(x + dx, y + dy);
        if (grid.tile[j] === Tile.ROAD && !isVicolo(j)) mask |= 1 << bit;
      });
      grid.curb[i] = mask;
    }
}

function assignBuildings() {
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const i = index(x, y);
      const t = grid.tile[i];
      if (t === Tile.BUILDING) {
        const zone = zoneOf(districtAt(x, y));
        const industrial = !!zone.industrial;
        const by = industrial ? Math.floor(y / 5) : Math.floor(y / 3);
        const bx = industrial ? Math.floor(x / 7) : Math.floor((x + (by % 2) * 2) / 4);
        const [lo, hi] = zone.heights;
        grid.height[i] = lo + Math.round(hash(bx, by, 7) * (hi - lo) * 2) / 2;
        grid.color[i] = colorId(zone.palette[Math.floor(hash(bx, by, 3) * zone.palette.length)]);
        grid.group[i] = by * 1000 + bx + 1;
        grid.style[i] = industrial ? Style.SHED : Style.HOUSE;
      } else if (t === Tile.LANDMARK) {
        const li = grid.landmark[i];
        const lm = LANDMARKS[li];
        grid.height[i] = lm.height;
        grid.color[i] = colorId(lm.color);
        if (lm.style === 'stadium') {
          const nd = Math.hypot((x + 0.5 - lm.cx) / lm.rx, (y + 0.5 - lm.cy) / lm.ry);
          const tier = nd < 0.74 ? 0 : nd < 0.87 ? 1 : 2;
          grid.height[i] = Math.round(lm.height * [0.4, 0.7, 1][tier] * 2) / 2;
          grid.color[i] = colorId(['#5fb0e8', '#3f8fd0', '#c9c6bd'][tier]);
        }
        grid.group[i] = -1 - li;
        grid.style[i] = LANDMARK_STYLE[lm.style] ?? Style.MONUMENT;
      } else if (t === Tile.MOUNTAIN && x < HILL.x0) {
        const d = Math.hypot(x + 0.5 - NISIDA.center[0], y + 0.5 - NISIDA.center[1]);
        const h = Math.round((1 + 2.6 * (1 - d / NISIDA.radius)) * 2) / 2;
        grid.height[i] = h;
        grid.color[i] = colorId(h < 2 ? '#5f8a3c' : '#4b7432');
        grid.group[i] = Group.ISLAND;
        grid.style[i] = Style.GREEN;
      } else if ((t === Tile.MOUNTAIN && x < HILL.x1) || (t === Tile.ROAD && grid.tunnel[i])) {
        hillTile(i, x, y);
      } else if (t === Tile.MOUNTAIN) {
        const [cx, cy] = VESUVIUS.center;
        const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.1);
        const slope = (f) => 0.5 + 7 * Math.pow(f, 1.15);
        const crater = d < 2.2;
        const h = crater ? slope(1 - 2.2 / VESUVIUS.radius) - 1.4 : slope(1 - d / VESUVIUS.radius);
        const col = crater ? '#3a2c26' : h < 2.2 ? '#5d7d3a' : h < 4 ? '#6e6a3e' : h < 5.6 ? '#7a5f45' : '#8a7a6c';
        grid.height[i] = Math.round(h * 2) / 2;
        grid.color[i] = colorId(col);
        grid.group[i] = Group.VOLCANO;
        grid.style[i] = Style.VOLCANO;
      }
    }
}

buildMap();
CENTRO_ZONE.palette.forEach(colorId); // used for the endless city beyond the map edge

/** Precomputed shades for every registered colour. */
export const palette = {
  roof: COLORS,
  wallSouth: COLORS.map((c) => shade(c, -0.38)),
  wallSide: COLORS.map((c) => shade(c, -0.22)),
  parapet: COLORS.map((c) => shade(c, -0.15)),
};

// ---------------------------------------------------------------------------
// Queries. Outside the map the city goes on forever as generic Centro blocks.
// ---------------------------------------------------------------------------
/** Ground that carries on past the map edge: the roads leaving town and their pavements. */
const CONTINUES = new Set([Tile.ROAD, Tile.SIDEWALK, Tile.SAND]);

export function tileAt(x, y) {
  if (inBounds(x, y)) return grid.tile[index(x, y)];
  if (y + 0.5 > coastY(clamp(x, 0, MAP_W) + 0.5) || y >= MAP_H) return Tile.SEA;
  // Outside the map, a road that reaches the edge keeps going.
  const ex = clamp(x, 0, MAP_W - 1);
  const ey = clamp(y, 0, MAP_H - 1);
  if ((ex === x || ey === y) && CONTINUES.has(grid.tile[index(ex, ey)])) return grid.tile[index(ex, ey)];
  return Tile.BUILDING;
}

export function heightAt(x, y) {
  if (inBounds(x, y)) return grid.height[index(x, y)];
  if (tileAt(x, y) !== Tile.BUILDING) return 0;
  return 2.5 + Math.round(hash(x >> 2, (y / 3) | 0, 7) * 3) / 2;
}

export function groupAt(x, y) {
  if (inBounds(x, y)) return grid.group[index(x, y)];
  return 5_000_000 + (((y / 3) | 0) * 1000 + (x >> 2));
}

export function colorAt(x, y) {
  if (inBounds(x, y)) return grid.color[index(x, y)];
  const p = CENTRO_ZONE.palette;
  return colorId(p[Math.floor(hash(x >> 2, (y / 3) | 0, 3) * p.length)]);
}

export const isRaised = (x, y) => {
  const t = tileAt(x, y);
  return (
    t === Tile.BUILDING ||
    t === Tile.LANDMARK ||
    t === Tile.MOUNTAIN ||
    (t === Tile.ROAD && inBounds(x, y) && grid.tunnel[index(x, y)])
  );
};

const tileOfPoint = (px, py) => [Math.floor(px / TILE), Math.floor(py / TILE)];

export function isOnHighway(px, py) {
  const [x, y] = tileOfPoint(px, py);
  return inBounds(x, y) && !!grid.highway[index(x, y)];
}

export function isInTunnel(px, py) {
  const [x, y] = tileOfPoint(px, py);
  return inBounds(x, y) && !!grid.tunnel[index(x, y)];
}

export function tileAtPoint(px, py) {
  const [x, y] = tileOfPoint(px, py);
  return inBounds(x, y) ? grid.tile[index(x, y)] : null;
}

const WALKABLE = new Set([Tile.SIDEWALK, Tile.PLAZA, Tile.PARK, Tile.QUAY, Tile.SAND, Tile.BROWNFIELD]);

/** Where pedestrians wander: sidewalks, squares, parks… and the vicoli. */
export function isPedestrianArea(px, py) {
  const [x, y] = tileOfPoint(px, py);
  if (!inBounds(x, y)) return false;
  const i = index(x, y);
  const t = grid.tile[i];
  return WALKABLE.has(t) || (t === Tile.ROAD && isVicolo(i));
}

// Solidity tables: what blocks someone on foot vs. on a Vespa.
export const Solid = {
  FOOT: new Uint8Array(16),
  VESPA: new Uint8Array(16),
};
for (const t of [Tile.BUILDING, Tile.LANDMARK, Tile.SEA, Tile.MOUNTAIN]) Solid.FOOT[t] = Solid.VESPA[t] = 1;
Solid.VESPA[Tile.ROCK] = 1;

/** The stadium gate opens only for the secret mission. */
export const stadiumGate = { open: false };

const STADIUM = LANDMARKS.find((l) => l.ring);
/** Is a world point inside the stadium (stands, track or pitch)? */
export function inStadium(px, py) {
  const [cx, cy] = STADIUM.center;
  return Math.hypot((px / TILE - cx) / STADIUM.rx, (py / TILE - cy) / STADIUM.ry) < 1.05;
}

/** Does a circle of radius r at (px, py) hit anything solid? Pedestrians may not walk the highway. */
export function collides(px, py, r, solid) {
  const probe = (qx, qy) => {
    const [x, y] = tileOfPoint(qx, qy);
    if (!inBounds(x, y)) return 'wall';
    const i = index(x, y);
    if (solid[grid.tile[i]]) return 'wall';
    if (grid.gate[i] && !stadiumGate.open) return 'wall';
    if (solid === Solid.FOOT && grid.highway[i]) return 'highway';
    return null;
  };
  for (let k = 0; k < 8; k++) {
    const a = (k * TAU) / 8;
    const hit = probe(px + Math.cos(a) * r, py + Math.sin(a) * r);
    if (hit) return hit;
  }
  return probe(px, py);
}

/** Moves a body by (dx, dy), sliding along walls. */
export function moveCircle(body, dx, dy, r, solid) {
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5) || 1;
  const res = { hitX: false, hitY: false, highway: false };
  const tryMove = (nx, ny) => {
    const hit = collides(nx, ny, r, solid);
    if (hit === 'highway') res.highway = true;
    return !hit;
  };
  for (let s = 0; s < steps; s++) {
    if (tryMove(body.x + dx / steps, body.y)) body.x += dx / steps;
    else res.hitX = true;
    if (tryMove(body.x, body.y + dy / steps)) body.y += dy / steps;
    else res.hitY = true;
  }
  return res;
}

/** Nearest walkable tile centre to a tile coordinate. */
export function snapToWalkable(tx, ty) {
  let best = null;
  let bestD = Infinity;
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const x = Math.floor(tx) + dx;
      const y = Math.floor(ty) + dy;
      const px = (x + 0.5) * TILE;
      const py = (y + 0.5) * TILE;
      const d = dx * dx + dy * dy;
      if (d < bestD && isPedestrianArea(px, py)) {
        bestD = d;
        best = [px, py];
      }
    }
  return best ?? [tx * TILE, ty * TILE];
}

/** Name of the street/square/park at a world point (or the nearest street). */
export function placeNameAt(px, py) {
  const [x, y] = tileOfPoint(px, py);
  if (!inBounds(x, y)) return '';
  const i = index(x, y);
  if (grid.tile[i] === Tile.ROAD) return ROADS[grid.road[i]].name;
  if (grid.tile[i] === Tile.PLAZA) return PLAZAS[grid.plaza[i]].name;
  const inside = ({ rect: [x0, y0, x1, y1] }) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const area = PARKS.find(inside) ?? QUAYS.find(inside) ?? BEACHES.find(inside);
  if (area) return area.name;
  return nearestStreetName(x, y, 2);
}

export function nearestStreetName(x, y, radius) {
  let best = '';
  let bestD = Infinity;
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      if (!inBounds(x + dx, y + dy)) continue;
      const j = index(x + dx, y + dy);
      const d = Math.abs(dx) + Math.abs(dy);
      if (grid.tile[j] === Tile.ROAD && d < bestD) {
        bestD = d;
        best = ROADS[grid.road[j]].name;
      }
    }
  return best;
}
