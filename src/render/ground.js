import { hash, TAU } from '../core/math.js';
import { shade } from '../core/color.js';
import { time } from '../core/time.js';
import { LANDMARKS, METRO_LINES, PLAZAS, ROADS, TILE } from '../data/city.js';
import { grid, index, inBounds, tileAt } from '../world/map.js';
import { Tile } from '../world/tiles.js';
import { freightTrain } from '../entities/transit.js';
import { camera, toScreen } from './camera.js';
import { centeredLabel, ctx, disc, ellipse, inFrame, line, polyline, screen } from './canvas.js';

const SEA_SHADES = ['#1f6390', '#22699a', '#256fa0', '#2a76a8', '#2f7caf', '#3584b6'];
const BEACH_UMBRELLAS = ['#e64b3c', '#3d7fd0', '#f5d142'];

/** Each painter fills one ground tile. (sx, sy) is the top-left corner, s its size. */
const PAINTERS = {
  [Tile.ROAD](sx, sy, s, z, x, y, i, n) {
    if (i >= 0 && ROADS[grid.road[i]].kind === 'vicolo') {
      // Basoli: paving stones in staggered rows.
      ctx.fillStyle = '#5e5750';
      ctx.fillRect(sx, sy, s, s);
      ctx.fillStyle = '#4b4540';
      const q = (TILE * z) / 3;
      ctx.fillRect(sx, sy + q, s, 1);
      ctx.fillRect(sx, sy + 2 * q, s, 1);
      const o = ((y * 3) % 2) * q * 0.5;
      ctx.fillRect(sx + o + q * 0.5, sy, 1, q);
      ctx.fillRect(sx + o + q * 1.5, sy + q, 1, q);
      ctx.fillRect(sx + o + q * 0.9, sy + 2 * q, 1, q);
    } else if (i >= 0 && grid.tunnel[i]) {
      ctx.fillStyle = '#2e2e33';
      ctx.fillRect(sx, sy, s, s);
      if ((x + y) % 3 === 0) {
        ctx.fillStyle = '#ffd77a';
        ctx.fillRect(sx + s / 2 - 2 * z, sy + s / 2 - 2 * z, 4 * z, 4 * z);
      }
    } else {
      ctx.fillStyle = n < 0.5 ? '#46474c' : '#494a4f';
      ctx.fillRect(sx, sy, s, s);
      if (n > 0.9) {
        ctx.fillStyle = '#3d3e42';
        ctx.fillRect(sx + n * 10 * z, sy + (1 - n) * 60 * z, 5 * z, 3 * z);
      }
    }
  },
  [Tile.SIDEWALK](sx, sy, s, z, x, y, i, n) {
    ctx.fillStyle = n < 0.5 ? '#a9a193' : '#a49c8e';
    ctx.fillRect(sx, sy, s, s);
    ctx.fillStyle = '#968e81';
    ctx.fillRect(sx, sy, s, 1);
    ctx.fillRect(sx, sy, 1, s);
  },
  [Tile.PLAZA](sx, sy, s, z, x, y, i, n) {
    if (PLAZAS[grid.plaza[i]]?.parking) {
      // Parcheggio: asfalto con le strisce bianche degli stalli.
      ctx.fillStyle = n < 0.5 ? '#55565b' : '#58595e';
      ctx.fillRect(sx, sy, s, s);
      ctx.fillStyle = 'rgba(240,240,232,.75)';
      ctx.fillRect(sx, sy, Math.max(1, 1.6 * z), s * 0.7);
      return;
    }
    const basalt = grid.plaza[i] === 0;
    const odd = (x + y) % 2;
    ctx.fillStyle = basalt ? (odd ? '#c6c0b2' : '#bdb7a8') : odd ? '#d3c5a5' : '#cbbd9c';
    ctx.fillRect(sx, sy, s, s);
  },
  [Tile.PARK](sx, sy, s, z, x, y, i, n) {
    ctx.fillStyle = n < 0.33 ? '#558a3a' : n < 0.66 ? '#5a913e' : '#4f8436';
    ctx.fillRect(sx, sy, s, s);
    if (n > 0.8) {
      ctx.fillStyle = '#6aa34a';
      ctx.fillRect(sx + n * 20 * z, sy + 8 * z, 3 * z, 3 * z);
    }
  },
  [Tile.SEA](sx, sy, s, z, x, y, i, n, t) {
    const T = time.t;
    const wave = (Math.sin(T * 1.3 + x * 0.55 + y * 0.35) + Math.sin(T * 0.7 - x * 0.21 + y * 0.5) + 2) / 4;
    ctx.fillStyle = SEA_SHADES[Math.floor(wave * 5.99)];
    ctx.fillRect(sx, sy, s, s);
    if (n > 0.9) {
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      const o = ((T * 8 + n * 100) % TILE) * z;
      ctx.fillRect(sx + o * 0.6, sy + n * TILE * z * 0.7, 7 * z, 1.5 * z);
    }
    if (t === Tile.ROCK) {
      const u = TILE * z;
      ctx.fillStyle = '#6d7174';
      ellipse(sx + (0.3 + n * 0.3) * u, sy + 0.45 * u, 9 * z, 7 * z);
      ctx.fillStyle = '#868a8c';
      ellipse(sx + (0.6 - n * 0.2) * u, sy + 0.6 * u, 7 * z, 6 * z);
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.fillRect(sx + 0.2 * u, sy + 0.8 * u, 10 * z, 1.5 * z);
    }
  },
  [Tile.QUAY](sx, sy, s) {
    ctx.fillStyle = '#8f897d';
    ctx.fillRect(sx, sy, s, s);
    ctx.fillStyle = '#837d72';
    ctx.fillRect(sx, sy, s, 1);
    ctx.fillRect(sx, sy, 1, s);
  },
  [Tile.MOUNTAIN](sx, sy, s) {
    ctx.fillStyle = '#4f5e34';
    ctx.fillRect(sx, sy, s, s);
  },
  [Tile.PITCH](sx, sy, s, z, x, y) {
    ctx.fillStyle = y % 2 ? '#4f9a3e' : '#5aa848';
    ctx.fillRect(sx, sy, s, s);
  },
  [Tile.TRACK](sx, sy, s) {
    ctx.fillStyle = '#6f8193';
    ctx.fillRect(sx, sy, s, s);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(sx, sy + s * 0.33, s, 1);
    ctx.fillRect(sx, sy + s * 0.66, s, 1);
  },
  [Tile.SAND](sx, sy, s, z, x, y, i, n) {
    ctx.fillStyle = n < 0.5 ? '#e4d09c' : '#dfca94';
    ctx.fillRect(sx, sy, s, s);
    if (n > 0.7) {
      ctx.fillStyle = BEACH_UMBRELLAS[(x + y) % 3];
      ctx.fillRect(sx + n * 12 * z, sy + 8 * z, 10 * z, 5 * z);
    }
  },
  [Tile.BROWNFIELD](sx, sy, s, z, x, y, i, n) {
    ctx.fillStyle = n < 0.4 ? '#86684a' : n < 0.7 ? '#7d5f43' : '#8f7353';
    ctx.fillRect(sx, sy, s, s);
    if (n > 0.8) {
      ctx.fillStyle = '#5e4a38';
      ctx.fillRect(sx + n * 14 * z, sy + (1 - n) * 40 * z, 8 * z, 4 * z);
    }
    if (n < 0.08) {
      ctx.fillStyle = '#6f8f45';
      disc(sx + 16 * z, sy + 16 * z, 6 * z);
    }
  },
  [Tile.RAIL](sx, sy, s, z) {
    ctx.fillStyle = '#6b665e';
    ctx.fillRect(sx, sy, s, s);
    ctx.fillStyle = '#4a3a2c';
    for (let j = 0; j < 4; j++) ctx.fillRect(sx + (j * 8 + 2) * z, sy + 6 * z, 4 * z, 20 * z);
    ctx.fillStyle = '#b8b8b8';
    ctx.fillRect(sx, sy + 10 * z, s, 2 * z);
    ctx.fillRect(sx, sy + 20 * z, s, 2 * z);
  },
};
PAINTERS[Tile.ROCK] = PAINTERS[Tile.SEA];

function paintDefault(sx, sy, s) {
  ctx.fillStyle = '#2d2925';
  ctx.fillRect(sx, sy, s, s);
}

function paintCurb(sx, sy, z, mask) {
  const w = 2.2 * z;
  const s = TILE * z;
  ctx.fillStyle = '#d9d2c1';
  if (mask & 1) ctx.fillRect(sx, sy, s, w);
  if (mask & 2) ctx.fillRect(sx + s - w, sy, w, s);
  if (mask & 4) ctx.fillRect(sx, sy + s - w, s, w);
  if (mask & 8) ctx.fillRect(sx, sy, w, s);
}

function drawTiles({ x0, y0, x1, y1 }) {
  const z = camera.zoom;
  const size = TILE * z + 0.6; // slight overlap hides seams
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const sx = (x * TILE - camera.x) * z + camera.cx;
      const sy = (y * TILE - camera.y) * z + camera.cy;
      const inside = inBounds(x, y);
      const i = inside ? index(x, y) : -1;
      const t = tileAt(x, y);
      const n = inside ? grid.noise[i] : hash(x, y, 1);
      (PAINTERS[t] ?? paintDefault)(sx, sy, size, z, x, y, i, n, t);
      if (inside && grid.curb[i]) paintCurb(sx, sy, z, grid.curb[i]);
    }
}

function drawLaneMarkings() {
  const z = camera.zoom;
  ctx.strokeStyle = 'rgba(238,230,200,.7)';
  ctx.lineWidth = 2 * z;
  ctx.setLineDash([14 * z, 16 * z]);
  ctx.lineDashOffset = 0;
  for (const r of ROADS) {
    if (r.kind !== 'main' && r.kind !== 'hwy') continue;
    polyline(r.points.map(([x, y]) => toScreen(x, y)));
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

/** Guard rails and the green motorway sign. */
function drawHighways() {
  const z = camera.zoom;
  for (const r of ROADS) {
    if (r.kind !== 'hwy') continue;
    for (let j = 0; j < r.points.length - 1; j++) {
      const [a, b] = r.points[j];
      const [c, d] = r.points[j + 1];
      const L = Math.hypot(c - a, d - b);
      const nx = -(d - b) / L;
      const ny = (c - a) / L;
      for (const side of [-1, 1]) {
        const o = side * (2 * TILE - 3);
        const [px, py] = toScreen(a + nx * o, b + ny * o);
        const [qx, qy] = toScreen(c + nx * o, d + ny * o);
        ctx.strokeStyle = '#c9ccd0';
        ctx.lineWidth = 3 * z;
        line(px, py, qx, qy);
        ctx.strokeStyle = '#6d7176';
        ctx.lineWidth = z;
        ctx.stroke();
      }
    }
    const m = r.points[Math.floor(r.points.length / 2)];
    const [gx, gy] = toScreen(m[0], m[1] - 2.6 * TILE);
    if (gx > -80 && gx < screen.w + 80 && gy > -40 && gy < screen.h + 40) {
      ctx.fillStyle = '#1f7a3a';
      ctx.fillRect(gx - 48 * z, gy - 9 * z, 96 * z, 18 * z);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.2 * z;
      ctx.strokeRect(gx - 46 * z, gy - 7 * z, 92 * z, 14 * z);
      centeredLabel('TANGENZIALE', gx, gy + 1, 7 * z, '#fff');
    }
  }
}

function drawPitchLines() {
  const z = camera.zoom;
  for (const sp of LANDMARKS) {
    if (sp.style !== 'stadium') continue;
    const long = sp.ry > sp.rx;
    const fx = sp.rx * 0.39 * TILE;
    const fy = sp.ry * 0.42 * TILE;
    const [cx, cy] = [sp.cx * TILE, sp.cy * TILE];
    const [a, b] = toScreen(cx - fx, cy - fy);
    const [c, d] = toScreen(cx + fx, cy + fy);
    if (c < 0 || d < 0 || a > screen.w || b > screen.h) continue;
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 1.6 * z;
    ctx.strokeRect(a, b, c - a, d - b);
    const [mx, my] = toScreen(cx, cy);
    if (long) line(a, my, c, my);
    else line(mx, b, mx, d);
    ctx.beginPath();
    ctx.arc(mx, my, Math.min(c - a, d - b) * 0.18, 0, TAU);
    ctx.stroke();
    const bw = (c - a) * (long ? 0.45 : 0.16);
    const bh = (d - b) * (long ? 0.16 : 0.45);
    ctx.strokeRect(long ? mx - bw / 2 : a, long ? b : my - bh / 2, bw, bh);
    ctx.strokeRect(long ? mx - bw / 2 : c - bw, long ? d - bh : my - bh / 2, bw, bh);
  }
}

const WAGONS = ['#b23a2a', '#6d5a48', '#5a6a72', '#8a4a32', '#6d5a48', '#5a6a72', '#7a7a6a', '#6d5a48'];

function drawFreightTrain() {
  const t = freightTrain;
  WAGONS.forEach((color, j) => {
    const wx = t.x - j * 46;
    if (wx < t.minX + 20 || wx > t.maxX - 20) return;
    const [a, b] = toScreen(wx, t.y);
    if (a < -80 || a > screen.w + 80 || b < -80 || b > screen.h + 80) return;
    inFrame(a, b, 0, camera.zoom, () => {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(-19, -8, 42, 18);
      ctx.fillStyle = color;
      ctx.fillRect(-21, -9, 42, 18);
      ctx.fillStyle = shade(color, j ? 0.15 : 0.3);
      ctx.fillRect(-18, -6, j ? 36 : 14, 12);
      if (!j) {
        ctx.fillStyle = '#22303c'; // locomotive cab
        ctx.fillRect(10, -6, 5, 12);
      }
    });
  });
}

function drawMetroEntrances() {
  const z = camera.zoom;
  for (const line of METRO_LINES)
    for (const st of line.stations) {
      const [a, b] = toScreen(...st.pos);
      if (a < -40 || a > screen.w + 40 || b < -40 || b > screen.h + 40) continue;
      const r = 9 * z;
      ctx.fillStyle = '#000';
      ctx.fillRect(a - r - 1, b - r - 1, 2 * r + 4, 2 * r + 4);
      ctx.fillStyle = line.color;
      ctx.fillRect(a - r, b - r, 2 * r, 2 * r);
      centeredLabel('M', a, b + 1, 10 * z, '#fff');
      centeredLabel(line.name.slice(-1), a + r - 2 * z, b + r - 2 * z, 6 * z, '#111');
    }
}

export function drawGround(view) {
  drawTiles(view);
  drawLaneMarkings();
  drawHighways();
  drawPitchLines();
  drawFreightTrain();
  drawMetroEntrances();
}
