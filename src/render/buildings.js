// Pseudo-3D buildings: every raised tile is extruded toward the screen edge
// by its height. Tiles are drawn in height order so taller ones overlap.

import { hash } from '../core/math.js';
import { time } from '../core/time.js';
import { LANDMARKS, TILE, VESUVIUS } from '../data/city.js';
import { colorAt, grid, groupAt, heightAt, index, inBounds, isRaised, palette } from '../world/map.js';
import { Style } from '../world/tiles.js';
import { camera, lift, PERSPECTIVE, project } from './camera.js';
import { ctx, disc, quad } from './canvas.js';
import { drawLandmark } from './landmarks.js';

const LEVELS = 24; // height buckets, in half floors
const buckets = Array.from({ length: LEVELS }, () => []);
const LAUNDRY = ['#f4f4f4', '#e64b3c', '#3d7fd0', '#f5d142', '#ffffff', '#e98aa8'];
const WINDOW_SPANS = [
  [0.14, 0.4],
  [0.6, 0.86],
];
const hasWindows = (style) => style === Style.HOUSE || style === Style.MONUMENT || style === Style.TOWER;

export function drawBuildings(view, { playerInTunnel }) {
  const { x0, y0, x1, y1 } = view;
  for (const b of buckets) b.length = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (isRaised(x, y)) buckets[Math.min(LEVELS - 1, Math.round(heightAt(x, y) * 2))].push(x, y);

  const volcanoLevel = Math.round(grid.height[index(...VESUVIUS.center)] * 2) + 2;
  let smokeDrawn = false;

  for (let level = 0; level < LEVELS; level++) {
    const tiles = buckets[level];
    if (tiles.length) {
      drawWalls(tiles, playerInTunnel);
      drawRoofs(tiles, playerInTunnel);
    }
    for (const lm of LANDMARKS) {
      if (Math.round(lm.height * 2) !== level) continue;
      const m = lm.size + 2;
      if (lm.cx < x0 - m || lm.cx > x1 + m || lm.cy < y0 - m || lm.cy > y1 + m) continue;
      drawLandmark(lm);
    }
    if (!smokeDrawn && (level === volcanoLevel || level === LEVELS - 1)) {
      smokeDrawn = true;
      drawVolcanoSmoke(view);
    }
  }
}

function tileInfo(x, y) {
  const inside = inBounds(x, y);
  const i = inside ? index(x, y) : 0;
  return {
    h: heightAt(x, y),
    color: colorAt(x, y),
    style: inside ? grid.style[i] : Style.HOUSE,
    tunnel: inside && grid.tunnel[i],
    noise: inside ? grid.noise[i] : hash(x, y, 1),
    sx: (x * TILE - camera.x) * camera.zoom + camera.cx,
    sy: (y * TILE - camera.y) * camera.zoom + camera.cy,
  };
}

function drawWalls(tiles, playerInTunnel) {
  const size = TILE * camera.zoom;
  const { cx, cy } = camera;
  const windows = [];
  for (let k = 0; k < tiles.length; k += 2) {
    const x = tiles[k];
    const y = tiles[k + 1];
    const t = tileInfo(x, y);
    if (t.tunnel && playerInTunnel) continue;
    const [bx0, by0, bx1, by1] = [t.sx, t.sy, t.sx + size, t.sy + size];

    // Only faces turned toward the screen centre are visible.
    const faces = [];
    const face = (nx, ny, ax, ay, bx, by, side) => {
      const hn = heightAt(nx, ny);
      if (hn < t.h) faces.push({ ax, ay, bx, by, hn, side });
    };
    if (by0 > cy) face(x, y - 1, bx0, by0, bx1, by0, false);
    if (by1 < cy) face(x, y + 1, bx1, by1, bx0, by1, false);
    if (bx0 > cx) face(x - 1, y, bx0, by1, bx0, by0, true);
    if (bx1 < cx) face(x + 1, y, bx1, by0, bx1, by1, true);

    for (const f of faces) {
      ctx.fillStyle = f.side ? palette.wallSide[t.color] : palette.wallSouth[t.color];
      ctx.beginPath();
      quad(lift(f.ax, f.ay, f.hn), lift(f.bx, f.by, f.hn), lift(f.bx, f.by, t.h), lift(f.ax, f.ay, t.h));
      ctx.fill();
      if (!hasWindows(t.style)) continue;
      for (let floor = 0; floor < Math.floor(t.h - f.hn); floor++) {
        const lo = f.hn + floor + 0.28;
        const hi = f.hn + floor + 0.78;
        for (const [t0, t1] of WINDOW_SPANS) {
          const p0 = [f.ax + (f.bx - f.ax) * t0, f.ay + (f.by - f.ay) * t0];
          const p1 = [f.ax + (f.bx - f.ax) * t1, f.ay + (f.by - f.ay) * t1];
          windows.push({
            glass: t.style === Style.TOWER,
            pts: [lift(...p0, lo), lift(...p1, lo), lift(...p1, hi), lift(...p0, hi)],
          });
        }
      }
    }
  }
  // Green shutters for houses, blue glass for towers.
  for (const [glass, fill] of [
    [false, '#3f6a4c'],
    [true, '#a9d4ec'],
  ]) {
    ctx.beginPath();
    for (const w of windows) if (w.glass === glass) quad(...w.pts);
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

function drawRoofs(tiles, playerInTunnel) {
  const size = TILE * camera.zoom;
  for (let k = 0; k < tiles.length; k += 2) {
    const x = tiles[k];
    const y = tiles[k + 1];
    const t = tileInfo(x, y);
    const s = 1 + t.h * PERSPECTIVE;
    const [rx, ry] = lift(t.sx, t.sy, t.h);
    const rs = size * s;
    const ghost = t.tunnel && playerInTunnel;

    ctx.globalAlpha = ghost ? 0.22 : 1;
    ctx.fillStyle = palette.roof[t.color];
    ctx.fillRect(rx, ry, rs + 0.7, rs + 0.7);
    ctx.globalAlpha = 1;
    if (t.style === Style.VOLCANO) continue;

    const u = rs / 32; // roof-local unit
    if (t.style === Style.GREEN) {
      if (!ghost) drawGreenery(rx, ry, u, t.noise);
      continue;
    }

    // Parapet along the edge of each building block.
    const g = groupAt(x, y);
    const pw = Math.max(1, 2.4 * camera.zoom * s);
    ctx.fillStyle = palette.parapet[t.color];
    if (groupAt(x, y - 1) !== g) ctx.fillRect(rx, ry, rs, pw);
    if (groupAt(x, y + 1) !== g) ctx.fillRect(rx, ry + rs - pw, rs, pw);
    if (groupAt(x - 1, y) !== g) ctx.fillRect(rx, ry, pw, rs);
    if (groupAt(x + 1, y) !== g) ctx.fillRect(rx + rs - pw, ry, pw, rs);

    if (t.style === Style.HOUSE) drawRooftop(rx, ry, u, t, x, y);
    else if (t.style === Style.SHED) drawShedRoof(rx, ry, rs, u);
    else if (t.style === Style.TOWER) {
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx + rs / 2, ry);
      ctx.lineTo(rx + rs / 2, ry + rs);
      ctx.moveTo(rx, ry + rs / 2);
      ctx.lineTo(rx + rs, ry + rs / 2);
      ctx.stroke();
    }
  }
}

function drawGreenery(rx, ry, u, r) {
  if (r < 0.45) {
    ctx.fillStyle = r < 0.2 ? '#3d6a2c' : '#6a9a46';
    disc(rx + (8 + r * 30) * u, ry + (10 + r * 25) * u, (5 + r * 8) * u);
  }
  if (r > 0.85) {
    // a little villa on the hill
    ctx.fillStyle = '#e9dcc0';
    ctx.fillRect(rx + 6 * u, ry + 6 * u, 16 * u, 12 * u);
    ctx.fillStyle = '#b8563a';
    ctx.fillRect(rx + 6 * u, ry + 6 * u, 16 * u, 3 * u);
  }
}

/** Neapolitan rooftops: stairwells, water tanks, dishes, laundry, plants. */
function drawRooftop(rx, ry, u, t, x, y) {
  const r = t.noise;
  if (r < 0.07) {
    ctx.fillStyle = palette.wallSouth[t.color];
    ctx.fillRect(rx + 8 * u, ry + 9 * u, 7 * u, 7 * u);
    ctx.fillStyle = '#3a3530';
    ctx.fillRect(rx + 9.5 * u, ry + 10.5 * u, 4 * u, 4 * u);
  } else if (r < 0.13) {
    ctx.fillStyle = '#d8d8d4';
    ctx.fillRect(rx + 14 * u, ry + 6 * u, 11 * u, 8 * u);
    ctx.fillStyle = '#9a9a96';
    disc(rx + 19.5 * u, ry + 10 * u, 3 * u);
  } else if (r < 0.17) {
    ctx.fillStyle = '#eeeeea';
    disc(rx + 20 * u, ry + 20 * u, 4.5 * u);
    ctx.fillStyle = '#aaa';
    disc(rx + 20 * u, ry + 20 * u, 1.4 * u);
  } else if (r < 0.21) {
    ctx.fillStyle = '#8a8f94';
    disc(rx + 11 * u, ry + 20 * u, 5.5 * u);
    ctx.fillStyle = '#a3a8ad';
    disc(rx + 10 * u, ry + 19 * u, 3.5 * u);
  } else if (r < 0.27) {
    ctx.strokeStyle = 'rgba(60,50,40,.6)';
    ctx.lineWidth = Math.max(1, 0.8 * u);
    ctx.beginPath();
    ctx.moveTo(rx + 4 * u, ry + 11 * u);
    ctx.lineTo(rx + 28 * u, ry + 11 * u);
    ctx.moveTo(rx + 4 * u, ry + 21 * u);
    ctx.lineTo(rx + 28 * u, ry + 21 * u);
    ctx.stroke();
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = LAUNDRY[(j + x + y) % 6];
      ctx.fillRect(rx + (6 + j * 5.5) * u, ry + 11 * u, 4 * u, 5 * u);
      ctx.fillStyle = LAUNDRY[(j * 2 + x) % 6];
      ctx.fillRect(rx + (7 + j * 5.5) * u, ry + 21 * u, 4 * u, 4 * u);
    }
  } else if (r < 0.31) {
    ctx.fillStyle = '#3e7a37';
    for (let j = 0; j < 4; j++) disc(rx + (6 + j * 7) * u, ry + 26 * u, 2.6 * u);
    ctx.fillStyle = '#b2563a';
    ctx.fillRect(rx + 4 * u, ry + 28 * u, 26 * u, 2 * u);
  }
}

function drawShedRoof(rx, ry, rs, u) {
  for (let j = 0; j < 4; j++) {
    ctx.fillStyle = j % 2 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.1)';
    ctx.fillRect(rx + j * 8 * u, ry, 8 * u, rs);
  }
  ctx.fillStyle = '#a9c2cc';
  ctx.fillRect(rx + 2 * u, ry + 5 * u, 3 * u, 22 * u);
  ctx.fillRect(rx + 18 * u, ry + 5 * u, 3 * u, 22 * u);
}

function drawVolcanoSmoke({ x0, y0, x1, y1 }) {
  const [vx, vy] = VESUVIUS.center;
  if (vx < x0 - 16 || vx > x1 + 16 || vy < y0 - 16 || vy > y1 + 16) return;
  for (let j = 0; j < 7; j++) {
    const ph = (time.t * 0.12 + j / 7) % 1;
    const [sx, sy, s] = project((vx + 0.5 + ph * 5) * TILE, (vy - ph * 7) * TILE, 7 + ph * 3);
    ctx.fillStyle = `rgba(225,225,220,${0.45 * (1 - ph)})`;
    disc(sx, sy, (10 + ph * 30) * camera.zoom * s);
  }
}
