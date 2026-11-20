// Animated scenery: fountains, water jets, Edenlandia rides.

import { TAU } from '../core/math.js';
import { time } from '../core/time.js';
import { FOUNTAINS, TILE, WATER_JETS } from '../data/city.js';
import { camera, project, toScreen } from './camera.js';
import { ctx, disc, polyline, screen } from './canvas.js';

const onScreen = ([x, y], m) => x > -m && y > -m && x < screen.w + m && y < screen.h + m;

function drawFountains() {
  for (const f of FOUNTAINS) {
    const [fx, fy] = [f.center[0] * TILE, f.center[1] * TILE];
    if (!onScreen(toScreen(fx, fy), 200)) continue;
    for (let j = 0; j < 10; j++) {
      const ph = (time.t * 0.8 + j / 10) % 1;
      const an = (j * TAU) / 10 + time.t * 0.3;
      const r = f.radius * TILE * 0.5 * ph;
      const p = project(fx + Math.cos(an) * r, fy + Math.sin(an) * r, 1.5 * Math.sin(ph * Math.PI));
      ctx.fillStyle = `rgba(235,248,255,${0.7 * (1 - ph)})`;
      disc(p[0], p[1], (3 + ph * 5) * camera.zoom);
    }
    const c = project(fx, fy, 1.6);
    ctx.fillStyle = 'rgba(240,250,255,.8)';
    disc(c[0], c[1], 3.5 * camera.zoom);
  }
}

/** The jets of the Fontana dell'Esedra at the Mostra d'Oltremare. */
function drawWaterJets() {
  for (const [jx, jy, jr] of WATER_JETS) {
    if (!onScreen(toScreen(jx * TILE, jy * TILE), 80)) continue;
    for (let j = 0; j < 5; j++) {
      const ph = (time.t * 1.1 + j / 5 + jx) % 1;
      const an = (j * TAU) / 5 + jx;
      const r = jr * TILE * ph * 0.6;
      const p = project(jx * TILE + Math.cos(an) * r, jy * TILE + Math.sin(an) * r, (1 + jr) * Math.sin(ph * Math.PI));
      ctx.fillStyle = `rgba(235,248,255,${0.75 * (1 - ph)})`;
      disc(p[0], p[1], (2 + ph * 4) * camera.zoom * (0.6 + jr));
    }
    const c = project(jx * TILE, jy * TILE, 1 + jr);
    ctx.fillStyle = 'rgba(245,252,255,.85)';
    disc(c[0], c[1], 2.2 * camera.zoom);
  }
}

const WHEEL_COLORS = ['#e64b3c', '#f5d142', '#3d7fd0', '#fff', '#3a9a5b', '#e98aa8'];
const coasterAt = (an) =>
  project((46 + Math.cos(an) * 3) * TILE, (85.5 + Math.sin(an) * 1.8) * TILE, 1.8 + Math.sin(an * 2) * 0.8);

/** Edenlandia: a spinning carousel and a little roller coaster. */
function drawFunfair() {
  if (!onScreen(toScreen(46 * TILE, 83 * TILE), 400)) return;
  const T = time.t;
  const c = project(44.6 * TILE, 80.6 * TILE, 1.6);
  const R = 1.6 * TILE * camera.zoom * c[2];
  for (let j = 0; j < 12; j++) {
    ctx.fillStyle = WHEEL_COLORS[j % 6];
    ctx.beginPath();
    ctx.moveTo(c[0], c[1]);
    ctx.arc(c[0], c[1], R, T * 1.2 + (j * TAU) / 12, T * 1.2 + ((j + 1) * TAU) / 12);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd23f';
  disc(c[0], c[1], R * 0.2);

  const track = [];
  for (let j = 0; j <= 40; j++) track.push(coasterAt((j * TAU) / 40));
  polyline(track);
  ctx.strokeStyle = '#d23a2a';
  ctx.lineWidth = 3 * camera.zoom;
  ctx.stroke();
  ['#3d7fd0', '#f5d142', '#3a9a5b'].forEach((col, k) => {
    const p = coasterAt(T * 1.4 - k * 0.22);
    ctx.fillStyle = col;
    disc(p[0], p[1], 5 * camera.zoom * p[2]);
  });
}

export function drawEffects() {
  drawFountains();
  drawWaterJets();
  drawFunfair();
}
