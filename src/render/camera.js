import { clamp } from '../core/math.js';
import { TILE } from '../data/city.js';
import { screen } from './canvas.js';

/** Height perspective: each floor scales the projection by this much. */
export const PERSPECTIVE = 0.068;

export const camera = { x: 0, y: 0, zoom: 1.4, shake: 0, cx: 0, cy: 0 };

/** World → screen, on the ground. */
export const toScreen = (wx, wy) => [
  (wx - camera.x) * camera.zoom + camera.cx,
  (wy - camera.y) * camera.zoom + camera.cy,
];

/** World → screen at height h (in floors). Returns [x, y, scale]. */
export function project(wx, wy, h) {
  const s = 1 + h * PERSPECTIVE;
  const [bx, by] = toScreen(wx, wy);
  return [camera.cx + (bx - camera.cx) * s, camera.cy + (by - camera.cy) * s, s];
}

/** Lift an already-projected ground point to height h. */
export function lift(sx, sy, h) {
  const s = 1 + h * PERSPECTIVE;
  return [camera.cx + (sx - camera.cx) * s, camera.cy + (sy - camera.cy) * s];
}

export function isVisible(wx, wy, margin = 60) {
  const [x, y] = toScreen(wx, wy);
  return x > -margin && y > -margin && x < screen.w + margin && y < screen.h + margin;
}

/** Visible tile range, with a small margin. */
export function visibleTiles() {
  const z = camera.zoom;
  return {
    x0: Math.floor((camera.x - (screen.w / 2 + 20) / z) / TILE),
    x1: Math.floor((camera.x + (screen.w / 2 + 20) / z) / TILE),
    y0: Math.floor((camera.y - (screen.h / 2 + 20) / z) / TILE),
    y1: Math.floor((camera.y + (screen.h / 2 + 20) / z) / TILE),
  };
}

export const baseZoom = () => clamp(Math.min(screen.w, screen.h) / 720, 0.62, 1.3);

/** Smoothly follows a target, looking ahead in the direction of travel. */
export function follow(dt, { x, y, heading, speed, zoom }) {
  const lookAhead = speed * 0.42;
  const tx = x + Math.cos(heading) * lookAhead;
  const ty = y + Math.sin(heading) * lookAhead;
  const k = 1 - Math.exp(-dt * 4.5);
  camera.x += (tx - camera.x) * k;
  camera.y += (ty - camera.y) * k;
  camera.zoom += (zoom * baseZoom() - camera.zoom) * (1 - Math.exp(-dt * 1.8));
  if (camera.shake > 0) camera.shake = Math.max(0, camera.shake - dt * 25);
}

export const addShake = (amount) => (camera.shake = Math.max(camera.shake, amount));

/** Recentre (with shake) at the start of each frame. */
export function beginFrame() {
  const jitter = () => (camera.shake ? (Math.random() - 0.5) * camera.shake : 0);
  camera.cx = screen.w / 2 + jitter();
  camera.cy = screen.h / 2 + jitter();
}
