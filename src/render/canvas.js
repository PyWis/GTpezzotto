import { TAU } from '../core/math.js';

export const canvas = document.getElementById('c');
export const ctx = canvas.getContext('2d');

/** Viewport in CSS pixels. */
export const screen = {
  w: 0,
  h: 0,
  dpr: 1,
  get small() {
    return this.w < 620;
  },
};

export function resize() {
  screen.dpr = Math.min(2, window.devicePixelRatio || 1);
  screen.w = innerWidth;
  screen.h = innerHeight;
  canvas.width = Math.round(screen.w * screen.dpr);
  canvas.height = Math.round(screen.h * screen.dpr);
  canvas.style.width = `${screen.w}px`;
  canvas.style.height = `${screen.h}px`;
}

export const PIXEL_FONT = '"Press Start 2P",monospace';
export const UI_FONT = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
export const pixelFont = (size) => `${Math.round(size)}px ${PIXEL_FONT}`;

// ---- primitives -----------------------------------------------------------
export function ellipse(x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

export function disc(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

export function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

export function quad(a, b, c, d) {
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.lineTo(d[0], d[1]);
  ctx.closePath();
}

export function line(ax, ay, bx, by) {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
}

export function polyline(points, closed = false) {
  ctx.beginPath();
  points.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (closed) ctx.closePath();
}

/** Outlined pixel-font text, the HUD's house style. */
export function outlinedText(text, x, y, size, color, align = 'left') {
  ctx.font = pixelFont(size);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 3.2);
  ctx.strokeStyle = '#000';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** Greedy word wrap for the current font size. */
export function wrapText(text, maxWidth, size) {
  ctx.font = pixelFont(size);
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const tryLine = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(tryLine).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = tryLine;
  }
  if (line) lines.push(line);
  return lines;
}

/** Shortens text with an ellipsis so it fits `maxWidth` at `size`. */
export function fitText(text, maxWidth, size) {
  ctx.font = pixelFont(size);
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export function centeredLabel(text, x, y, size, color) {
  ctx.font = pixelFont(size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export const withAlpha = (alpha, draw) => {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  draw();
  ctx.globalAlpha = prev;
};

/** Draw in a local frame: translated, rotated and scaled. */
export function inFrame(x, y, angle, scale, draw) {
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  ctx.scale(scale, scale);
  draw();
  ctx.restore();
}
