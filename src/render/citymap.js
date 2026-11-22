// The radar in the corner and the full-screen street map ("Stradario").

import { clamp, TAU } from '../core/math.js';
import { shade } from '../core/color.js';
import {
  BEACHES,
  DISTRICT_COLORS,
  districtAt,
  MAP_H,
  MAP_W,
  OY,
  PARKINGS,
  ROAD_PRIORITY,
  ROADS,
  TILE,
} from '../data/city.js';
import { grid, index } from '../world/map.js';
import { Style, Tile } from '../world/tiles.js';
import { ctx, disc, fitText, outlinedText, pixelFont, screen, UI_FONT } from './canvas.js';

// ---------------------------------------------------------------------------
// Pre-rendered map images
// ---------------------------------------------------------------------------
const GROUND_COLORS = {
  [Tile.SEA]: '#9ccbe8',
  [Tile.ROCK]: '#9ccbe8',
  [Tile.PARK]: '#b9dca0',
  [Tile.PITCH]: '#b9dca0',
  [Tile.PLAZA]: '#f6efdf',
  [Tile.SAND]: '#f3e4b8',
  [Tile.BROWNFIELD]: '#d8c3a5',
  [Tile.RAIL]: '#cfc8bd',
  [Tile.QUAY]: '#e2e0da',
};

const ROAD_STYLE = {
  vicolo: { w: 1, fill: '#fbf6ea', edge: '#b7a98f' },
  street: { w: 2, fill: '#ffffff', edge: '#a99c86' },
  main: { w: 3.2, fill: '#fff1b8', edge: '#a08c5a' },
  hwy: { w: 3.6, fill: '#8fd07a', edge: '#3c7a2c' },
};

/** One pixel per tile, coloured by district. Also finds each district's centre. */
const districtImage = document.createElement('canvas');
districtImage.width = MAP_W;
districtImage.height = MAP_H;
const districtCentres = {};
{
  const g = districtImage.getContext('2d');
  const acc = {};
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const i = index(x, y);
      const t = grid.tile[i];
      const d = districtAt(x, y);
      const base = DISTRICT_COLORS[d] ?? '#eee';
      let c = GROUND_COLORS[t];
      if (t === Tile.MOUNTAIN) c = grid.style[i] === Style.GREEN ? '#c9e0b4' : '#c8b89c';
      else if (t === Tile.LANDMARK) c = shade(base, -0.12);
      c ??= base;
      g.fillStyle = c;
      g.fillRect(x, y, 1, 1);
      if (t !== Tile.SEA && t !== Tile.ROCK) {
        const a = (acc[d] ??= [0, 0, 0]);
        a[0] += x;
        a[1] += y;
        a[2]++;
      }
    }
  for (const [d, [sx, sy, n]] of Object.entries(acc))
    if (d !== 'Napoli') districtCentres[d] = [sx / n + 0.5, sy / n + 0.5];
}

function drawRoadNetwork(g, X, Y, k, minVicoloZoom) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const pass of ['edge', 'fill'])
    for (const kind of ['vicolo', 'street', 'main', 'hwy']) {
      if (kind === 'vicolo' && k < minVicoloZoom) continue;
      const st = ROAD_STYLE[kind];
      const lw = clamp(st.w * k * 0.8, kind === 'vicolo' ? 0.8 : 1.3, kind === 'vicolo' ? 10 : 24);
      g.strokeStyle = st[pass];
      g.lineWidth = pass === 'fill' ? lw : lw + 2.4;
      g.beginPath();
      for (const r of ROADS)
        if (r.kind === kind) r.path.forEach(([x, y], j) => (j ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
      g.stroke();
      if (pass === 'fill' && kind !== 'vicolo') {
        // Tunnels are dashed.
        g.setLineDash([lw * 1.2, lw]);
        g.strokeStyle = 'rgba(120,110,95,.55)';
        g.beginPath();
        for (const r of ROADS)
          if (r.kind === kind && r.name.startsWith('Galleria'))
            r.path.forEach(([x, y], j) => (j ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
        g.stroke();
        g.setLineDash([]);
      }
    }
}

const RADAR_SCALE = 3;
const radarImage = document.createElement('canvas');
radarImage.width = MAP_W * RADAR_SCALE;
radarImage.height = MAP_H * RADAR_SCALE;
{
  const g = radarImage.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(districtImage, 0, 0, radarImage.width, radarImage.height);
  drawRoadNetwork(
    g,
    (x) => x * RADAR_SCALE,
    (y) => y * RADAR_SCALE,
    RADAR_SCALE,
    0,
  );
}

// ---------------------------------------------------------------------------
// Markers (shared by radar and street map)
// ---------------------------------------------------------------------------
function drawArrow(x, y, angle, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#e8262b';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = size > 8 ? 2 : 1.5;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.7, -size * 0.7);
  ctx.lineTo(-size * 0.3, 0);
  ctx.lineTo(-size * 0.7, size * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Marker shapes: 'vespa' (small green square), 'pizzeria' (coloured disc with a
 * slice), 'stop' (numbered pin), 'target' adds a pulsing ring.
 */
function drawMarker(m, x, y, big) {
  const r = big ? 7 : 4;
  ctx.lineWidth = big ? 2 : 1.2;
  ctx.strokeStyle = '#fff';
  if (m.pulse) {
    ctx.strokeStyle = m.color;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(m.pulse * 6);
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
  }
  if (m.kind === 'vespa') {
    ctx.fillStyle = '#16a34a';
    if (big) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.strokeRect(x - 3, y - 3, 6, 6);
    }
    return;
  }
  ctx.fillStyle = m.color;
  if (m.kind === 'garage') {
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.strokeRect(x - r, y - r, 2 * r, 2 * r);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, TAU);
    ctx.fill();
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.25, 0, TAU);
    ctx.fill();
  } else if (m.kind === 'pizzeria') {
    ctx.beginPath();
    ctx.arc(x, y, r + 1, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.6);
    ctx.lineTo(x - r * 0.55, y - r * 0.45);
    ctx.lineTo(x + r * 0.55, y - r * 0.45);
    ctx.closePath();
    ctx.fill();
    if (m.crossed) {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
      ctx.stroke();
    }
  } else {
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.strokeRect(x - r, y - r, 2 * r, 2 * r);
    if (big && m.text) {
      ctx.fillStyle = '#111';
      ctx.font = pixelFont(8);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.text, x, y + 1);
    }
  }
  if (big && m.label) {
    ctx.font = `700 11px ${UI_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.strokeText(m.label, x + r + 6, y);
    ctx.fillStyle = '#3a1e10';
    ctx.fillText(m.label, x + r + 6, y);
  }
}

// ---------------------------------------------------------------------------
// Radar
// ---------------------------------------------------------------------------
export function radarRect() {
  const w = screen.small ? 140 : 210;
  return { x: screen.w - w - 12, y: 12, w, h: Math.round(w * 0.72) };
}

export function drawRadar(player, markers) {
  const r = radarRect();
  const span = 60; // tiles across
  const sc = r.w / span;
  const px = player.x / TILE;
  const py = player.y / TILE;
  const vx = px - span / 2;
  const vy = py - r.h / sc / 2;
  const toRadar = (wx, wy) => [r.x + (wx / TILE - vx) * sc, r.y + (wy / TILE - vy) * sc];

  ctx.fillStyle = '#000';
  ctx.fillRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
  ctx.fillStyle = '#9ccbe8';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(radarImage, r.x - vx * sc, r.y - vy * sc, MAP_W * sc, MAP_H * sc);
  ctx.imageSmoothingEnabled = true;
  for (const m of markers) {
    const [x, y] = toRadar(m.x, m.y);
    drawMarker(m, x, y, false);
  }
  ctx.restore();

  // Off-radar targets: a small chevron on the border.
  for (const m of markers) {
    if (!m.pulse) continue;
    const [x, y] = toRadar(m.x, m.y);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) continue;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const an = Math.atan2(y - cy, x - cx);
    const t = Math.min((r.w / 2 - 6) / Math.abs(Math.cos(an) || 1e-6), (r.h / 2 - 6) / Math.abs(Math.sin(an) || 1e-6));
    ctx.fillStyle = m.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.save();
    ctx.translate(cx + Math.cos(an) * t, cy + Math.sin(an) * t);
    ctx.rotate(an);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawArrow(r.x + r.w / 2, r.y + r.h / 2, player.a, 7);
  ctx.fillStyle = 'rgba(0,0,0,.65)';
  ctx.fillRect(r.x, r.y + r.h - 16, r.w, 16);
  ctx.fillStyle = '#fff';
  ctx.font = pixelFont(7);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const caption = `${districtAt(Math.floor(px), Math.floor(py)).toUpperCase()} · M MAPPA`;
  ctx.fillText(fitText(caption, r.w - 8, 7), r.x + r.w / 2, r.y + r.h - 7);
}

// ---------------------------------------------------------------------------
// Full-screen street map
// ---------------------------------------------------------------------------
const HEADER = 56;
export const streetMap = { open: false, zoom: 6, cx: 0, cy: 0 };

const fitZoom = () => Math.min((screen.w - 30) / MAP_W, (screen.h - 100) / MAP_H);

function clampView() {
  const v = streetMap;
  const hw = screen.w / 2 / v.zoom;
  const hh = (screen.h - 50) / 2 / v.zoom;
  v.cx = MAP_W < 2 * hw ? MAP_W / 2 : clamp(v.cx, hw, MAP_W - hw);
  v.cy = MAP_H < 2 * hh ? MAP_H / 2 : clamp(v.cy, hh, MAP_H - hh);
}

export function openStreetMap(player) {
  Object.assign(streetMap, { open: true, zoom: Math.max(fitZoom(), 6), cx: player.x / TILE, cy: player.y / TILE });
  clampView();
}

export const closeStreetMap = () => (streetMap.open = false);

export function zoomStreetMap(sx, sy, factor) {
  const v = streetMap;
  const k = v.zoom;
  const nk = clamp(k * factor, fitZoom(), 28);
  const tx = v.cx + (sx - screen.w / 2) / k;
  const ty = v.cy + (sy - screen.h / 2 - 25) / k;
  v.zoom = nk;
  v.cx = tx - (sx - screen.w / 2) / nk;
  v.cy = ty - (sy - screen.h / 2 - 25) / nk;
  clampView();
}

export function panStreetMap(dxScreen, dyScreen) {
  streetMap.cx -= dxScreen / streetMap.zoom;
  streetMap.cy -= dyScreen / streetMap.zoom;
  clampView();
}

export function streetMapButtons() {
  const s = screen.small ? 34 : 40;
  const y = 8;
  const w = screen.w;
  return [
    { x: w - s - 8, y, w: s, h: s, label: '✕', run: closeStreetMap },
    { x: w - 2 * s - 14, y, w: s, h: s, label: '+', run: () => zoomStreetMap(screen.w / 2, screen.h / 2, 1.4) },
    { x: w - 3 * s - 20, y, w: s, h: s, label: '−', run: () => zoomStreetMap(screen.w / 2, screen.h / 2, 1 / 1.4) },
  ];
}

function drawStreetNames(X, Y, k) {
  if (k < 2.6) return;
  const fs = Math.round(clamp(k * 1.5, 9, 13));
  ctx.font = `600 ${fs}px ${UI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const placed = [];
  const byImportance = [...ROADS].sort((a, b) => ROAD_PRIORITY[b.kind] - ROAD_PRIORITY[a.kind]);
  for (const r of byImportance) {
    if ((r.kind === 'vicolo' && k < 7) || (r.kind === 'street' && k < 4)) continue;
    const tw = ctx.measureText(r.name).width;
    for (let j = 0; j < r.path.length - 1; j++) {
      const [x1, y1] = [X(r.path[j][0]), Y(r.path[j][1])];
      const [x2, y2] = [X(r.path[j + 1][0]), Y(r.path[j + 1][1])];
      const L = Math.hypot(x2 - x1, y2 - y1);
      if (L < tw + 16) continue;
      const reps = Math.max(1, Math.floor(L / (tw + 260)));
      for (let q = 0; q < reps; q++) {
        const t = (q + 0.5) / reps;
        const mx = x1 + (x2 - x1) * t;
        const my = y1 + (y2 - y1) * t;
        if (mx < -50 || mx > screen.w + 50 || my < 40 || my > screen.h + 20) continue;
        if (placed.some(([px, py]) => Math.hypot(px - mx, py - my) < Math.max(tw * 0.6, 40))) continue;
        placed.push([mx, my]);
        let an = Math.atan2(y2 - y1, x2 - x1);
        if (an > Math.PI / 2) an -= Math.PI;
        if (an < -Math.PI / 2) an += Math.PI;
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(an);
        ctx.strokeStyle = 'rgba(255,255,255,.95)';
        ctx.lineWidth = 3.5;
        ctx.strokeText(r.name, 0, 1);
        ctx.fillStyle = r.kind === 'hwy' ? '#1f5a14' : '#3a3024';
        ctx.fillText(r.name, 0, 1);
        ctx.restore();
      }
    }
  }
}

function drawDistrictNames(X, Y, k) {
  ctx.font = pixelFont(clamp(k * 2, 10, 18));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  for (const [d, [cx, cy]] of Object.entries(districtCentres)) {
    const x = X(cx);
    const y = Y(cy);
    if (x < -200 || x > screen.w + 200 || y < -50 || y > screen.h + 50) continue;
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.strokeText(d.toUpperCase(), x, y);
    ctx.fillStyle = 'rgba(110,55,20,.9)';
    ctx.fillText(d.toUpperCase(), x, y);
  }
  ctx.font = `italic 600 ${Math.round(clamp(k * 2.4, 12, 22))}px Georgia,serif`;
  ctx.fillStyle = 'rgba(30,80,120,.7)';
  ctx.fillText('Golfo di Napoli', X(138), Y(106 + OY));
  ctx.font = `italic 600 ${Math.round(clamp(k * 1.6, 10, 16))}px Georgia,serif`;
  ctx.fillStyle = 'rgba(150,100,30,.85)';
  for (const b of BEACHES) {
    const [x0, y0, x1, y1] = b.rect;
    ctx.fillText(b.name, X((x0 + x1) / 2), Y(y1 - 3.5));
  }
}

/** Blue "P" signs on the car parks. */
function drawParkingSigns(X, Y, k) {
  if (k < 3) return;
  const r = clamp(k * 0.9, 5, 9);
  ctx.font = `bold ${Math.round(r * 1.5)}px ${UI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of PARKINGS) {
    const [x0, y0, x1, y1] = p.rect;
    const x = X((x0 + x1) / 2);
    const y = Y((y0 + y1) / 2);
    ctx.fillStyle = '#2e63b8';
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.fillStyle = '#fff';
    ctx.fillText('P', x, y + 1);
  }
}

function drawLegend(entries) {
  const lx = 12;
  const ly = screen.h - 12 - entries.length * 18;
  ctx.fillStyle = 'rgba(255,255,255,.88)';
  ctx.fillRect(lx - 6, ly - 14, screen.small ? 160 : 190, entries.length * 18 + 10);
  entries.forEach(([name, draw], j) => {
    const y = ly + j * 18;
    draw(lx, y);
    ctx.fillStyle = '#3a3024';
    ctx.font = `600 11px ${UI_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, lx + 36, y);
  });
}

const roadSwatch = (st) => (x, y) => {
  ctx.strokeStyle = st.edge;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 28, y);
  ctx.stroke();
  ctx.strokeStyle = st.fill;
  ctx.lineWidth = 5;
  ctx.stroke();
};

export function drawStreetMap(player, markers) {
  const k = streetMap.zoom;
  const X = (tx) => screen.w / 2 + (tx - streetMap.cx) * k;
  const Y = (ty) => screen.h / 2 + 25 + (ty - streetMap.cy) * k;

  ctx.fillStyle = '#9ccbe8';
  ctx.fillRect(0, 0, screen.w, screen.h);
  ctx.imageSmoothingEnabled = k < 4;
  ctx.drawImage(districtImage, X(0), Y(0), MAP_W * k, MAP_H * k);
  ctx.imageSmoothingEnabled = true;
  ctx.save();
  ctx.beginPath();
  ctx.rect(X(0), Y(0), MAP_W * k, MAP_H * k); // le strade che escono dalla città finiscono al bordo
  ctx.clip();
  drawRoadNetwork(ctx, X, Y, k, 2.4);
  drawStreetNames(X, Y, k);
  ctx.restore();
  drawParkingSigns(X, Y, k);
  drawDistrictNames(X, Y, k);

  for (const m of markers) drawMarker(m, X(m.x / TILE), Y(m.y / TILE), true);

  const px = X(player.x / TILE);
  const py = Y(player.y / TILE);
  ctx.fillStyle = 'rgba(232,38,43,.18)';
  disc(px, py, 22);
  drawArrow(px, py, player.a, 11);

  // Title bar.
  ctx.fillStyle = '#1b1712';
  ctx.fillRect(0, 0, screen.w, HEADER);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(0, HEADER, screen.w, 3);
  outlinedText('STRADARIO DI NAPOLI', 64, screen.small ? 24 : 28, screen.small ? 10 : 14, '#ffd23f');
  ctx.font = `600 11px ${UI_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d8cfb8';
  ctx.fillText(
    screen.small
      ? 'trascina · pizzica per zoom'
      : 'rotella o +/− per lo zoom · trascina per spostarti · M per chiudere',
    64,
    screen.small ? 44 : 46,
  );
  for (const b of streetMapButtons()) {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#1b1712';
    ctx.font = `bold ${Math.round(b.h * 0.55)}px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  }

  drawLegend([
    ['Tangenziale', roadSwatch(ROAD_STYLE.hwy)],
    ['Strada principale', roadSwatch(ROAD_STYLE.main)],
    ['Strada', roadSwatch(ROAD_STYLE.street)],
    ['Vicolo', roadSwatch(ROAD_STYLE.vicolo)],
    ['Pizzeria', (x, y) => drawMarker({ kind: 'pizzeria', color: '#c8262b' }, x + 14, y, false)],
    ['Cliente da servire', (x, y) => drawMarker({ kind: 'stop', color: '#ffd23f' }, x + 14, y, false)],
    ['Officina (Vespa)', (x, y) => drawMarker({ kind: 'garage', color: '#2b8fd6' }, x + 14, y, false)],
    ['Vespa libera', (x, y) => drawMarker({ kind: 'vespa' }, x + 14, y, false)],
    [
      'Parcheggio',
      (x, y) => {
        ctx.fillStyle = '#2e63b8';
        ctx.fillRect(x + 9, y - 5, 10, 10);
        ctx.fillStyle = '#fff';
        ctx.font = `bold 9px ${UI_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('P', x + 14, y + 1);
      },
    ],
  ]);
}
