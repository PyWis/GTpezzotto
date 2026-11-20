// Rooftop details that make each monument recognisable.

import { TAU } from '../core/math.js';
import { shade } from '../core/color.js';
import { time } from '../core/time.js';
import { TILE } from '../data/city.js';
import { camera, project } from './camera.js';
import { centeredLabel, ctx, disc, ellipse, inFrame, line, polyline } from './canvas.js';

/** Project a tile-space point at height h; returns [x, y, scale]. */
const at = (tx, ty, h) => project(tx * TILE, ty * TILE, h);
/** Screen radius of `r` tiles at a projected point. */
const radius = (r, p) => r * TILE * camera.zoom * p[2];

function fillBox(a, b) {
  ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
}

function ellipseRing(cx, cy, rx, ry, h, steps = 48) {
  const pts = [];
  for (let j = 0; j <= steps; j++) {
    const an = (j * TAU) / steps;
    pts.push(at(cx + Math.cos(an) * rx, cy + Math.sin(an) * ry, h));
  }
  return pts;
}

const DECORATORS = {
  castle(lm) {
    const [x0, y0, x1, y1] = lm.rect;
    const h = lm.height;
    ctx.fillStyle = shade(lm.color, -0.2); // merlons
    for (let tx = x0; tx < x1; tx += 0.5)
      for (const ty of [y0, y1 - 0.18])
        if (((tx * 2) | 0) % 2 === 0) fillBox(at(tx, ty, h + 0.2), at(tx + 0.5, ty + 0.18, h + 0.2));
    for (let ty = y0; ty < y1; ty += 0.5)
      for (const tx of [x0, x1 - 0.18])
        if (((ty * 2) | 0) % 2 === 0) fillBox(at(tx, ty, h + 0.2), at(tx + 0.18, ty + 0.5, h + 0.2));

    const towers = [
      [x0 + 0.6, y0 + 0.6],
      [x1 - 0.6, y0 + 0.6],
      [x0 + 0.6, y1 - 0.6],
      [x1 - 0.6, y1 - 0.6],
    ];
    if (lm.name === 'Maschio Angioino') towers.push([x0 + 0.6, (y0 + y1) / 2]);
    for (const [tx, ty] of towers) {
      const base = at(tx, ty, h);
      const top = at(tx, ty, h + 0.9);
      ctx.fillStyle = shade(lm.color, -0.35);
      disc(base[0], base[1], radius(1.15, base));
      ctx.fillStyle = shade(lm.color, -0.05);
      disc(top[0], top[1], radius(1.15, top));
      ctx.fillStyle = shade(lm.color, -0.25);
      disc(top[0], top[1], radius(0.7, top));
    }

    if (lm.name === "Castel dell'Ovo") {
      const pole = at(x0 + 3, y0 + 2.5, h);
      const flag = at(x0 + 3, y0 + 2.5, h + 2.2);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1.5 * camera.zoom;
      line(pole[0], pole[1], flag[0], flag[1]);
      const w = 8 * camera.zoom * flag[2];
      ['#009246', '#f1f2f1', '#ce2b37'].forEach((c, k) => {
        ctx.fillStyle = c;
        ctx.fillRect(flag[0] + (k * w) / 3, flag[1], w / 3, w * 0.6);
      });
    }
  },

  palace(lm) {
    const [x0, y0, x1, y1] = lm.rect;
    const h = lm.height;
    const a = at(x0 + 1.3, y0 + 1.3, h);
    const b = at(x1 - 1.3, y1 - 1.3, h);
    if (b[0] - a[0] > 4) {
      ctx.fillStyle = shade(lm.color, -0.45); // courtyard
      fillBox(a, b);
      ctx.fillStyle = '#9a8f78';
      const c = at((x0 + x1) / 2, (y0 + y1) / 2, h);
      disc(c[0], c[1], radius(0.6, c));
    }
    ctx.strokeStyle = shade(lm.color, 0.25);
    ctx.lineWidth = 1.5 * camera.zoom;
    const o1 = at(x0 + 0.4, y0 + 0.4, h);
    const o2 = at(x1 - 0.4, y1 - 0.4, h);
    ctx.strokeRect(o1[0], o1[1], o2[0] - o1[0], o2[1] - o1[1]);
  },

  /** Galleria Umberto I: glass cross-vault with the central dome. */
  glass(lm) {
    const [x0, y0, x1, y1] = lm.rect;
    const h = lm.height + 0.3;
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    ctx.fillStyle = '#bfe0ec';
    fillBox(at(mx - 1.2, y0 + 0.4, h), at(mx + 1.2, y1 - 0.4, h));
    fillBox(at(x0 + 0.4, my - 1.2, h), at(x1 - 0.4, my + 1.2, h));
    ctx.strokeStyle = 'rgba(60,90,110,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let t = y0 + 0.4; t < y1 - 0.4; t += 0.5) {
      const p = at(mx - 1.2, t, h);
      const q = at(mx + 1.2, t, h);
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
    }
    for (let t = x0 + 0.4; t < x1 - 0.4; t += 0.5) {
      const p = at(t, my - 1.2, h);
      const q = at(t, my + 1.2, h);
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
    const e = at(mx, my, lm.height + 1.1);
    const R = radius(1.9, e);
    ctx.fillStyle = '#d9f1f8';
    disc(e[0], e[1], R);
    ctx.strokeStyle = 'rgba(60,90,110,.6)';
    ctx.beginPath();
    for (let j = 0; j < 12; j++) {
      const an = (j * TAU) / 12;
      ctx.moveTo(e[0], e[1]);
      ctx.lineTo(e[0] + Math.cos(an) * R, e[1] + Math.sin(an) * R);
    }
    ctx.stroke();
  },

  /** San Francesco di Paola: colonnade and stepped dome. */
  dome(lm) {
    const [cx, cy] = lm.center;
    const h = lm.height;
    for (let an = -1.35; an <= 1.36; an += 0.1) {
      const tx = cx + Math.cos(an) * 7.6;
      const ty = cy + Math.sin(an) * 7.6;
      const b = at(tx, ty, 0);
      const t = at(tx, ty, 1.4);
      ctx.fillStyle = '#9a9384';
      disc(b[0], b[1], radius(0.12, b));
      ctx.fillStyle = '#ece6d8';
      disc(t[0], t[1], radius(0.17, t));
    }
    const rings = [
      [1, 0, '#d6cdb8'],
      [0.82, 0.6, '#c9d2d6'],
      [0.6, 1.2, '#b7c3c8'],
      [0.35, 1.7, '#a7b4ba'],
      [0.12, 2.2, '#e9e4d6'],
    ];
    for (const [k, dh, col] of rings) {
      const c = at(cx, cy, h + dh);
      ctx.fillStyle = col;
      disc(c[0], c[1], radius(lm.radius * k, c));
    }
    const low = at(cx, cy, h + 0.6);
    const high = at(cx, cy, h + 2.2);
    ctx.strokeStyle = 'rgba(80,90,95,.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let j = 0; j < 16; j++) {
      const an = (j * TAU) / 16;
      const r0 = radius(lm.radius * 0.12, high);
      const r1 = radius(lm.radius * 0.82, low);
      ctx.moveTo(high[0] + Math.cos(an) * r0, high[1] + Math.sin(an) * r0);
      ctx.lineTo(low[0] + Math.cos(an) * r1, low[1] + Math.sin(an) * r1);
    }
    ctx.stroke();
  },

  /** Castel Sant'Elmo: the six-pointed star fortress. */
  fort(lm) {
    const [cx, cy] = lm.center;
    const star = [];
    for (let j = 0; j <= 12; j++) {
      const an = (j * TAU) / 12;
      const r = (j % 2 ? 0.58 : 1) * lm.radius;
      star.push(at(cx + Math.cos(an) * r, cy + Math.sin(an) * r, lm.height + 0.05));
    }
    polyline(star);
    ctx.strokeStyle = '#6d6656';
    ctx.lineWidth = 3 * camera.zoom;
    ctx.stroke();
    const keep = [];
    for (let j = 0; j <= 6; j++) {
      const an = (j * TAU) / 6 + TAU / 12;
      keep.push(at(cx + Math.cos(an) * lm.radius * 0.42, cy + Math.sin(an) * lm.radius * 0.42, lm.height + 0.3));
    }
    polyline(keep);
    ctx.fillStyle = '#bdb59e';
    ctx.fill();
  },

  church(lm) {
    const [x0, y0, x1, y1] = lm.rect;
    const h = lm.height + 0.2;
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const vertical = y1 - y0 >= x1 - x0;
    ctx.fillStyle = shade(lm.color, 0.2); // nave and transept
    if (vertical) {
      fillBox(at(mx - 0.6, y0 + 0.5, h), at(mx + 0.6, y1 - 0.5, h));
      fillBox(at(x0 + 0.5, my - 1.6, h), at(x1 - 0.5, my - 0.4, h));
    } else {
      fillBox(at(x0 + 0.5, my - 0.6, h), at(x1 - 0.5, my + 0.6, h));
      fillBox(at(mx - 1.6, y0 + 0.5, h), at(mx - 0.4, y1 - 0.5, h));
    }
    const d = at(mx, my - 1, lm.height + 0.9);
    ctx.fillStyle = '#b9c0bf';
    disc(d[0], d[1], radius(1, d));
    ctx.fillStyle = '#e7e2d4';
    disc(d[0], d[1], radius(0.3, d));
  },

  station(lm) {
    const [x0, y0, x1, y1] = lm.rect;
    const h = lm.height;
    ctx.strokeStyle = 'rgba(120,115,105,.55)';
    ctx.lineWidth = 2 * camera.zoom;
    ctx.beginPath();
    for (let tx = x0 + 1; tx < x1; tx++) {
      const p = at(tx, y0 + 0.5, h);
      const q = at(tx, y1 - 0.5, h);
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
    ctx.fillStyle = '#c9473a';
    fillBox(at(x0 + 0.3, y0 + 0.3, h + 0.15), at(x0 + 1.6, y1 - 0.3, h + 0.15));
  },

  stadium(lm) {
    const [cx, cy] = lm.center;
    const h = lm.height;
    for (const [dx, dy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const tx = cx + dx * lm.rx * 0.72;
      const ty = cy + dy * lm.ry * 0.72;
      const b = at(tx, ty, h);
      const t = at(tx, ty, h + 3);
      ctx.strokeStyle = '#555'; // floodlight masts
      ctx.lineWidth = 2 * camera.zoom;
      line(b[0], b[1], t[0], t[1]);
      const k = camera.zoom * t[2];
      ctx.fillStyle = '#fff8d0';
      ctx.fillRect(t[0] - 5 * k, t[1] - 3 * k, 10 * k, 6 * k);
    }
    const roofH = h + 0.9;
    const outer = ellipseRing(cx, cy, lm.rx * 1.02, lm.ry * 1.02, roofH);
    const inner = ellipseRing(cx, cy, lm.rx * 0.8, lm.ry * 0.8, roofH);
    polyline([...outer, ...inner.reverse()], true);
    ctx.fillStyle = 'rgba(236,238,236,.62)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,128,135,.8)';
    ctx.lineWidth = 1.3 * camera.zoom;
    ctx.beginPath();
    for (let j = 0; j < 32; j++) {
      const an = (j * TAU) / 32;
      const a = at(cx + Math.cos(an) * lm.rx * 0.8, cy + Math.sin(an) * lm.ry * 0.8, roofH);
      const b = at(cx + Math.cos(an) * lm.rx * 1.02, cy + Math.sin(an) * lm.ry * 1.02, roofH);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
    ctx.strokeStyle = '#8a9096';
    ctx.lineWidth = 2 * camera.zoom;
    for (const k of [0.8, 1.02]) {
      polyline(ellipseRing(cx, cy, lm.rx * k, lm.ry * k, roofH));
      ctx.stroke();
    }
  },

  chimney(lm) {
    const [cx, cy] = lm.center;
    const top = at(cx, cy, lm.height);
    const R = radius(lm.radius, top);
    ctx.fillStyle = '#f2f0ea';
    disc(top[0], top[1], R);
    ctx.fillStyle = '#c0392b';
    disc(top[0], top[1], R * 0.78);
    ctx.fillStyle = '#2a2522';
    disc(top[0], top[1], R * 0.5);
    for (let j = 0; j < 6; j++) {
      const ph = (time.t * 0.18 + j / 6 + cx * 0.01) % 1;
      const p = at(cx + ph * 3, cy - ph * 4, lm.height + 0.5 + ph * 4);
      ctx.fillStyle = `rgba(200,200,195,${0.5 * (1 - ph)})`;
      disc(p[0], p[1], (6 + ph * 26) * camera.zoom * p[2]);
    }
  },

  tank(lm) {
    const c = at(...lm.center, lm.height);
    const R = radius(lm.radius, c);
    ctx.fillStyle = lm.color;
    disc(c[0], c[1], R);
    ctx.strokeStyle = '#b9b8b0';
    ctx.lineWidth = 1.5 * camera.zoom;
    ctx.beginPath();
    ctx.arc(c[0], c[1], R * 0.7, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#c9c8c0';
    disc(c[0], c[1], R * 0.15);
    ctx.fillStyle = '#d23a2a';
    ctx.fillRect(c[0] - R * 0.5, c[1] - 1.5 * camera.zoom, R, 3 * camera.zoom);
  },

  gasometer(lm) {
    const [cx, cy] = lm.center;
    for (let hh = 1; hh <= lm.height; hh++) {
      const c = at(cx, cy, hh);
      ctx.strokeStyle = hh === lm.height ? '#4d524e' : 'rgba(60,65,62,.7)';
      ctx.lineWidth = 2 * camera.zoom;
      ctx.beginPath();
      ctx.arc(c[0], c[1], radius(lm.radius, c), 0, TAU);
      ctx.stroke();
    }
    const c = at(cx, cy, lm.height);
    const R = radius(lm.radius * 0.85, c);
    ctx.fillStyle = '#8c928d';
    disc(c[0], c[1], R);
    ctx.strokeStyle = 'rgba(40,40,40,.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let j = 0; j < 12; j++) {
      const an = (j * TAU) / 12;
      ctx.moveTo(c[0], c[1]);
      ctx.lineTo(c[0] + Math.cos(an) * R, c[1] + Math.sin(an) * R);
    }
    ctx.stroke();
  },

  /** Italsider blast furnace with its conveyor. */
  furnace(lm) {
    const [x0, y0, x1, y1] = lm.rect;
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const top = at(mx, my, lm.height + 1.5);
    const base = at(mx, my, lm.height);
    ctx.fillStyle = '#5a3c2e';
    disc(base[0], base[1], radius(1.6, base));
    ctx.fillStyle = '#7a4e3a';
    disc(top[0], top[1], radius(1.2, top));
    ctx.fillStyle = '#2a1c16';
    disc(top[0], top[1], radius(0.6, top));
    const g = at(x1 + 2, y1 + 1, 0);
    const p = at(mx + 0.8, my + 0.8, lm.height + 0.8);
    ctx.strokeStyle = '#5a4638';
    ctx.lineWidth = 5 * camera.zoom;
    line(g[0], g[1], p[0], p[1]);
  },

  /** Equestrian statue. */
  statue(lm) {
    const [x0, y0] = lm.rect;
    const c = at(x0 + 0.5, y0 + 0.5, lm.height + 0.9);
    inFrame(c[0], c[1], 0, camera.zoom * c[2], () => {
      ctx.fillStyle = '#3d4a3c';
      ellipse(0, 0, 11, 4.5);
      ctx.fillRect(-11, -1.5, 4, 3);
      ctx.fillStyle = '#4f5e4c';
      disc(9, 0, 3);
      ctx.fillStyle = '#55654f';
      disc(-1, 0, 4);
    });
  },

  /** Arena Flegrea: open-air cavea facing its stage. */
  arena(lm) {
    const [cx, cy] = lm.center;
    const b = at(cx, cy, 0.4);
    ctx.fillStyle = '#8f8470';
    disc(b[0], b[1], radius(lm.radius, b) * 0.98);
    for (let j = 0; j < 6; j++) {
      const c = at(cx, cy, lm.height - j * 0.22);
      ctx.strokeStyle = j % 2 ? '#c9bea4' : '#ddd3bb';
      ctx.lineWidth = radius(lm.radius * 0.1, c);
      ctx.beginPath();
      ctx.arc(c[0], c[1], radius(lm.radius * (0.95 - j * 0.11), c), Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
    }
    const s1 = at(cx + 0.2, cy - 1.2, 0.9);
    const s2 = at(cx + 1.6, cy + 1.2, 0.9);
    ctx.fillStyle = '#6b4a32';
    fillBox(s1, s2);
    ctx.fillStyle = '#a8774f';
    ctx.fillRect(s1[0], s1[1], (s2[0] - s1[0]) * 0.3, s2[1] - s1[1]);
  },

  tower(lm) {
    const [x0, y0, x1, y1] = lm.rect;
    if (lm.height >= 10) {
      const c = at((x0 + x1) / 2, (y0 + y1) / 2, lm.height); // helipad
      ctx.strokeStyle = '#f2f2f2';
      ctx.lineWidth = 2 * camera.zoom;
      ctx.beginPath();
      ctx.arc(c[0], c[1], radius(1.3, c), 0, TAU);
      ctx.stroke();
      centeredLabel('H', c[0], c[1] + 1, 22 * camera.zoom * c[2], '#f2f2f2');
    } else {
      const c = at(x0 + 1, y0 + 1, lm.height + 0.3);
      ctx.fillStyle = '#8a9aa6';
      ctx.fillRect(c[0], c[1], radius(1.2, c), radius(0.9, c));
    }
  },
};

export function drawLandmark(lm) {
  DECORATORS[lm.style]?.(lm);
}
