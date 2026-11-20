// Everything the pizza job draws in the world: shop fronts, customer doors,
// beacons above the targets and the guide arrow around Gennaro.

import { TAU } from '../core/math.js';
import { time } from '../core/time.js';
import { TILE } from '../data/city.js';
import { camera, project, toScreen } from './camera.js';
import { ctx, disc, outlinedText, pixelFont, screen } from './canvas.js';

export const STOP_COLOR = '#ffd23f';
const METERS_PER_PX = 2.6 / TILE;

/** Shop front on the pavement: striped awning, sign and a status lamp. */
export function drawPizzeria(p, status, near) {
  const [x, y] = toScreen(...p.pos);
  if (x < -120 || y < -120 || x > screen.w + 120 || y > screen.h + 120) return;
  const z = camera.zoom;
  const w = 30 * z;
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = k % 2 ? '#f4efe2' : p.color;
    ctx.fillRect(x - w / 2 + (k * w) / 6, y - 16 * z, w / 6 + 0.5, 9 * z);
  }
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(x - w / 2, y - 7 * z, w, 2 * z);
  // Pizza on the sign.
  ctx.fillStyle = '#e9c27a';
  disc(x, y + 2 * z, 7 * z);
  ctx.fillStyle = '#d2412f';
  disc(x, y + 2 * z, 5.5 * z);
  ctx.fillStyle = '#f7f1dc';
  for (let k = 0; k < 4; k++) disc(x + Math.cos(k * 1.7) * 3 * z, y + 2 * z + Math.sin(k * 1.7) * 3 * z, 1.2 * z);
  ctx.fillStyle = status.color;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + w / 2 + 4 * z, y - 12 * z, 4 * z, 0, TAU);
  ctx.fill();
  ctx.stroke();
  if (near || camera.zoom > 0.9) outlinedText(p.name, x, y - 22 * z, screen.small ? 7 : 9, '#fff', 'center');
  if (status.tag) outlinedText(status.tag, x, y + 20 * z, screen.small ? 7 : 8, status.color, 'center');
}

/** Doormat + floating beacon over a customer's door. */
export function drawStop(stop, order, isNext) {
  const [gx, gy] = toScreen(stop.address.x, stop.address.y);
  if (gx < -200 || gy < -200 || gx > screen.w + 200 || gy > screen.h + 200) return;
  const z = camera.zoom;
  const pulse = 0.5 + 0.5 * Math.sin(time.t * 5);
  ctx.strokeStyle = STOP_COLOR;
  ctx.lineWidth = 3 * z;
  ctx.globalAlpha = 0.4 + 0.5 * pulse;
  ctx.beginPath();
  ctx.arc(gx, gy, (14 + pulse * 8) * z, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawBeacon(stop.address.x, stop.address.y, STOP_COLOR, String(stop.pizzas.length));
  const [tx, ty] = project(stop.address.x, stop.address.y, 4.6);
  outlinedText(
    `${stop.family} · #${order.number}`,
    tx,
    ty - 18,
    screen.small ? 7 : 9,
    isNext ? STOP_COLOR : '#fff',
    'center',
  );
}

/** A bobbing diamond high above a world point, visible over the roofs. */
function drawBeacon(wx, wy, color, label) {
  const bob = Math.sin(time.t * 3) * 0.25;
  const [bx, by] = project(wx, wy, 0);
  const [x, y] = project(wx, wy, 4 + bob);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const r = 11;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (label) {
    ctx.fillStyle = '#111';
    ctx.font = pixelFont(9);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 1);
  }
}

/** Arrow orbiting Gennaro that points to the current objective, with distance. */
export function drawGuide(player, target) {
  if (!target) return;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const d = Math.hypot(dx, dy);
  if (d < 70) return;
  const an = Math.atan2(dy, dx);
  const [px, py] = toScreen(player.x, player.y);
  const R = 46 * Math.max(0.8, camera.zoom);
  const x = px + Math.cos(an) * R;
  const y = py + Math.sin(an) * R;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(an);
  ctx.fillStyle = target.color;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-6, -9);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-6, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  const meters = d * METERS_PER_PX;
  const text =
    meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(meters / 10) * 10} m`;
  outlinedText(text, px + Math.cos(an) * (R + 26), py + Math.sin(an) * (R + 26) + 4, 8, target.color, 'center');
}
